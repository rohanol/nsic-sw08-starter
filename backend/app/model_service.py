"""Adapter for the independent Node/ONNX terrain-analysis sidecar.

The sidecar owns the pretrained model runtime. FastAPI retains upload policy,
Mars provenance checks, safe-zone logic, API authorization, and audit logging.
"""

import base64
import os
from typing import Any

import httpx


class AnalysisServiceError(RuntimeError):
    """Raised when the independent analysis service cannot provide a result."""


class AnalysisServiceClient:
    def __init__(self, base_url: str | None = None, timeout_seconds: float = 35.0):
        self.base_url = (base_url or os.getenv("ANALYSIS_SERVICE_URL", "http://localhost:8090")).rstrip("/")
        self.timeout_seconds = timeout_seconds

    def analyze(self, filename: str, image_bytes: bytes, mode: str, columns: int = 6, rows: int = 4) -> dict[str, Any]:
        payload = {
            "filename": filename,
            "imageBase64": base64.b64encode(image_bytes).decode("ascii"),
            "mode": mode,
            "options": {"columns": columns, "rows": rows},
        }
        try:
            response = httpx.post(f"{self.base_url}/analyze", json=payload, timeout=self.timeout_seconds)
        except httpx.HTTPError as exc:
            raise AnalysisServiceError(f"Independent analysis service is unavailable: {exc}") from exc

        if response.status_code >= 400:
            detail = response.json().get("detail", response.text)
            raise AnalysisServiceError(f"Independent analysis service rejected the image: {detail}")
        try:
            return response.json()
        except ValueError as exc:
            raise AnalysisServiceError("Independent analysis service returned invalid JSON.") from exc
