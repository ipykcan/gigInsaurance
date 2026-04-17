# feature_engineering.py
import pandas as pd
import numpy as np

class RiskFeatureEngineer:
    def __init__(self, merged_data):
        self.data = merged_data
        self.features = None
        
    def create_risk_features(self):
        """Create features for risk prediction model"""
        df = self.data.copy()
        return df