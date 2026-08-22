import os

os.environ.setdefault("MISSION_CONTROL_KEY", "test-mission-control-key")
os.environ.setdefault("ANALYSIS_SERVICE_TOKEN", "test-analysis-service-token")

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app import main


client = TestClient(main.app)
HEADERS = {"X-Mission-Control-Key": main.MISSION_CONTROL_KEY}


def make_test_image() -> bytes:
    image = np.full((180, 240, 3), (105, 112, 126), dtype=np.uint8)
    cv2.circle(image, (95, 85), 26, (65, 65, 65), -1)
    cv2.rectangle(image, (150, 112), (164, 126), (40, 40, 40), -1)
    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_assessment_merges_independent_visual_evidence(monkeypatch) -> None:
    main.ip_request_times.clear()
    monkeypatch.setattr(
        main.analysis_client,
        "analyze",
        lambda *_args, **_kwargs: {
            "analysisId": "independent-test-1",
            "source": {"filename": "terrain.png", "width": 240, "height": 180, "png": "c291cmNl"},
            "visualComplexity": {
                "topReviewCells": [{"rank": 1, "row": 0, "column": 2, "score": 0.91, "edgeDensity": 0.7}],
                "overlayPng": "b3ZlcmxheQ==",
                "edgeMapPng": "ZWRnZQ==",
                "textureMapPng": "dGV4dHVyZQ==",
            },
            "limitations": ["Visual-complexity evidence only."],
        },
    )
    response = client.post(
        "/api/v1/assessments",
        headers=HEADERS,
        data={"engine": "cv", "declared_target": "Mars"},
        files={"file": ("terrain.png", make_test_image(), "image/png")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["analysisId"] == "independent-test-1"
    assert body["gate"] == {
        "status": "unknown",
        "reason": "The image is declared as Mars but its source was not verified by the backend. A trusted-looking URL alone cannot authorize the Mars-trained model; generic visual-complexity analysis may run.",
        "runMarsModel": False,
        "runVisualComplexity": True,
    }
    assert body["visualComplexity"]["topReviewCells"][0]["score"] == 0.91
    assert "overlayPng" not in body["visualComplexity"]
    assert body["visualComplexity"]["overlayUrl"].startswith("data:image/png;base64,")
    assert body["images"]["complexityOverlay"].startswith("data:image/png;base64,")
    assert body["safe_zones"]


def test_assessment_requires_mission_key() -> None:
    response = client.post(
        "/api/v1/assessments",
        data={"engine": "cv"},
        files={"file": ("terrain.png", make_test_image(), "image/png")},
    )
    assert response.status_code == 403


def test_trusted_source_verification_rejects_insecure_or_untrusted_urls() -> None:
    assert main.verify_trusted_source("http://mars.nasa.gov/example.jpg", b"image") is False
    assert main.verify_trusted_source("https://example.invalid/terrain.jpg", b"image") is False
