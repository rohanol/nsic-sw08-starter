from typing import Any, Optional

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.cv_engine import CVElevationAnalyzer
from app.ml_engine import MLElevationAnalyzer, ML_AVAILABLE

app = FastAPI(
    title="AegisLanding API with Dual Engines",
    version="0.3.0",
    description="Backend API for NSIC SW08 AI-Based Landing Risk Assessment.",
)

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
        "service": "aegislanding-api",
        "ml_available": ML_AVAILABLE
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
        if not ML_AVAILABLE:
            return AssessmentResponse(
                stats={"error": "ML dependencies not installed on server."},
                safe_zones=[],
                images={}
            )
        results = ml_analyzer.analyze_terrain(contents)
    else:
        # Default to CV engine
        results = cv_analyzer.analyze_terrain(contents)
        
    return AssessmentResponse(**results)
