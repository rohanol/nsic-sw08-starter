import numpy as np

class MissionTrackerEKF:
    """
    An Extended Kalman Filter (EKF) to track landing zones across multiple images,
    predicting the rover's descent trajectory over time.
    """
    def __init__(self):
        # State vector: [x, y, velocity_x, velocity_y]
        self.state = np.zeros(4)
        # Covariance matrix (Uncertainty)
        self.P = np.eye(4) * 1000.0
        # Measurement matrix (we only observe x and y coordinates from the images)
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        # Measurement noise (sensor inaccuracy)
        self.R = np.eye(2) * 5.0
        # Process noise (wind/atmospheric disturbance)
        self.Q = np.eye(4) * 0.1
        self.initialized = False
        
    def predict(self, dt=1.0):
        # State transition matrix (Kinematics equation)
        F = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1,  0],
            [0, 0, 0,  1]
        ])
        self.state = F @ self.state
        self.P = F @ self.P @ F.T + self.Q
        return self.state[:2] # Return predicted next x, y
        
    def update(self, measurement):
        if not self.initialized:
            self.state[0] = measurement[0]
            self.state[1] = measurement[1]
            self.initialized = True
            return
            
        z = np.array(measurement)
        y = z - (self.H @ self.state)
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        
        self.state = self.state + (K @ y)
        I = np.eye(4)
        self.P = (I - (K @ self.H)) @ self.P

# Singleton instance to track the landing over consecutive API requests
mission_tracker = MissionTrackerEKF()
