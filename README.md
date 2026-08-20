# AegisLanding — NSIC SW08 Starter

A clean starter repository for the **National Space Innovation Challenge (NSIC) — SW08: AI-Based Landing Risk Assessment**.

> This repository is an original development scaffold, not a completed hackathon solution. The team should implement and validate its own model, data pipeline, risk logic, and interface during the event in accordance with the NSIC rulebook.

## Problem scope

Build a decision-support system that analyzes planetary terrain and environmental hazards, calculates landing-risk scores, and recommends safer landing zones. The prototype should be able to explain the factors behind each recommendation.

The initial scaffold separates the project into a frontend dashboard, a small backend API, model and data workspaces, tests, documentation, and presentation deliverables.

## Repository layout

```text
.
├── backend/                 # FastAPI service and API tests
│   ├── app/
│   │   └── main.py
│   ├── tests/
│   │   └── test_health.py
│   └── requirements.txt
├── data/                    # Dataset documentation and local-only data files
├── docs/                    # Scope, architecture, threat model, and judging notes
├── frontend/                # Vite + React + TypeScript dashboard scaffold
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json
├── model/                   # Model contract and feature-design workspace
├── notebooks/               # Exploratory analysis notebooks; keep large outputs out of Git
├── .env.example
├── .gitignore
└── README.md
```

## Local setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Health check: `http://localhost:8000/health`. API documentation: `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` by default. Set `VITE_API_BASE_URL` if the backend runs elsewhere.

## Suggested implementation order during the hackathon

1. Agree on the terrain representation and the smallest demonstrable landing scenario.
2. Add a reproducible data-loading path and document every external dataset and license.
3. Implement hazard features and a baseline risk score before attempting a more advanced model.
4. Add a safe-zone recommendation endpoint with confidence and explanation fields.
5. Connect the dashboard to the API and show the map, hazard layers, scores, and recommendation rationale.
6. Add adversarial-input tests, input validation, audit logging, and a deterministic offline demo path.
7. Rehearse the live demonstration and keep a backup dataset and local build.

## API contract target

The planned assessment response should expose the following concepts:

```json
{
  "assessment_id": "demo-001",
  "candidate_zones": [],
  "recommended_zone_id": null,
  "overall_confidence": null,
  "explanations": [],
  "data_quality": {},
  "model_version": "unimplemented"
}
```

The exact schema may change as the team learns more about the selected data and model. Keep the backend contract stable enough that the frontend can be developed independently.

## Security and originality checklist

Use AI coding assistants only as development aids, and review every generated change. Do not copy a complete existing solution or repository. Keep the Git history, attribute open-source dependencies, and ensure every team member can explain the submitted code.

For a cybersecurity angle, treat terrain and sensor inputs as untrusted. Validate ranges and formats, detect missing or stale data, record model and dataset versions, and make the recommendation explainable. Do not present the prototype as flight-certified software.

## Team collaboration

Use short branches such as `feature/data-contract`, `feature/risk-baseline`, and `feature/dashboard`. Open pull requests for meaningful changes, keep commits small, and run backend tests before merging. Put secrets only in local `.env` files; never commit API keys or personal credentials.

## NSIC reference

- Problem code: `SW08`
- Event: National Space Innovation Challenge
- Official event page: https://spaceaxpo.axsx.in/events/nsic
- Official rulebook: https://spaceaxpo.axsx.in/documents/NSIC_Rulebook.pdf

## License

This starter scaffold is provided for the participating team to extend. Add a project license only after the team agrees on the intended terms and checks compatibility with every external dataset and dependency used.
