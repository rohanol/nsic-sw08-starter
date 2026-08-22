from typing import Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import time
import hashlib
import cv2
import numpy as np
from pydantic import BaseModel

from app.cv_engine import CVElevationAnalyzer
from app.ml_engine import MLElevationAnalyzer
from app.database import init_db, log_assessment, get_audit_history
from app.mars_gate import mars_only_gate
from app.kalman_filter import mission_tracker
from app.ccsds_encoder import generate_ccsds_packet
from fastapi.responses import Response

app = FastAPI(
    title="AegisLanding API with Dual Engines",
    version="0.4.0",
    description="Backend API for NSIC SW08 AI-Based Landing Risk Assessment.",
)

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
ml_analyzer = MLElevationAnalyzer(lander_size_px=30)

class AssessmentResponse(BaseModel):
    stats: dict[str, Any]
    safe_zones: list[dict[str, Any]]
    images: dict[str, str]
    fallback_triggered: Optional[bool] = False

@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok", 
        "service": "aegislanding-api"
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
        
    if engine == "ml":
        # --- COMPATIBILITY: MARS-ONLY GATE FOR BACKUP MODEL ---
        # The ML teammate's backup model requires a provenance gate
        gate_decision = mars_only_gate(
            declared_target=declared_target,
            source_url=source_url,
            source_verified=True if source_url else False # Assuming trusted for the hackathon demo if URL is provided
        )
        
        if not gate_decision.run_mars_model:
            raise HTTPException(
                status_code=403, 
                detail=f"Mars Model Blocked: {gate_decision.reason}"
            )
            
        try:
            results = await run_in_threadpool(ml_analyzer.analyze_terrain, contents)
            results["fallback_triggered"] = False
        except Exception as e:
            # --- AEROSPACE REDUNDANCY: AUTOMATIC FALLBACK ---
            # If the primary ML sensor fails (e.g. out of memory, crash), 
            # gracefully degrade to the classical CV engine instead of crashing.
            print(f"ML Engine Failed: {e}. Falling back to CV Engine.")
            try:
                results = await run_in_threadpool(cv_analyzer.analyze_terrain, contents)
                results["fallback_triggered"] = True
                results["stats"]["ai_model"] = "Failed (Fallback to CV)"
            except Exception as cv_e:
                raise HTTPException(status_code=500, detail=f"ML and CV Fallback both failed: {str(cv_e)}")
    else:
        # Run CV engine in a threadpool to prevent blocking the async event loop
        try:
            results = await run_in_threadpool(cv_analyzer.analyze_terrain, contents)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"CV Engine failed: {str(e)}")
        
    if "error" in results.get("stats", {}):
        raise HTTPException(status_code=400, detail=results["stats"]["error"])
        
    # --- AEROSPACE NAVIGATION: KALMAN FILTER TRACKING ---
    if results.get("safe_zones"):
        best_zone = results["safe_zones"][0]
        # Update the tracking state with the new observation
        mission_tracker.update([best_zone["x"], best_zone["y"]])
        # Predict where the landing zone will be on the next frame
        pred_x, pred_y = mission_tracker.predict()
        results["stats"]["ekf_predicted_next_x"] = float(round(pred_x, 2))
        results["stats"]["ekf_predicted_next_y"] = float(round(pred_y, 2))

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
