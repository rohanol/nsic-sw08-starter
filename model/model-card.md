# Model Card — To Be Completed During Hackathon

## Model name

`unimplemented-baseline`

## Intended use

Rank candidate planetary landing zones for a prototype decision-support interface. The output is advisory and must not be represented as a flight-control command or safety certification.

## Inputs

Document the terrain, illumination, hazard, and data-quality features used by the final model. Record units, valid ranges, missing-value behavior, and source provenance.

## Output

The model should return a normalized risk score, confidence or data-quality estimate, ranked candidate zones, and a human-readable explanation tied to the highest-impact features.

## Baseline

Start with a transparent weighted score or rule-based model. Compare any learned model against the baseline and explain why it is better. Do not hide the scoring logic from judges.

## Evaluation plan

Define a small validation set or scenario suite. At minimum, include a clearly safe zone, a clearly unsafe zone, incomplete input, stale input, and contradictory signals. Report limitations honestly.

## Security and reliability

Treat all incoming terrain and telemetry fields as untrusted. Validate schema and ranges, reject malformed values, record dataset and model versions, and test whether small malicious changes can flip the recommendation.

## Limitations

Complete this section after the team chooses its data and model. Include assumptions about terrain resolution, synthetic data, transferability across planetary bodies, label quality, and uncertainty.
