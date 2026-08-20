from typing import Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.cv_engine import CVElevationAnalyzer
from app.ml_engine import MLElevationAnalyzer
from app.database import init_db, log_assessment, get_audit_history

app = FastAPI(
    title="AegisLanding API with Dual Engines",
    version="0.3.0",
    description="Backend API for NSIC SW08 AI-Based Landing Risk Assessment.",
)

# Initialize audit database
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cv_analyzer = CVElevationAnalyzer(lander_size_px=30)
ml_analyzer = MLElevationAnalyzer(lander_size_px=30)

class AssessmentResponse(BaseModel):
    stats: dict[str, Any]
    safe_zones: list[dict[str, Any]]
    images: dict[str, str]

@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok", 
        "service": "aegislanding-api"
    }

@app.post("/api/v1/assessments", response_model=AssessmentResponse)
async def create_assessment(
    file: UploadFile = File(...),
    engine: str = Form("cv")
) -> AssessmentResponse:
    """
    Process an uploaded terrain image.
    engine: 'cv' for OpenCV classical math, 'ml' for Depth Anything V2 ML model.
    """
    contents = await file.read()
    
    if engine == "ml":
        # The AI teammate will implement ml_analyzer.analyze_terrain(contents)
        try:
            results = await run_in_threadpool(ml_analyzer.analyze_terrain, contents)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ML Engine failed: {str(e)}")
    else:
        # Run CV engine in a threadpool to prevent blocking the async event loop
        try:
            results = await run_in_threadpool(cv_analyzer.analyze_terrain, contents)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"CV Engine failed: {str(e)}")
        
    if "error" in results.get("stats", {}):
        raise HTTPException(status_code=400, detail=results["stats"]["error"])
        
    # Log to audit database (Killer Hackathon Feature)
    log_assessment(engine, results["stats"], results["safe_zones"])
        
    return AssessmentResponse(**results)

@app.get("/api/v1/assessments/history")
def get_assessment_history(limit: int = 10):
    """
    Fetch the mission telemetry audit logs. 
    Useful for the frontend to show a 'Recent Assessments' dashboard.
    """
    logs = get_audit_history(limit)
    return {"history": logs}
