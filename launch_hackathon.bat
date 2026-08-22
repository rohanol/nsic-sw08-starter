@echo off
setlocal EnableDelayedExpansion

if not exist .env (
  echo Missing .env. Copy .env.example to .env and set non-placeholder local secrets first.
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if not "%%A"=="" if not "%%A:~0,1"=="#" set "%%A=%%B"
)

if "%MISSION_CONTROL_KEY%"=="" (
  echo MISSION_CONTROL_KEY is required in .env.
  exit /b 1
)
if "%ANALYSIS_SERVICE_TOKEN%"=="" (
  echo ANALYSIS_SERVICE_TOKEN is required in .env.
  exit /b 1
)

echo ===================================================
echo AEGIS LANDING - LOCAL HOST BOOT SEQUENCE
echo ===================================================

echo [1/3] Preparing the independent ONNX analysis sidecar...
git submodule update --init --recursive
start "Analysis Sidecar" cmd /k "call corepack enable && cd analysis-tools && call pnpm install --frozen-lockfile && call pnpm build && cd ..\analysis-service && set PORT=8090 && node server.mjs"

echo [2/3] Starting FastAPI on port 8000...
start "Backend (FastAPI)" cmd /k "cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload"

echo [3/3] Starting React on port 5173...
start "Frontend (React)" cmd /k "cd frontend && set VITE_API_BASE_URL=http://localhost:8000 && set VITE_API_KEY=%MISSION_CONTROL_KEY% && npm install && npm run dev"

echo Open http://localhost:5173 once all three windows report ready.
pause
