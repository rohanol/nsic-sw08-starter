import cv2
import numpy as np
import base64
from typing import Dict, Any

class CVElevationAnalyzer:
    """
    OpenCV-based planetary terrain analyzer.
    Extracts features like craters, rocks, and calculates slope and roughness
    from an overhead terrain image to determine landing risk.
    """
    
    def __init__(self, lander_size_px=20):
        self.lander_size = lander_size_px
        
    def analyze_terrain(self, image_bytes: bytes) -> Dict[str, Any]:
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Invalid image provided")
            
        # --- ADVERSARIAL ROBUSTNESS CHECK ---
        # Hackathon killer feature: Ensure the data is actual telemetry
        if img.shape[0] < 100 or img.shape[1] < 100:
            return {"stats": {"error": "Image resolution too low for safe analysis."}, "safe_zones": [], "images": {}}
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Check if image is completely pitch black or blown out white (sensor failure)
        avg_brightness = np.mean(gray)
        if avg_brightness < 5 or avg_brightness > 250:
            return {"stats": {"error": "CRITICAL SENSOR FAILURE: Image brightness outside safe operating bounds."}, "safe_zones": [], "images": {}}
            
        # 1. Detect Craters using Hough Circles
        # Apply blur to reduce noise
        blurred = cv2.medianBlur(gray, 5)
        circles = cv2.HoughCircles(
            blurred, 
            cv2.HOUGH_GRADIENT, 
            dp=1, 
            minDist=20,
            param1=50, 
            param2=30, 
            minRadius=5, 
            maxRadius=100
        )
        
        crater_data = []
        crater_mask = np.zeros_like(gray)
        if circles is not None:
            circles = np.uint16(np.around(circles))
            for i in circles[0, :]:
                cv2.circle(crater_mask, (i[0], i[1]), i[2], 255, -1)
                crater_data.append({
                    "x": int(i[0]),
                    "y": int(i[1]),
                    "radius": int(i[2])
                })
                
        # 2. Detect Rocks/Obstacles using Edge Detection and Contours
        # High threshold Canny to find sharp edges (typical of rocks casting shadows)
        edges = cv2.Canny(gray, 100, 200)
        # Remove edges that are inside craters to avoid double counting crater rims as rocks
        edges = cv2.bitwise_and(edges, cv2.bitwise_not(crater_mask))
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        rock_data = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 2 < area < 50: # Filter small noise and huge features
                M = cv2.moments(cnt)
                if M['m00'] != 0:
                    cx = int(M['m10']/M['m00'])
                    cy = int(M['m01']/M['m00'])
                    rock_data.append({"x": cx, "y": cy, "area": area})
                    
        # 3. Calculate Roughness (Standard Deviation of local pixel intensities)
        # Assuming pixel intensity correlates with elevation/slope due to lighting
        roughness_map = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # 4. Create Risk Heatmap
        # Start with a base risk map (0-100)
        risk_map = np.zeros((img.shape[0], img.shape[1]), dtype=np.float32)
        
        # --- NEW CV HEURISTIC: SHADOW DETECTION ---
        # Very dark areas (< 20 intensity) are likely deep craters or steep cliffs.
        # We assign a high risk to these unknown shadowed regions.
        shadow_mask = np.uint8(gray < 20)
        risk_map[shadow_mask == 1] = np.maximum(risk_map[shadow_mask == 1], 85)
        
        # Add risk for craters (high risk inside and near rim)
        if circles is not None:
            for c in crater_data:
                cv2.circle(risk_map, (c['x'], c['y']), int(c['radius'] * 1.5), 80, -1)
                cv2.circle(risk_map, (c['x'], c['y']), c['radius'], 100, -1)
                
        # Add risk for rocks
        for r in rock_data:
            cv2.circle(risk_map, (r['x'], r['y']), 10, 90, -1)
            
        # Add risk based on global roughness (edges)
        dilated_edges = cv2.dilate(edges, np.ones((5,5), np.uint8), iterations=1)
        risk_map[dilated_edges > 0] = np.maximum(risk_map[dilated_edges > 0], 70)
        
        # Blur the risk map slightly for smoother gradients
        risk_map = cv2.GaussianBlur(risk_map, (15, 15), 0)
        
        # 5. Find optimal safe zones (areas with lowest risk)
        safe_zones = []
        # Create a mask of safe areas (risk < 30)
        safe_mask = np.uint8(risk_map < 30) * 255
        
        # Erode the safe mask by lander size to ensure the whole lander fits
        kernel_size = self.lander_size
        erosion_kernel = np.ones((kernel_size, kernel_size), np.uint8)
        safe_landable = cv2.erode(safe_mask, erosion_kernel, iterations=1)
        
        safe_contours, _ = cv2.findContours(safe_landable, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # Sort by largest safe areas
        safe_contours = sorted(safe_contours, key=cv2.contourArea, reverse=True)
        
        for i, cnt in enumerate(safe_contours[:3]): # Top 3 zones
            M = cv2.moments(cnt)
            if M['m00'] != 0:
                cx = int(M['m10']/M['m00'])
                cy = int(M['m01']/M['m00'])
                safe_zones.append({
                    "id": f"LZ-{i+1}",
                    "x": cx,
                    "y": cy,
                    "area": cv2.contourArea(cnt),
                    "avg_risk": float(np.mean(risk_map[cy-5:cy+5, cx-5:cx+5]))
                })
                
        # 6. Generate Annotated Output Image for Frontend
        annotated_img = img.copy()
        
        # Draw Craters
        if circles is not None:
            for c in crater_data:
                cv2.circle(annotated_img, (c['x'], c['y']), c['radius'], (0, 165, 255), 2) # Orange
                
        # Draw Shadows (Blue highlight)
        shadow_contours, _ = cv2.findContours(shadow_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(annotated_img, shadow_contours, -1, (255, 0, 0), 1)
                
        # Draw Rocks
        for r in rock_data:
            cv2.circle(annotated_img, (r['x'], r['y']), 3, (0, 0, 255), -1) # Red
            
        # Draw Safe Zones
        for sz in safe_zones:
            cv2.circle(annotated_img, (sz['x'], sz['y']), self.lander_size//2, (0, 255, 0), 2) # Green
            cv2.putText(annotated_img, sz['id'], (sz['x']+10, sz['y']-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
        # Encode output image to base64
        _, buffer = cv2.imencode('.jpg', annotated_img)
        encoded_img = base64.b64encode(buffer).decode('utf-8')
        
        # Generate Heatmap image
        heatmap_colored = cv2.applyColorMap(np.uint8(risk_map * 2.55), cv2.COLORMAP_JET)
        _, heat_buffer = cv2.imencode('.jpg', heatmap_colored)
        encoded_heatmap = base64.b64encode(heat_buffer).decode('utf-8')

        return {
            "stats": {
                "craters_detected": len(crater_data),
                "rocks_detected": len(rock_data),
                "shadowed_regions": len(shadow_contours),
                "global_roughness_index": round(roughness_map, 2)
            },
            "safe_zones": safe_zones,
            "images": {
                "annotated": f"data:image/jpeg;base64,{encoded_img}",
                "heatmap": f"data:image/jpeg;base64,{encoded_heatmap}"
            }
        }
