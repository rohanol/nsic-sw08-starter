# Depth Scout — Relative-Depth Source Archive

## What this archive contains

`depth-scout-relative-depth-source.zip` contains the source code for a fresh, standalone Streamlit prototype called **Depth Scout**. It includes a local-inference adapter, a future backend API adapter, an API contract, attribution, tests, interface-level limitations, and a drop-in `integration/aegislanding_ml_engine.py` module for the existing AegisLanding `engine=ml` backend route. It does not contain MARSBOUND source code, MARSBOUND model weights, MARSBOUND assets, or a Mars-trained checkpoint.

| Field | Disclosure |
|---|---|
| Public model identifier | `depth-anything/Depth-Anything-V2-Small-hf` |
| Model role | Exploratory monocular **relative-depth** visualization |
| Model license | Apache-2.0 |
| Model source | [Official Hugging Face model card](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf) |
| Original project | [Depth Anything V2 official repository](https://github.com/DepthAnything/Depth-Anything-V2) |
| App source license | MIT, as included in the archive |
| Archive checksum (SHA-256) | `6a75c853d9cb467c35e6aee4e35b13245cf7da99b3b5e2f0a009a63198058524` |

## Required boundary

> The public checkpoint output is a relative-depth visualization. It is **not** a Mars-calibrated measurement of elevation, distance, slope, terrain class, obstacle likelihood, landing risk, or landing safety. The prototype must not be represented as flight-certified software.

The application uses the unmodified public Small checkpoint locally. It does not train or fine-tune it. Its `BackendDepthClient` and `API_CONTRACT.md` document how a future backend can expose the same `POST /v1/relative-depth` interface without changing the frontend display layer. The archive also includes `INTEGRATION_AEGISLANDING.md`, `requirements-backend.txt`, and the drop-in ML-engine module for the target repository’s existing `POST /api/v1/assessments` flow.

## NSIC note

Before using this public pre-trained checkpoint in NSIC, obtain written organizer confirmation that fully attributed pre-trained weights are permitted. The existing model card in this repository remains the team’s event-specific assessment template and should not be replaced by this archive.

## References

[1] [Depth Anything V2 Small official model card](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf)

[2] [Depth Anything V2 official repository](https://github.com/DepthAnything/Depth-Anything-V2)
