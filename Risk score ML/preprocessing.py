# preprocessing.py
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from datetime import datetime

class RiskDataPreprocessor:
    def __init__(self):
        self.accident_data = None
        self.weather_data = None
        self.merged_data = None
        
    def load_accident_data(self, filepath):
        """Load road accident dataset"""
        try:
            self.accident_data = pd.read_csv(filepath)
            print(f"✅ Loaded {len(self.accident_data)} accident records")
            return self.accident_data
        except Exception as e:
            print(f"❌ Error loading accident data: {e}")
            return None
    
    def load_weather_data(self, filepath):
        """Load weather/rainfall dataset"""
        try:
            self.weather_data = pd.read_csv(filepath)
            print(f"✅ Loaded {len(self.weather_data)} weather records")
            return self.weather_data
        except Exception as e:
            print(f"❌ Error loading weather data: {e}")
            return None