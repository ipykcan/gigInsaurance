import firebase_admin
from firebase_admin import credentials, firestore
import joblib # or pickle
import os
import pandas as pd
import numpy as np
from datetime import datetime

# To run this script, you must provide your serviceAccountKey.json
# Generate it from Firebase Console -> Project Settings -> Service Accounts
CREDENTIAL_PATH = 'serviceAccountKey.json'
MODEL_PATH = 'model.pkl'
ACCIDENTS_UNUSED_PATH = None

# Climate dataset is used to transform a claim (city/state + month) into model features.
CLIMATE_CSV_PATH = os.path.join(os.path.dirname(__file__), "Indian_Climate_Dataset_2024_2025.csv")

def load_ai_model():
    if not os.path.exists(MODEL_PATH):
        print(f"Warning: Model file {MODEL_PATH} not found. Returning a mock model function.")
        # Return a mock predictor that generates random scores
        def mock_predict(features):
            import random
            return [random.randint(40, 95)]
        return mock_predict
    
    print(f"Loading model from {MODEL_PATH}...")
    try:
        data = joblib.load(MODEL_PATH)
        # If the pickle is a dictionary, extract the model
        if isinstance(data, dict) and 'model' in data:
            model = data['model']
        else:
            model = data
        feature_names = data.get('feature_names') if isinstance(data, dict) else None
        return model.predict, feature_names
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

def build_climate_feature_index():
    """
    Returns pre-aggregated climate feature tables for fast lookup:
    - city_state_month -> averaged features
    - month -> global averaged features for fallback
    """
    if not os.path.exists(CLIMATE_CSV_PATH):
        raise FileNotFoundError(f"Missing climate CSV: {CLIMATE_CSV_PATH}")

    climate = pd.read_csv(CLIMATE_CSV_PATH)
    climate["Date"] = pd.to_datetime(climate["Date"], errors="coerce")
    climate = climate.dropna(subset=["Date"]).copy()

    climate["month"] = climate["Date"].dt.month
    climate["City"] = climate["City"].astype(str).str.strip()
    climate["State"] = climate["State"].astype(str).str.strip()

    city_state_month = (
        climate.groupby(["State", "City", "month"], as_index=False)
        .agg(
            rainfall_mm=("Rainfall (mm)", "mean"),
            humidity=("Humidity (%)", "mean"),
            wind_speed=("Wind_Speed (km/h)", "mean"),
        )
        .copy()
    )

    global_month = (
        climate.groupby(["month"], as_index=False)
        .agg(
            rainfall_mm=("Rainfall (mm)", "mean"),
            humidity=("Humidity (%)", "mean"),
            wind_speed=("Wind_Speed (km/h)", "mean"),
        )
        .copy()
    )

    # Helpful mapping for exact lookups.
    city_state_month_index = {
        (row["State"], row["City"], int(row["month"])): row
        for _, row in city_state_month.iterrows()
    }
    global_month_index = {
        int(row["month"]): row for _, row in global_month.iterrows()
    }
    return city_state_month_index, global_month_index


def extract_features_from_claim(claim: dict, city_state_month_index, global_month_index):
    """
    Extract model input features for a single claim using:
    - claim.state + claim.city + claim.timestamp month
    Falls back to global month averages if exact key is missing.
    """
    state = str(claim.get("state") or "").strip()
    city = str(claim.get("city") or "").strip()
    ts = claim.get("timestamp")

    # Firestore timestamps via firebase_admin are usually datetime already.
    month = None
    if ts is None:
        month = datetime.utcnow().month
    else:
        try:
            # If it's already a datetime
            if hasattr(ts, "month"):
                month = int(ts.month)
            else:
                # datetime string/epoch fallback
                dt = ts.to_datetime() if hasattr(ts, "to_datetime") else None
                if dt is not None and hasattr(dt, "month"):
                    month = int(dt.month)
                else:
                    month = int(pd.to_datetime(ts).month)
        except Exception:
            month = datetime.utcnow().month

    # Exact city/state + month match
    key = (state, city, int(month))
    row = city_state_month_index.get(key)
    if row is None:
        # Try month-only fallback
        row = global_month_index.get(int(month))

    if row is None:
        return None

    return [
        float(row["rainfall_mm"]),
        float(row["humidity"]),
        float(row["wind_speed"]),
    ]


def calculate_features_for_user(uid, claims, city_state_month_index, global_month_index):
    """
    Extract average model features for a user's claims.
    The model expects features: ['rainfall_mm', 'humidity', 'wind_speed'].
    Features are derived by mapping each claim's (state, city, timestamp month)
    into the climate dataset.
    """
    total_claims = len(claims)
    if total_claims == 0:
        return None # Not enough data

    per_claim_features = []
    for c in claims:
        feats = extract_features_from_claim(c, city_state_month_index, global_month_index)
        if feats is not None:
            per_claim_features.append(feats)

    if not per_claim_features:
        return None

    arr = np.array(per_claim_features, dtype=float)
    return arr.mean(axis=0).tolist()


def main():
    if not os.path.exists(CREDENTIAL_PATH):
        print(f"Error: {CREDENTIAL_PATH} not found.")
        print("Please download it from Firebase Console -> Project Settings -> Service Accounts")
        return

    # 1. Initialize Firebase Admin
    cred = credentials.Certificate(CREDENTIAL_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # 2. Load the Model
    loaded = load_ai_model()
    if not loaded:
        return
    predict_fn, feature_names = loaded

    # 3. Fetch Data and Calculate Scores
    print("Fetching claims and users from Firestore...")
    users_ref = db.collection('users')
    claims_ref = db.collection('claims')
    
    users = users_ref.stream()
    claims_docs = claims_ref.stream()

    # Precompute climate lookup tables once.
    try:
        city_state_month_index, global_month_index = build_climate_feature_index()
    except Exception as e:
        print(f"Failed building climate feature index: {e}")
        return
    
    # Group claims by user ID
    user_claims = {}
    for doc in claims_docs:
        data = doc.to_dict()
        uid = data.get('user_id')
        if not uid:
            continue
        if uid not in user_claims:
            user_claims[uid] = []
        user_claims[uid].append(data)
        
    # 4. Update Users with New Credit Scores
    updated_count = 0
    for user_doc in users:
        uid = user_doc.id
        claims = user_claims.get(uid, [])
        
        features = calculate_features_for_user(uid, claims, city_state_month_index, global_month_index)
        if features is None:
            continue # No claims, skip
            
        try:
            # Predict the score. Example: output is a legitimacy probability 0.0-1.0 or 0-100
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                prediction = predict_fn([features])

            # Model was trained to output: 0=Minor, 1=Serious, 2=Fatal
            # Convert to 0-100 score for UI.
            score_raw = float(np.array(prediction).item())
            score = (score_raw / 2.0) * 100.0
            score = min(max(int(round(score)), 0), 100) # Clamp between 0 and 100
            
            # Update Firestore
            users_ref.document(uid).update({
                'credit_score': score
            })
            print(f"Updated user {uid} with Credit Score: {score}")
            updated_count += 1
            
        except Exception as e:
            print(f"Error updating user {uid}: {e}")
            
    print(f"Finished updating {updated_count} users.")


if __name__ == '__main__':
    main()
