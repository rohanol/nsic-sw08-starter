import io
import base64
import numpy as np
import cv2
from PIL import Image
from typing import Dict, Any

try:
    from transformers import pipeline
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

class MLElevationAnalyzer:
    """
    Machine Learning based planetary terrain analyzer using Depth Anything V2.
    Estimates relative relief and depth from a 2D image to identify slopes and safe zones.
    """
    
    def __init__(self, lander_size_px=30):
        self.lander_size = lander_size_px
        self.pipe = None
        if ML_AVAILABLE:
            # We initialize lazily to save memory if only CV mode is used
            pass
            
    def _load_model(self):
        if not self.pipe:
            print("Loading Depth Anything V2 model... this may take a moment.")
            # Using the official v2 small model from HF
            self.pipe = pipeline(task="depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
            
    def analyze_terrain(self, image_bytes: bytes) -> Dict[str, Any]:
        if not ML_AVAILABLE:
            raise RuntimeError("Transformers library not installed. ML mode unavailable.")
            
        self._load_model()
        
        # Load image via PIL
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        
        # Run Depth Estimation
        result = self.pipe(image)
        depth_map_pil = result["depth"]
        
        # Convert PIL Depth Map to OpenCV format (numpy array)
        depth_map = np.array(depth_map_pil)
        
        # The depth map gives relative depth. We can calculate slope from this.
        # Compute gradient (slope) using Sobel derivatives on the depth map
        grad_x = cv2.Sobel(depth_map, cv2.CV_64F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(depth_map, cv2.CV_64F, 0, 1, ksize=3)
        slope_map = cv2.magnitude(grad_x, grad_y)
        
        # Normalize slope map to 0-100 risk scale
        slope_normalized = cv2.normalize(slope_map, None, 0, 100, cv2.NORM_MINMAX)
        risk_map = np.float32(slope_normalized)
        
        # Find safe zones (areas with lowest slope/risk)
        safe_mask = np.uint8(risk_map < 20) * 255
        
        # Erode the safe mask to fit the lander
        kernel_size = self.lander_size
        erosion_kernel = np.ones((kernel_size, kernel_size), np.uint8)
        safe_landable = cv2.erode(safe_mask, erosion_kernel, iterations=1)
        
        safe_contours, _ = cv2.findContours(safe_landable, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        safe_contours = sorted(safe_contours, key=cv2.contourArea, reverse=True)
        
        safe_zones = []
        for i, cnt in enumerate(safe_contours[:3]):
            M = cv2.moments(cnt)
            if M['m00'] != 0:
                cx = int(M['m10']/M['m00'])
                cy = int(M['m01']/M['m00'])
                safe_zones.append({
                    "id": f"LZ-ML-{i+1}",
                    "x": cx,
                    "y": cy,
                    "area": float(cv2.contourArea(cnt)),
                    "avg_risk": float(np.mean(risk_map[cy-5:cy+5, cx-5:cx+5]))
                })
                
        # Generate Annotated Image
        # Convert original image to cv2 format
        annotated_img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Draw Safe Zones
        for sz in safe_zones:
            cv2.circle(annotated_img, (sz['x'], sz['y']), self.lander_size//2, (0, 255, 0), 2)
            cv2.putText(annotated_img, sz['id'], (sz['x']+10, sz['y']-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
        # Encode images to base64
        _, buffer = cv2.imencode('.jpg', annotated_img)
        encoded_img = base64.b64encode(buffer).decode('utf-8')
        
        # Create heatmap from risk map
        heatmap_colored = cv2.applyColorMap(np.uint8(risk_map * 2.55), cv2.COLORMAP_JET)
        _, heat_buffer = cv2.imencode('.jpg', heatmap_colored)
        encoded_heatmap = base64.b64encode(heat_buffer).decode('utf-8')
        
        # Also send back the pure depth map visually
        depth_colored = cv2.applyColorMap(depth_map, cv2.COLORMAP_INFERNO)
        _, depth_buffer = cv2.imencode('.jpg', depth_colored)
        encoded_depth = base64.b64encode(depth_buffer).decode('utf-8')

        return {
            "stats": {
                "craters_detected": "N/A (ML Mode)",
                "rocks_detected": "N/A (ML Mode)",
                "global_roughness_index": round(np.mean(slope_map), 2)
            },
            "safe_zones": safe_zones,
            "images": {
                "annotated": f"data:image/jpeg;base64,{encoded_img}",
                "heatmap": f"data:image/jpeg;base64,{encoded_heatmap}",
                "depth_map": f"data:image/jpeg;base64,{encoded_depth}"
            }
        }
