# risk_model.py
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
import joblib

class AreaRiskModel:
    def __init__(self):
        self.model = None
        self.feature_importance = None
        
    def train(self, X, y):
        """Train the risk prediction model"""
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train, y_train)
        
        y_pred = self.model.predict(X_test)
        r2 = r2_score(y_test, y_pred)
        print(f"✅ Model R² Score: {r2:.3f}")
        
        return self.model
    
    def predict_city_risk(self, rainfall, humidity, wind_speed):
        """Predict risk for a city based on weather"""
        features = np.array([[rainfall, humidity, wind_speed]])
        risk_score = self.model.predict(features)[0]
        return risk_score
    
    def get_risk_level(self, risk_score):
        if risk_score < 3:
            return "Low Risk"
        elif risk_score < 6:
            return "Moderate Risk"
        elif risk_score < 8:
            return "High Risk"
        else:
            return "Critical Risk"
    
    def save_model(self, filepath):
        joblib.dump(self.model, filepath)
        print(f"✅ Model saved to {filepath}")
    
    def load_model(self, filepath):
        self.model = joblib.load(filepath)
        print(f"✅ Model loaded from {filepath}")