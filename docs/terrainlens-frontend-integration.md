# TerrainLens Frontend Integration

## Replacement boundary

The legacy dashboard frontend has been replaced by the supplied TerrainLens scroll experience. The production entry point is `frontend/src/App.tsx`, and the matching visual system is `frontend/src/styles.css`. The former dashboard layout is not part of the deployed interface.

## Backend contract

TerrainLens sends uploaded JPG, PNG, or WEBP terrain frames to `POST /api/v1/assessments` through the existing same-origin `/api` proxy. It renders returned `safe_zones`, `stats`, `images`, `visualComplexity.topReviewCells`, optional `model.classCoverage`, and `limitations` as mission evidence. The model toggle exposes the verified-source URL field; the source-provenance policy remains enforced exclusively by FastAPI.

## Static media

All visual material required by the supplied interface is committed under `frontend/public/terrainlens`. This makes the experience portable to Docker and third-party hosting rather than depending on the original managed-preview storage paths.

## Dry run

The browser-facing `/api` proxy was tested from the TerrainLens frontend with the bundled terrain image. The assessment returned HTTP 200, three safe-zone candidates, visual-complexity evidence, and the expected provenance-gated semantic-model status.
