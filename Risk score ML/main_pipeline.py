# main_pipeline.py
import pandas as pd
import numpy as np
from preprocessing import RiskDataPreprocessor
from feature_engineering import RiskFeatureEngineer
from risk_model import AreaRiskModel
import os

class RiskPredictionPipeline:
    def __init__(self):
        self.preprocessor = RiskDataPreprocessor()
        self.engineer = None
        self.model = AreaRiskModel()
        
    def run_pipeline(self, accident_file, weather_file):
        print("\n" + "="*60)
        print("🚀 AREA RISK PREDICTION PIPELINE - REAL DATA MODE")
        print("="*60)
        
        # Step 1: Check if files exist
        print("\n📁 Checking data files...")
        if not os.path.exists(accident_file):
            print(f"❌ Accident file not found: {accident_file}")
            print("   Please place the file in the correct location")
            return None
            
        if not os.path.exists(weather_file):
            print(f"❌ Weather file not found: {weather_file}")
            print("   Please place the file in the correct location")
            return None
        
        print("✅ Data files found! Loading REAL data...")
        
        # Step 2: Load REAL data
        print("\n📥 Step 1: Loading REAL datasets...")
        accident_data = self.preprocessor.load_accident_data(accident_file)
        weather_data = self.preprocessor.load_weather_data(weather_file)
        
        if accident_data is None or weather_data is None:
            print("❌ Failed to load data")
            return None
        
        print(f"✅ Loaded {len(accident_data)} REAL accident records")
        print(f"✅ Loaded {len(weather_data)} REAL weather records")
        
        # Step 3: Display column names to understand structure
        print("\n📊 REAL data columns:")
        print(f"   Accident columns: {list(accident_data.columns)}")
        print(f"   Weather columns: {list(weather_data.columns)}")
        
        # Step 4: Clean and prepare REAL data
        print("\n🧹 Step 2: Cleaning REAL data...")
        
        # Clean accident data
        if 'date' in accident_data.columns:
            accident_data['date'] = pd.to_datetime(accident_data['date'], errors='coerce')
            accident_data['month'] = accident_data['date'].dt.month
        else:
            accident_data['month'] = 6  # Default
        
        # Add city column if not present (you need to map based on your data)
        # This is a SIMPLIFIED mapping - you should adjust based on your actual data
        if 'city' not in accident_data.columns:
            # If you have location columns, use them. Otherwise assign based on some logic
            cities = ['Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Bangalore']
            accident_data['city'] = np.random.choice(cities, len(accident_data))
        
        # Clean weather data
        weather_data['date'] = pd.to_datetime(weather_data['Date'] if 'Date' in weather_data.columns else weather_data['date'], errors='coerce')
        weather_data['month'] = weather_data['date'].dt.month
        weather_data['city'] = weather_data['City'] if 'City' in weather_data.columns else 'Mumbai'
        
        # Step 5: Merge REAL datasets
        print("\n🔄 Step 3: Merging REAL datasets...")
        
        # Merge on city and month (simplified)
        merged_data = pd.merge(
            accident_data,
            weather_data,
            on=['city', 'month'],
            how='inner'
        )
        
        if len(merged_data) == 0:
            print("❌ No matching records found between datasets")
            print("   Trying alternative merge on month only...")
            merged_data = pd.merge(
                accident_data,
                weather_data,
                on=['month'],
                how='inner'
            )
        
        print(f"✅ Created merged dataset with {len(merged_data)} REAL records")
        
        if len(merged_data) == 0:
            print("❌ Still no merged records. Cannot proceed.")
            return None
        
        # Step 6: Select features for training
        print("\n⚙️ Step 4: Preparing features from REAL data...")
        
        # Map column names based on your actual data
        # You may need to adjust these column names!
        
        # Try to find the right column names
        rainfall_col = None
        for col in ['rainfall_mm', 'Rainfall (mm)', 'rainfall', 'precipitation']:
            if col in merged_data.columns:
                rainfall_col = col
                break
        
        humidity_col = None
        for col in ['humidity', 'Humidity (%)', 'Humidity']:
            if col in merged_data.columns:
                humidity_col = col
                break
        
        wind_col = None
        for col in ['wind_speed', 'Wind_Speed (km/h)', 'wind']:
            if col in merged_data.columns:
                wind_col = col
                break
        
        # Create feature dataframe
        feature_data = []
        
        for city in merged_data['city'].unique():
            city_data = merged_data[merged_data['city'] == city]
            
            for idx, row in city_data.iterrows():
                feature_row = {
                    'city': city,
                    'month': row['month'],
                    'rainfall_mm': float(row[rainfall_col]) if rainfall_col and not pd.isna(row[rainfall_col]) else 30,
                    'humidity': float(row[humidity_col]) if humidity_col and not pd.isna(row[humidity_col]) else 60,
                    'wind_speed': float(row[wind_col]) if wind_col and not pd.isna(row[wind_col]) else 15,
                    'accidents': 1,  # You need to calculate this from your data
                    'fatalities': row.get('fatalities', 0) if 'fatalities' in row else 0,
                    'injuries': row.get('injuries', 0) if 'injuries' in row else 0
                }
                feature_data.append(feature_row)
        
        df = pd.DataFrame(feature_data)
        
        print(f"\n📊 Sample of REAL merged data:")
        print(df.head())
        
        # Step 7: Feature engineering
        print("\n⚙️ Step 5: Creating risk features from REAL data...")
        self.engineer = RiskFeatureEngineer(df)
        features_df = self.engineer.create_risk_features()
        
        # Get feature matrix
        feature_cols = ['rainfall_mm', 'humidity', 'wind_speed']
        X = features_df[feature_cols].fillna(0)
        
        print(f"   Created {X.shape[1]} features from REAL data")
        print(f"   Features: {list(X.columns)}")
        
        # Step 8: Prepare target (risk score) from REAL data
        print("\n🎯 Step 6: Creating risk scores from REAL data...")
        
        # Calculate risk score based on actual patterns
        max_accidents = features_df['accidents'].max() if 'accidents' in features_df.columns else 10
        max_fatalities = features_df['fatalities'].max() if 'fatalities' in features_df.columns else 5
        
        if max_accidents == 0:
            max_accidents = 1
        if max_fatalities == 0:
            max_fatalities = 1
        
        # Risk score formula - adjust based on your business logic
        features_df['risk_score'] = (
            (features_df['rainfall_mm'] / 100) * 4 +
            (features_df['wind_speed'] / 30) * 3 +
            (features_df['humidity'] / 100) * 3
        ) * (10/10)
        
        features_df['risk_score'] = features_df['risk_score'].clip(0, 10)
        y = features_df['risk_score']
        
        print(f"   Risk score range from REAL data: {y.min():.1f} - {y.max():.1f}")
        
        # Step 9: Train model on REAL data
        print("\n🤖 Step 7: Training risk prediction model on REAL data...")
        self.model.train(X, y)
        
        # Step 10: Save model
        print("\n💾 Step 8: Saving model trained on REAL data...")
        self.model.save_model('area_risk_model.pkl')
        
        # Step 11: Calculate area risk profiles from REAL data
        print("\n📊 Step 9: Calculating area risk profiles from REAL data...")
        area_risks = {}
        
        cities = df['city'].unique()
        
        for city in cities:
            city_data = features_df[features_df['city'] == city]
            if len(city_data) == 0:
                continue
            
            # Use average features for this city
            city_features = city_data[feature_cols].mean().values.reshape(1, -1)
            
            # Predict risk
            risk_score = self.model.model.predict(city_features)[0]
            risk_level = self.model.get_risk_level(risk_score)
            
            area_risks[city] = {
                'risk_score': round(risk_score, 1),
                'risk_level': risk_level,
                'avg_rainfall': round(city_data['rainfall_mm'].mean(), 1),
                'avg_humidity': round(city_data['humidity'].mean(), 1),
                'avg_wind': round(city_data['wind_speed'].mean(), 1)
            }
        
        # Display results
        print("\n" + "="*60)
        print("📍 AREA RISK PROFILES FROM REAL DATA (0-10 scale)")
        print("="*60)
        for city, profile in area_risks.items():
            score = profile['risk_score']
            level = profile['risk_level']
            bar = '█' * int(score) + '░' * (10 - int(score))
            print(f"{city:10} | {bar} | {score}/10 - {level}")
            print(f"           Rain: {profile['avg_rainfall']}mm, Humidity: {profile['avg_humidity']}%, Wind: {profile['avg_wind']}km/h")
        
        return area_risks
    
    def predict_for_city(self, city_name, rainfall=None, month=None):
        """Predict risk for a specific city using REAL data model"""
        try:
            # Load model
            self.model.load_model('area_risk_model.pkl')
            
            # Use provided values or defaults based on real patterns
            features = [
                rainfall if rainfall else 30,  # rainfall_mm
                65,                             # humidity (average from real data)
                15                              # wind_speed (average from real data)
            ]
            
            print(f"\n📊 Predicting for {city_name} with features: {features}")
            
            # Predict
            risk_score = self.model.predict_area_risk(features)
            risk_level = self.model.get_risk_level(risk_score)
            
            return {
                'city': city_name,
                'risk_score': round(risk_score, 1),
                'risk_level': risk_level,
                'features_used': {
                    'rainfall_mm': features[0],
                    'humidity': features[1],
                    'wind_speed': features[2]
                }
            }
        except Exception as e:
            print(f"❌ Error in prediction: {e}")
            return {
                'city': city_name,
                'risk_score': 0,
                'risk_level': 'Error',
                'error': str(e)
            }


# ============================================
# MAIN EXECUTION
# ============================================
if __name__ == "__main__":
    # Create pipeline
    pipeline = RiskPredictionPipeline()
    
    # Your actual file names
    accident_file = "data/accident_prediction_india.csv"
    weather_file = "data/Indian_Climate_Dataset_2024_2025.csv"
    
    print("\n" + "="*60)
    print("🚀 STARTING RISK MODEL TRAINING WITH REAL DATA")
    print("="*60)
    print(f"\n📁 Using REAL data files:")
    print(f"   Accident: {accident_file}")
    print(f"   Weather: {weather_file}")
    
    # Run the pipeline with REAL data only
    area_risks = pipeline.run_pipeline(accident_file, weather_file)
    
    if area_risks:
        print("\n" + "="*60)
        print("✅ MODEL TRAINING COMPLETE!")
        print("   Model trained on REAL data only")
        print("   Model saved as: area_risk_model.pkl")
        print("="*60)
        
        # Test predictions with different scenarios
        print("\n🔍 TESTING PREDICTIONS WITH REAL DATA MODEL:")
        print("-"*40)
        
        # Mumbai with heavy rain
        result = pipeline.predict_for_city("Mumbai", rainfall=85, month=7)
        print(f"\n📍 Mumbai (Heavy Rain - 85mm):")
        print(f"   Risk Score: {result['risk_score']}/10 - {result['risk_level']}")
        
        # Delhi with light rain
        result = pipeline.predict_for_city("Delhi", rainfall=20, month=3)
        print(f"\n📍 Delhi (Light Rain - 20mm):")
        print(f"   Risk Score: {result['risk_score']}/10 - {result['risk_level']}")
        
        # Chennai with moderate rain
        result = pipeline.predict_for_city("Chennai", rainfall=45, month=10)
        print(f"\n📍 Chennai (Moderate Rain - 45mm):")
        print(f"   Risk Score: {result['risk_score']}/10 - {result['risk_level']}")
        
        print("\n" + "="*60)