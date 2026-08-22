#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git submodule update --init --recursive
corepack enable
ONNXRUNTIME_NODE_INSTALL=skip pnpm --dir analysis-tools install --frozen-lockfile
pnpm --dir analysis-tools build

(cd analysis-service && node server.mjs) &
ANALYSIS_PID=$!
trap 'kill "$ANALYSIS_PID" 2>/dev/null || true' EXIT

python -m pip install -r backend/requirements.txt
(cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

(cd frontend && npm install && npm run dev -- --host 0.0.0.0)
