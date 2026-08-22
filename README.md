<div align="center">
  <img src="https://img.icons8.com/?size=100&id=t79gB3yC64l4&format=png&color=000000" alt="Space Logo" width="100"/>
  <h1>TerrainLens</h1>
  <p><strong>Cinematic Mars Terrain Evidence and Landing-Risk Assessment</strong></p>
  
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
TerrainLens is a cinematic, scroll-led terrain evidence interface for the AegisLanding backend. It turns Mars surface imagery into a readable mission sequence: scroll-based descent context, upload-driven terrain inspection, visual-complexity review cells, safe-zone candidates, and independent model evidence when the source-provenance gate permits it.

Built for the **NSIC SW08 Hackathon**, this project features a revolutionary **Dual-Engine Architecture** combining classical mathematical models with state-of-the-art Neural Networks.

## ✨ Core Features
- 🧠 **Independent dual analysis:** OpenCV ranks candidate landing zones while the pinned `analysis-tools-for-22` submodule provides ONNX terrain segmentation and visual-complexity evidence.
- 🛡️ **Aerospace redundancy:** If the independent analysis service is unavailable, the API returns the classical CV result with an explicit limitation note rather than silently fabricating model output.
- 🔒 **Cryptographic Telemetry:** Every mission assessment is verified with an unforgeable SHA-256 cryptographic signature to prevent Man-in-the-Middle (MitM) data tampering.
- 🛑 **Adversarial Anti-Spoofing:** Built-in high-frequency Laplacian variance scanners detect and reject synthetic or adversarial payloads designed to fool neural networks.
- 📊 **TerrainLens evidence UI:** The supplied React frontend is now the repository frontend. It is wired to the secure assessment route, converts returned review cells and safe zones into in-scene annotations, and uses portable image/video assets stored under `frontend/public/terrainlens`.

## 🐳 Quickstart (Docker)
The stack runs the FastAPI application alongside the independent Node/ONNX analysis sidecar. The sidecar is built from the pinned `analysis-tools-for-22` submodule; it is not copied or modified inside this repository.

```bash
# Clone the repository
git clone https://github.com/rohanol/nsic-sw08-starter.git
cd nsic-sw08-starter
git submodule update --init --recursive

# Create a deployment-only environment file and replace both placeholder secrets.
cp .env.example .env
# Example on macOS/Linux: openssl rand -hex 32

# Build and run the complete stack.
docker compose up -d --build
```
The public application is available at `http://localhost:8080`. FastAPI and the analysis sidecar remain on the internal Compose network; the Nginx frontend proxy injects the mission-control header so the browser never receives that secret.

> Do not deploy the placeholder values from `.env.example`. Generate distinct, high-entropy values for `MISSION_CONTROL_KEY` and `ANALYSIS_SERVICE_TOKEN`, store them in the deployment platform’s secret manager, and recreate the stack after changing either value.

## 🧩 Independent Model Integration

The `analysis-tools` git submodule supplies the trained MobileNetV3–U-Net ONNX segmentation model and TERRAIN LENS visual-complexity analysis. FastAPI remains responsible for authentication, file validation, Mars-provenance policy, safe-zone recommendations, and auditing. A verified Mars source runs semantic segmentation plus visual complexity; unverified or non-Mars imagery receives visual-complexity evidence without invoking the Mars-trained model. See [`docs/model-service-integration.md`](docs/model-service-integration.md) for the complete boundary and local workflow.

For local development on macOS or Linux, create `.env` from the example, use non-placeholder local values, then run:

```bash
./scripts/run_local.sh
```

## 💻 Local Development
If you prefer not to use Docker, the launch scripts start the Node analysis sidecar, FastAPI API, and React client together. The local scripts pass the key only to the local Vite session; production builds keep it server-side in Nginx.

```bash
# Windows
Double-click launch_hackathon.bat
```

This initializes the model submodule, installs dependencies, and starts the React frontend on port 5173, FastAPI on port 8000, and the internal analysis sidecar on port 8090.

## 🔐 Deployment and Source Verification

The API requires `MISSION_CONTROL_KEY` to start. In production, Nginx receives this key as a container environment variable and injects it only while proxying `/api` to the internal backend. Do not set `VITE_API_KEY` in a production build.

The Mars-trained semantic model runs only when the submitted image bytes exactly match a direct HTTPS image from an approved NASA or JPL domain. The backend rejects redirects outside that allowlist, requires an image MIME type, and applies configurable time and response-size limits. Other uploads still receive generic visual-complexity evidence, clearly labelled as non-semantic analysis.

| Setting | Required | Purpose |
|---|---:|---|
| `MISSION_CONTROL_KEY` | Yes | Authorizes the private FastAPI API. |
| `ANALYSIS_SERVICE_TOKEN` | Yes | Authenticates FastAPI to the internal ONNX sidecar. |
| `CORS_ALLOWED_ORIGINS` | Yes in production | Restricts direct API browser origins. |
| `TRUSTED_SOURCE_TIMEOUT_SECONDS` | No | Limits source verification fetch duration; default is 8 seconds. |
| `TRUSTED_SOURCE_MAX_BYTES` | No | Limits source verification response size; default is 10 MiB. |

## 🤝 The Team
Built with blood, sweat, and code in under 8 hours.
* **Backend & Security Lead:** Orchestrated the FastAPI server, Dockerization, Aerospace Redundancy, and Cryptographic integrations.
* **Frontend Lead:** Engineered the stunning interactive React UI and real-time visualization dashboards.
* **ML Lead:** Packaged and implemented the HuggingFace `Depth Anything V2` models in an offline-capable cleanroom environment.
