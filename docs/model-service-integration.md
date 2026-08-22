# Independent Model Service Integration

## Purpose

The starter repository owns the public FastAPI API, authorization, upload validation, provenance policy, classical landing-zone recommendations, audit logging, and the React interface. The pretrained `analysis-tools-for-22` repository remains an independent, unmodified git submodule that provides the ONNX terrain segmentation and deterministic visual-complexity logic.

## Runtime boundary

The application runs a small Node.js sidecar named `analysis-service`. It imports the built package from the pinned model submodule, accepts a local JSON request containing an image as base64, and returns JSON-safe base64 artifacts and structured evidence. The FastAPI backend calls this sidecar only over the internal service network; browsers continue to call FastAPI and never access the model service directly.

| Layer | Owns | Does not own |
|---|---|---|
| React frontend | Upload interaction and evidence display | Model runtime or model files |
| FastAPI backend | Authentication, file limits, Mars gate, CV safe zones, audit history, API response | ONNX inference implementation |
| `analysis-service` | Request adaptation and JSON-safe artifact serialization | Public API policy or persistence |
| `analysis-tools` submodule | Pretrained ONNX inference and visual-complexity analysis | Starter-specific code or configuration |

## Request modes

The backend selects `full` only after the Mars provenance gate accepts an uploaded image. It selects `visual-only` for unverified Mars inputs and for non-Mars targets. This preserves the model repository’s scope: visual complexity remains available as generic review evidence, while the Mars-trained semantic model is not applied to unverified or non-Mars imagery.

## Response composition

The FastAPI layer always keeps its OpenCV output as the source for safe-zone recommendations and core landing metrics. When the sidecar succeeds, it appends the independent model’s `source`, semantic mask and overlay, class coverage, visual-complexity artifacts, review cells, limitations, and model metadata to the same response shape already understood by the frontend. A sidecar outage degrades to the existing CV result with a transparent limitation note rather than failing the entire assessment.

## Local and container workflow

The starter repository pins `analysis-tools-for-22` as a git submodule. For local development, initialize the submodule, install and build it with pnpm, then run the Node sidecar and FastAPI backend. Docker Compose builds the sidecar from the root build context so it can include the submodule’s ONNX artifact and its external tensor-data file unchanged.
