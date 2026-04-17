# risk_model.py
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib

class AreaRiskModel:
    def __init__(self):
        self.model = None
        self.feature_importance = None
        self.feature_names = None
        
    def train(self, X, y):
        """Train the risk prediction model"""
        # Store feature names
        if hasattr(X, 'columns'):
            self.feature_names = list(X.columns)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Create model
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        
        # Train
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)
        
        print(f"✅ Model R² Score: {r2:.3f}")
        print(f"✅ Mean Absolute Error: {mae:.3f}")
        
        # Feature importance
        if hasattr(self.model, 'feature_importances_') and self.feature_names:
            self.feature_importance = dict(zip(self.feature_names, self.model.feature_importances_))
            print("\n📊 Feature Importance:")
            for name, imp in sorted(self.feature_importance.items(), key=lambda x: x[1], reverse=True):
                print(f"   {name}: {imp:.3f}")
        
        return self.model
    
    def predict_area_risk(self, features):
        """Predict risk score for a specific area"""
        # Convert to numpy array and reshape
        features = np.array(features).reshape(1, -1)
        
        # Make prediction
        risk_score = self.model.predict(features)[0]
        
        return risk_score
    
    def predict_with_dict(self, feature_dict):
        """Predict using a dictionary of features"""
        if self.feature_names:
            features = [feature_dict.get(name, 0) for name in self.feature_names]
            return self.predict_area_risk(features)
        else:
            return self.predict_area_risk(list(feature_dict.values()))
    
    def get_risk_level(self, risk_score):
        """Convert numeric risk to category"""
        if risk_score < 3:
            return "Low Risk"
        elif risk_score < 6:
            return "Moderate Risk"
        elif risk_score < 8:
            return "High Risk"
        else:
            return "Critical Risk"
    
    def save_model(self, filepath):
        """Save trained model"""
        joblib.dump({
            'model': self.model,
            'feature_importance': self.feature_importance,
            'feature_names': self.feature_names
        }, filepath)
        print(f"✅ Model saved to {filepath}")
    
    def load_model(self, filepath):
        """Load trained model"""
        data = joblib.load(filepath)
        self.model = data['model']
        self.feature_importance = data.get('feature_importance')
        self.feature_names = data.get('feature_names')
        print(f"✅ Model loaded from {filepath}")
        if self.feature_names:
            print(f"   Model expects {len(self.feature_names)} features: {self.feature_names}")