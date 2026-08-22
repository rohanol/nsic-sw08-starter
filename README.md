<div align="center">
  <img src="https://img.icons8.com/?size=100&id=t79gB3yC64l4&format=png&color=000000" alt="Space Logo" width="100"/>
  <h1>🚀 AegisLanding</h1>
  <p><strong>Dual-Engine Planetary Landing Risk Assessment System</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
    <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV"/>
    <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch"/>
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  </p>
</div>

---

## 🌌 Overview
AegisLanding is an edge-compute hazard detection system designed for autonomous spacecraft. When approaching a planetary body (like Mars), the lander captures overhead imagery and instantly calculates the safest landing zones by analyzing craters, rocks, and surface roughness.

Built for the **NSIC SW08 Hackathon**, this project features a revolutionary **Dual-Engine Architecture** combining classical mathematical models with state-of-the-art Neural Networks.

## ✨ Core Features
- 🧠 **Dual-Engine Compute:** Choose between the hyper-fast OpenCV classical math engine, or the cutting-edge `Depth Anything V2` Machine Learning engine.
- 🛡️ **Aerospace Redundancy:** If the primary ML sensor crashes or fails during descent, the backend automatically intercepts the failure and falls back to the classical CV engine, saving the mission.
- 🔒 **Cryptographic Telemetry:** Every mission assessment is verified with an unforgeable SHA-256 cryptographic signature to prevent Man-in-the-Middle (MitM) data tampering.
- 🛑 **Adversarial Anti-Spoofing:** Built-in high-frequency Laplacian variance scanners detect and reject synthetic or adversarial payloads designed to fool neural networks.
- 📊 **Real-Time Dashboards:** A fully responsive React interface providing visual heatmaps, risk metrics, and annotated safe zones.

## 🐳 Quickstart (Docker)
The stack runs the FastAPI application alongside the independent Node/ONNX analysis sidecar. The sidecar is built from the pinned `analysis-tools-for-22` submodule; it is not copied or modified inside this repository.

```bash
# Clone the repository
git clone https://github.com/rohanol/nsic-sw08-starter.git
cd nsic-sw08-starter
git submodule update --init --recursive

# Boot up the backend API using Docker Compose
docker-compose up -d --build
```
*The backend API will now be live on `http://localhost:8000`, while the internal terrain-analysis sidecar listens on `http://localhost:8090` for development diagnostics.*

## 🧩 Independent Model Integration

The `analysis-tools` git submodule supplies the trained MobileNetV3–U-Net ONNX segmentation model and TERRAIN LENS visual-complexity analysis. FastAPI remains responsible for authentication, file validation, Mars-provenance policy, safe-zone recommendations, and auditing. A verified Mars source runs semantic segmentation plus visual complexity; unverified or non-Mars imagery receives visual-complexity evidence without invoking the Mars-trained model. See [`docs/model-service-integration.md`](docs/model-service-integration.md) for the complete boundary and local workflow.

For local development on macOS or Linux, run:

```bash
./scripts/run_local.sh
```

## 💻 Local Development
If you prefer not to use Docker, you can run the entire stack locally using our quick-launch script:

```bash
# Windows
Double-click launch_hackathon.bat
```

This will automatically install `npm` and `pip` dependencies and boot both the React Frontend (Port 5173) and the FastAPI Backend (Port 8000).

## 🛰️ API Security Protocol
All API requests require the Mission Control Authorization Header:
```http
X-Mission-Control-Key: aegis-hackathon-2026-secure-key
```

## 🤝 The Team
Built with blood, sweat, and code in under 8 hours.
* **Backend & Security Lead:** Orchestrated the FastAPI server, Dockerization, Aerospace Redundancy, and Cryptographic integrations.
* **Frontend Lead:** Engineered the stunning interactive React UI and real-time visualization dashboards.
* **ML Lead:** Packaged and implemented the HuggingFace `Depth Anything V2` models in an offline-capable cleanroom environment.
