@echo off
echo ===================================================
echo 🚀 AEGIS LANDING - LOCAL HOST BOOT SEQUENCE
echo ===================================================

echo [1/3] Starting Prajwal's Backend (FastAPI on Port 8000)...
start "Backend (FastAPI)" cmd /k "cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload"

echo [2/3] Starting Frontend (React/Vite on Port 5173)...
start "Frontend (React)" cmd /k "cd frontend && npm install && npm run dev"

echo [3/3] Starting ML Cleanroom (Streamlit on Port 8501)...
start "ML Cleanroom (Streamlit)" cmd /k "cd /d C:\Users\prajw\Downloads\depth-scout-cleanroom_extracted\depth-scout-cleanroom && pip install -r requirements.txt && streamlit run app.py"

echo ===================================================
echo ✅ All services are booting up in separate windows!
echo ===================================================
echo 🌍 1. Open your browser to http://localhost:5173 to see the Main Dashboard!
echo 🌍 2. Open your browser to http://localhost:8501 to see the standalone ML AI App!
pause
