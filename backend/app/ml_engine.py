import io
import base64
from typing import Dict, Any
import numpy as np
import cv2
from PIL import Image

try:
    from transformers import pipeline
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

class MLElevationAnalyzer:
    """
    Machine Learning based planetary terrain analyzer using Depth Anything V2.
    """
    
    def __init__(self, lander_size_px=30):
        self.lander_size = lander_size_px
        self._pipeline = None
        
    def _get_pipeline(self):
        if self._pipeline is None and ML_AVAILABLE:
            self._pipeline = pipeline(task="depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
        return self._pipeline
            
    def analyze_terrain(self, image_bytes: bytes) -> Dict[str, Any]:
        if not ML_AVAILABLE:
            return {"stats": {"error": "ML dependencies not installed."}, "safe_zones": [], "images": {}}
            
        pipe = self._get_pipeline()
        if not pipe:
            return {"stats": {"error": "Failed to load ML model."}, "safe_zones": [], "images": {}}
            
        # Decode image using PIL
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # --- PERFORMANCE OPTIMIZATION ---
        MAX_WIDTH = 1600
        if img.width > MAX_WIDTH:
            scale = MAX_WIDTH / img.width
            img = img.resize((MAX_WIDTH, int(img.height * scale)), Image.Resampling.LANCZOS)
            
        # 1. AI Inference (Depth map)
        prediction = pipe(img)
        depth_img = prediction["depth"]
        depth_array = np.array(depth_img, dtype=np.float32)
        
        # 2. Calculate Slope (Gradient of depth)
        gx, gy = np.gradient(depth_array)
        slope = np.sqrt(gx**2 + gy**2)
        
        # Normalize slope to 0-100 risk map
        max_slope = np.max(slope)
        if max_slope == 0:
            max_slope = 1
        risk_map = (slope / max_slope) * 100
        
        # 3. Find Safe Zone (Flattest Area)
        blurred_risk = cv2.GaussianBlur(risk_map, (self.lander_size*2+1, self.lander_size*2+1), 0)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(blurred_risk)
        
        safe_zones = [{
            "id": "LZ-ML-1",
            "x": min_loc[0],
            "y": min_loc[1],
            "area": self.lander_size ** 2,
            "avg_risk": round(min_val / 100.0, 2)
        }]
        
        # 4. Visualization
        # Convert risk map to color heatmap
        heatmap_img = cv2.applyColorMap(np.uint8((risk_map/100)*255), cv2.COLORMAP_JET)
        
        # Draw crosshair on target
        cv2.drawMarker(heatmap_img, min_loc, (0, 255, 0), cv2.MARKER_CROSS, 20, 2)
        cv2.circle(heatmap_img, min_loc, self.lander_size, (0, 255, 0), 2)
        
        # Also annotated original image
        annotated_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        cv2.drawMarker(annotated_img, min_loc, (0, 255, 0), cv2.MARKER_CROSS, 20, 2)
        cv2.circle(annotated_img, min_loc, self.lander_size, (0, 255, 0), 2)
        
        # Encode to Base64
        _, enc_ann = cv2.imencode('.jpg', annotated_img)
        _, enc_heat = cv2.imencode('.jpg', heatmap_img)
        
        return {
            "stats": {
                "craters_detected": "N/A (AI Mode)",
                "rocks_detected": "N/A (AI Mode)",
                "global_roughness_index": float(round(np.mean(risk_map), 2)),
                "ai_model": "Depth Anything V2 Small"
            },
            "safe_zones": safe_zones,
            "images": {
                "annotated": f"data:image/jpeg;base64,{base64.b64encode(enc_ann).decode('utf-8')}",
                "heatmap": f"data:image/jpeg;base64,{base64.b64encode(enc_heat).decode('utf-8')}"
            }
        }
