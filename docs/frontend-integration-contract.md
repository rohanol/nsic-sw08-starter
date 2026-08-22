# AegisLanding frontend integration contract

The frontend lives under `frontend/` and is intentionally compatible with the current starter API as well as the richer response planned by `analysis-tools-for-22`.

## Current endpoint

The page sends a multipart `POST /api/v1/assessments` request with the `X-Mission-Control-Key` header. The form fields are:

| Field | Value | When sent |
|---|---|---|
| `file` | JPG, PNG, or WEBP image | Always |
| `engine` | `cv` or `ml` | Always |
| `declared_target` | `Mars`, `Earth`, `Moon`, or `Unknown` | Always; most important for ML |
| `source_url` | Optional URL string | When entered; most important for ML provenance |

The history panel reads `GET /api/v1/assessments/history?limit=5` with the same header.

## Current response shape

The existing CV/ML backend response is accepted as:

```json
{
  "stats": {
    "craters_detected": 0,
    "rocks_detected": 0,
    "shadowed_regions": 0,
    "global_roughness_index": 0
  },
  "safe_zones": [
    { "id": "LZ-1", "x": 100, "y": 120, "area": 500, "avg_risk": 0.18 }
  ],
  "images": {
    "annotated": "data:image/jpeg;base64,...",
    "heatmap": "data:image/jpeg;base64,..."
  }
}
```

## Future analysis-tools response

`frontend/src/App.tsx` normalizes optional analysis-tool fields without requiring a backend migration. The following fields are recognized:

| Analysis output | Frontend surface |
|---|---|
| `source.png` or `images.source` | Source image tab |
| `model.overlayPng` / `model.overlay` | Model overlay tab |
| `model.maskPng` / `model.mask` | Terrain mask tab |
| `model.classCoverage` / `model.class_coverage` | Terrain evidence coverage bars |
| `visualComplexity.overlayPng` / `visualComplexity.overlay` | Complexity grid tab |
| `visualComplexity.edgeMapPng` / `visualComplexity.edge_map` | Edge map tab |
| `visualComplexity.textureMapPng` / `visualComplexity.texture_map` | Texture map tab |
| `visualComplexity.topReviewCells` / `visual_complexity.top_review_cells` | Visual complexity review-cell cards |
| `limitations` | Interpretation notes banner |
| `analysisId` / `analysis_id` | Stored in the normalized client model for future audit display |

Image values may be data URLs, regular URLs, root-relative paths, or raw base64 strings. The normalizer converts raw base64 values to PNG data URLs.

## Frontend states

The page includes empty, loading, success, error, offline-history, demo, and no-image states. `Load demo` is a local UI preview only and never calls the backend. It is explicitly labeled as non-mission data.

When the model teammate pushes the analysis tool, the expected integration is to adapt the richer package response into the existing API response or return the richer response directly. No UI rewrite should be necessary as long as the field names remain compatible with the table above.
