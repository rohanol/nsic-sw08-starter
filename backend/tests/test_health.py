from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "aegislanding-api"}


def test_assessment_contract() -> None:
    response = client.post(
        "/api/v1/assessments",
        json={"scenario_id": "demo", "candidate_zones": []},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["assessment_id"] == "demo-starter"
    assert body["model_version"] == "unimplemented"
