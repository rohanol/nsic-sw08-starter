# AegisLanding Project Plan

## Working objective

Create an explainable landing-risk decision-support prototype for NSIC problem statement SW08. The prototype should compare candidate zones, surface hazards, produce a recommendation, and show the evidence behind that recommendation.

## MVP boundaries

The minimum viable demo should include one terrain scenario, three or more candidate zones, at least three hazard features, a baseline risk calculation, a recommendation, a confidence or data-quality indicator, and a visible explanation. It should run locally without internet during the final demonstration.

The team should not attempt a flight-certified model, a fully autonomous landing controller, a planetary-scale data pipeline, or a production-grade remote-sensing platform within the hackathon window.

## Suggested workstreams

| Workstream | First milestone | Evidence for judges |
|---|---|---|
| Data | One documented terrain scenario with reproducible features | Dataset provenance, units, missing-data handling |
| Model | Baseline risk score and zone ranking | Formula or model card, sample calculation, test cases |
| Interface | Map-like zone view and comparison table | Clear recommendation and visual explanation |
| Security/reliability | Input validation, stale-data check, audit trail | Rejected invalid input and traceable assessment |
| Presentation | Six-minute live flow and backup recording | Coherent problem-to-result narrative |

## Model contract

Every assessment should record the scenario identifier, candidate-zone identifier, input feature values, risk score, confidence or data quality, model version, timestamp, and explanation. This makes results reproducible and lets the team compare model iterations without hiding changes.

## Suggested risk features

Choose features that can be justified by the data actually available to the team. Possible features include slope, roughness, rock density, crater proximity, illumination stability, and data freshness. Normalize them explicitly, document the direction of risk, and keep the baseline calculation simple enough to explain on a whiteboard.

## Definition of done

The project is ready for judging when a clean checkout can start the backend and frontend, the demo scenario can be reset, one assessment can be run end-to-end, the recommendation rationale is visible, invalid or stale input produces a safe error, tests pass, and the source repository contains no secrets or unexplained copied code.
