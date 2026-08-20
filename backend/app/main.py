from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(
    title="AegisLanding API",
    version="0.1.0",
    description="Starter API for NSIC SW08 AI-Based Landing Risk Assessment.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AssessmentRequest(BaseModel):
    scenario_id: str = Field(default="demo", min_length=1, max_length=100)
    candidate_zones: list[dict[str, Any]] = Field(default_factory=list)


class AssessmentResponse(BaseModel):
    assessment_id: str
    candidate_zones: list[dict[str, Any]]
    recommended_zone_id: str | None = None
    overall_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    explanations: list[str] = Field(default_factory=list)
    data_quality: dict[str, Any] = Field(default_factory=dict)
    model_version: str = "unimplemented"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "aegislanding-api"}


@app.post("/api/v1/assessments", response_model=AssessmentResponse)
def create_assessment(payload: AssessmentRequest) -> AssessmentResponse:
    """Return a deliberately unimplemented contract until the team chooses its model.

    Keeping this endpoint deterministic makes frontend work possible before the
    data and model choices are finalized during the hackathon.
    """

    return AssessmentResponse(
        assessment_id=f"{payload.scenario_id}-starter",
        candidate_zones=payload.candidate_zones,
        explanations=[
            "Assessment logic is intentionally not implemented in the starter.",
            "Add validated terrain features and a documented risk model here.",
        ],
    )
