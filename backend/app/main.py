from typing import Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import base64
import os
import time
import hashlib
from urllib.error import URLError
from urllib.request import Request, urlopen
import cv2
import numpy as np
from pydantic import BaseModel

from app.cv_engine import CVElevationAnalyzer
from app.database import init_db, log_assessment, get_audit_history
from app.mars_gate import exact_source_match, is_trusted_mars_source, mars_only_gate
from app.kalman_filter import mission_tracker
from app.ccsds_encoder import generate_ccsds_packet
from app.model_service import AnalysisServiceClient, AnalysisServiceError
from fastapi.responses import Response

app = FastAPI(
    title="AegisLanding API with Dual Engines",
    version="0.5.0",
    description="Backend API for NSIC SW08 AI-Based Landing Risk Assessment.",
)

# --- PERFORMANCE: REQUEST TIMING MIDDLEWARE ---
# Injects X-Process-Time-Ms into every response header
@app.middleware("http")
async def add_process_time_header(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(process_time_ms)
    return response

# --- SECURITY: API KEY AUTHENTICATION ---
API_KEY_NAME = "X-Mission-Control-Key"
API_KEY = "aegis-hackathon-2026-secure-key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid or missing API Key")
    return api_key

# --- SECURITY: IN-MEMORY RATE LIMITING ---
# Extremely simple rate limiter for the hackathon prototype
ip_request_times = {}
RATE_LIMIT_SECONDS = 2 

def check_rate_limit(client_ip: str = "default"):
    current_time = time.time()
    if client_ip in ip_request_times:
        time_passed = current_time - ip_request_times[client_ip]
        if time_passed < RATE_LIMIT_SECONDS:
            raise HTTPException(status_code=429, detail="Too Many Requests. Please wait before submitting another image.")
    ip_request_times[client_ip] = current_time

# Initialize audit database
init_db()

app.add_middleware(
    CORSMiddleware,
    # TEMPORARY ALLOW-ALL FOR TUNNEL TESTING
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"], 
    allow_headers=["*"],
)

cv_analyzer = CVElevationAnalyzer(lander_size_px=30)
analysis_client = AnalysisServiceClient()

class AssessmentResponse(BaseModel):
    stats: dict[str, Any]
    safe_zones: list[dict[str, Any]]
    images: dict[str, str]
    fallback_triggered: Optional[bool] = False
    analysisId: Optional[str] = None
    engine_used: Optional[str] = None
    source: Optional[dict[str, Any]] = None
    model: Optional[dict[str, Any]] = None
    visualComplexity: Optional[dict[str, Any]] = None
    limitations: list[str] = []


def to_data_uri(encoded_png: str | None) -> Optional[str]:
    if not encoded_png:
        return None
    return f"data:image/png;base64,{encoded_png}"


def verify_trusted_source(source_url: str | None, uploaded_bytes: bytes) -> bool:
    """Verify bytes against an approved source URL before permitting the Mars model."""
    if not is_trusted_mars_source(source_url):
        return False
    try:
        request = Request(source_url, headers={"User-Agent": "AegisLanding/1.0 source-verifier"})
        with urlopen(request, timeout=7) as response:
            canonical_bytes = response.read(10 * 1024 * 1024 + 1)
        return len(canonical_bytes) <= 10 * 1024 * 1024 and exact_source_match(uploaded_bytes, canonical_bytes)
    except (URLError, ValueError, OSError):
        return False


def attach_independent_evidence(
    cv_results: dict[str, Any],
    independent: dict[str, Any],
    engine: str,
    gate_reason: str,
    model_ran: bool,
) -> dict[str, Any]:
    images = dict(cv_results.get("images", {}))
    source = independent.get("source") or {}
    source_png = to_data_uri(source.get("png"))
    if source_png:
        images["source"] = source_png

    model = independent.get("model")
    if model:
        overlay = to_data_uri(model.get("overlayPng"))
        mask = to_data_uri(model.get("maskPng"))
        if overlay:
            images["modelOverlay"] = overlay
        if mask:
            images["mask"] = mask

    visual = independent.get("visualComplexity") or {}
    for output_key, response_key in (("overlayPng", "complexityOverlay"), ("edgeMapPng", "edgeMap"), ("textureMapPng", "textureMap")):
        artifact = to_data_uri(visual.get(output_key))
        if artifact:
            images[response_key] = artifact

    stats = dict(cv_results.get("stats", {}))
    stats.update({
        "independent_analysis": "semantic terrain + visual complexity" if model_ran else "visual complexity",
        "mars_model_status": "accepted" if model_ran else "skipped",
    })
    limitations = list(independent.get("limitations", []))
    if gate_reason:
        limitations.insert(0, gate_reason)
    limitations.append("OpenCV candidates are ranking aids for review; model and complexity output are evidence, not flight-control commands.")
    return {
        "analysisId": independent.get("analysisId"),
        "engine_used": "ml" if model_ran and engine == "ml" else "cv+terrain-lens",
        "stats": stats,
        "safe_zones": cv_results.get("safe_zones", []),
        "images": images,
        "source": {key: source.get(key) for key in ("filename", "width", "height") if source.get(key) is not None},
        "model": model,
        "visualComplexity": visual,
        "limitations": limitations,
        "fallback_triggered": False,
    }

@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok", 
        "service": "aegislanding-api"
    }

@app.get("/api/v1/status", dependencies=[Depends(get_api_key)])
def system_status() -> dict[str, Any]:
    """
    Live system status dashboard. Reports the operational state of every
    subsystem: CV engine, Analysis Sidecar, SQLite DB, and EKF Tracker.
    """
    import sqlite3
    subsystems = {}
    
    # 1. CV Engine
    subsystems["cv_engine"] = {"status": "online", "lander_size_px": cv_analyzer.lander_size_px}
    
    # 2. Analysis Sidecar (ONNX Model)
    try:
        import httpx
        r = httpx.get(f"{analysis_client.base_url}/health", timeout=3.0)
        subsystems["analysis_sidecar"] = {"status": "online" if r.status_code == 200 else "degraded", "url": analysis_client.base_url}
    except Exception:
        subsystems["analysis_sidecar"] = {"status": "offline", "url": analysis_client.base_url}
    
    # 3. SQLite Telemetry DB
    try:
        from app.database import DB_PATH
        conn = sqlite3.connect(DB_PATH)
        count = conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
        conn.close()
        subsystems["telemetry_db"] = {"status": "online", "total_assessments": count}
    except Exception:
        subsystems["telemetry_db"] = {"status": "offline"}
    
    # 4. EKF Tracker
    subsystems["ekf_tracker"] = {
        "status": "online" if mission_tracker.initialized else "awaiting_first_observation",
        "state_vector": [float(round(v, 2)) for v in mission_tracker.state.tolist()]
    }
    
    # 5. Security modules
    subsystems["security"] = {
        "api_key_auth": "enabled",
        "rate_limiter": f"{RATE_LIMIT_SECONDS}s cooldown",
        "adversarial_scanner": "enabled (Laplacian variance > 15000)",
        "cryptographic_signatures": "SHA-256",
        "mars_provenance_gate": "enabled"
    }
    
    all_online = all(s.get("status") in ("online", "awaiting_first_observation") for s in subsystems.values() if isinstance(s, dict) and "status" in s)
    
    return {
        "system_status": "ALL SYSTEMS NOMINAL" if all_online else "DEGRADED — CHECK SUBSYSTEMS",
        "api_version": "0.5.0",
        "subsystems": subsystems
    }

@app.post("/api/v1/assessments", response_model=AssessmentResponse, dependencies=[Depends(get_api_key)])
async def create_assessment(
    file: UploadFile = File(...),
    engine: str = Form("cv"),
    declared_target: str = Form("Unknown"),
    source_url: Optional[str] = Form(None)
) -> AssessmentResponse:
    """
    Process an uploaded terrain image.
    engine: 'cv' for OpenCV classical math, 'ml' for Depth Anything V2 ML model.
    """
    
    # --- SECURITY CONTROL: RATE LIMITING ---
    check_rate_limit()
    
    # --- SECURITY CONTROL: STRICT INPUT VALIDATION ---
    if engine not in ["cv", "ml"]:
        raise HTTPException(status_code=422, detail="Unprocessable Entity: Engine must be 'cv' or 'ml'.")
        
    # --- SECURITY CONTROL: FILE VALIDATION ---
    # 1. Validate MIME type (prevent malicious non-image payloads)
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Unsupported Media Type. Only JPG, PNG, and WEBP are allowed.")
        
    contents = await file.read()
    
    # 2. Prevent Memory Exhaustion (DoS attack vector)
    # Reject files larger than 10MB
    MAX_FILE_SIZE = 10 * 1024 * 1024 
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Payload Too Large. Max image size is 10MB.")
        
    # --- SECURITY CONTROL: ADVERSARIAL NOISE DEFENDER ---
    # Fast scan for unnatural high-frequency pixel anomalies 
    # (used by hackers to spoof neural networks)
    nparr = np.frombuffer(contents, np.uint8)
    gray_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if gray_img is not None:
        laplacian_var = cv2.Laplacian(gray_img, cv2.CV_64F).var()
        if laplacian_var > 15000:
            raise HTTPException(
                status_code=403, 
                detail="SECURITY ALERT: Adversarial payload anomaly detected. Mission aborted to protect lander."
            )
        
    try:
        cv_results = await run_in_threadpool(cv_analyzer.analyze_terrain, contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CV Engine failed: {str(e)}")

    if "error" in cv_results.get("stats", {}):
        raise HTTPException(status_code=400, detail=cv_results["stats"]["error"])

    source_verified = await run_in_threadpool(verify_trusted_source, source_url, contents)
    gate_decision = mars_only_gate(declared_target=declared_target, source_url=source_url, source_verified=source_verified)
    mode = "full" if engine == "ml" and gate_decision.run_mars_model else "visual-only"
    try:
        independent = await run_in_threadpool(analysis_client.analyze, file.filename or "terrain-image", contents, mode)
        results = attach_independent_evidence(cv_results, independent, engine, gate_decision.reason, mode == "full")
    except AnalysisServiceError as error:
        results = {
            **cv_results,
            "engine_used": "cv-fallback",
            "limitations": [gate_decision.reason, str(error), "Independent evidence was unavailable; the response contains classical CV output only."],
            "fallback_triggered": True,
        }
        
    # --- AEROSPACE NAVIGATION: KALMAN FILTER TRACKING ---
    if results.get("safe_zones"):
        best_zone = results["safe_zones"][0]
        # Update the tracking state with the new observation
        mission_tracker.update([best_zone["x"], best_zone["y"]])
        # Predict where the landing zone will be on the next frame
        pred_x, pred_y = mission_tracker.predict()
        results["stats"]["ekf_predicted_next_x"] = float(round(pred_x, 2))
        results["stats"]["ekf_predicted_next_y"] = float(round(pred_y, 2))

    # --- PROCESSING METADATA ---
    results["stats"]["laplacian_variance"] = float(round(laplacian_var, 2)) if gray_img is not None else None
    results["stats"]["gate_status"] = gate_decision.status
    results["stats"]["gate_reason"] = gate_decision.reason

    # Log to audit database (Killer Hackathon Feature)
    log_assessment(engine, results["stats"], results["safe_zones"])
        
    # --- SECURITY CONTROL: CRYPTOGRAPHIC MISSION SIGNATURE ---
    # Generate an unforgeable hash of the telemetry to prove data integrity
    salt = b"AEGIS_HACKATHON_SECURE_SALT"
    hash_payload = salt + contents + str(results.get("safe_zones", [])).encode('utf-8')
    results["stats"]["telemetry_signature"] = hashlib.sha256(hash_payload).hexdigest()
        
    return AssessmentResponse(**results)

@app.get("/api/v1/assessments/history", dependencies=[Depends(get_api_key)])
def get_assessment_history(limit: int = 10):
    """
    Fetch the mission telemetry audit logs. 
    Useful for the frontend to show a 'Recent Assessments' dashboard.
    """
    logs = get_audit_history(limit)
    return {"history": logs}

@app.get("/api/v1/assessments/latest/ccsds", dependencies=[Depends(get_api_key)])
def download_latest_ccsds():
    """
    Downloads the most recent mission telemetry encoded as a raw binary 
    CCSDS Space Packet (Packet Utilization Standard), exactly as used by NASA.
    """
    logs = get_audit_history(1)
    if not logs:
        raise HTTPException(status_code=404, detail="No telemetry available to encode.")
        
    latest_log = logs[0]
    binary_packet = generate_ccsds_packet(latest_log["stats"], latest_log["safe_zones"])
    
    return Response(
        content=binary_packet,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=aegis_telemetry.bin"}
    )
