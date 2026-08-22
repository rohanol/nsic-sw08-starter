#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and set secure local values before running the stack." >&2
  exit 1
fi
set -a
source .env
set +a

git submodule update --init --recursive
corepack enable
ONNXRUNTIME_NODE_INSTALL=skip pnpm --dir analysis-tools install --frozen-lockfile
pnpm --dir analysis-tools build

(cd analysis-service && PORT=8090 node server.mjs) &
ANALYSIS_PID=$!
trap 'kill "$ANALYSIS_PID" 2>/dev/null || true' EXIT

python -m pip install -r backend/requirements.txt
(cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

(cd frontend && VITE_API_BASE_URL="http://localhost:8000" VITE_API_KEY="$MISSION_CONTROL_KEY" npm install && npm run dev -- --host 0.0.0.0)
