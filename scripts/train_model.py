import os
import joblib
import pandas as pd
import numpy as np

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error


ACCIDENTS_PATH = os.path.join(os.path.dirname(__file__), "accident_prediction_india.csv")
CLIMATE_PATH = os.path.join(os.path.dirname(__file__), "Indian_Climate_Dataset_2024_2025.csv")
MODEL_OUT_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")


FEATURE_NAMES = ["rainfall_mm", "humidity", "wind_speed"]


def month_name_to_number(series: pd.Series) -> pd.Series:
    # Example values: January, February, ...
    month_map = {
        "January": 1,
        "February": 2,
        "March": 3,
        "April": 4,
        "May": 5,
        "June": 6,
        "July": 7,
        "August": 8,
        "September": 9,
        "October": 10,
        "November": 11,
        "December": 12,
    }
    return series.map(month_map)


def load_and_prepare_data():
    accidents = pd.read_csv(ACCIDENTS_PATH)
    climate = pd.read_csv(CLIMATE_PATH)

    # --- Label encoding (target) ---
    severity_map = {"Minor": 0.0, "Serious": 1.0, "Fatal": 2.0}
    accidents["severity_y"] = accidents["Accident Severity"].map(severity_map)

    # Remove rows without a valid label.
    accidents = accidents.dropna(subset=["severity_y"]).copy()

    # Parse month in accident file.
    accidents["month_num"] = month_name_to_number(accidents["Month"].astype(str).str.strip())

    # Filter to city/state we can match against climate.
    accidents = accidents[accidents["month_num"].notna()].copy()
    accidents["City Name"] = accidents["City Name"].astype(str).str.strip()
    accidents["State Name"] = accidents["State Name"].astype(str).str.strip()
    accidents = accidents[accidents["City Name"].str.lower() != "unknown"].copy()

    # --- Climate features ---
    climate["Date"] = pd.to_datetime(climate["Date"], errors="coerce")
    climate = climate.dropna(subset=["Date"]).copy()
    climate["year"] = climate["Date"].dt.year
    climate["month_num"] = climate["Date"].dt.month
    climate["City"] = climate["City"].astype(str).str.strip()
    climate["State"] = climate["State"].astype(str).str.strip()

    # Since your accident dataset years don't overlap with the climate dataset years,
    # we aggregate by city+state+month (year-agnostic) for training.
    climate_month = (
        climate.groupby(["State", "City", "month_num"], as_index=False)
        .agg(
            rainfall_mm=("Rainfall (mm)", "mean"),
            humidity=("Humidity (%)", "mean"),
            wind_speed=("Wind_Speed (km/h)", "mean"),
        )
    )

    # Join accidents -> climate-month features.
    merged = accidents.merge(
        climate_month,
        how="left",
        left_on=["State Name", "City Name", "month_num"],
        right_on=["State", "City", "month_num"],
    )

    # Keep only rows where we got all features.
    merged = merged.dropna(subset=FEATURE_NAMES).copy()
    return merged


def train_model(merged: pd.DataFrame):
    X = merged[FEATURE_NAMES].astype(float).values
    y = merged["severity_y"].astype(float).values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=300,
        random_state=42,
        n_jobs=-1,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    # Some sklearn builds don't support squared=False; compute RMSE manually.
    mse = mean_squared_error(y_test, y_pred)
    rmse = float(np.sqrt(mse))

    feature_importance = {
        name: float(val) for name, val in zip(FEATURE_NAMES, model.feature_importances_)
    }

    bundle = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "feature_importance": feature_importance,
        "target": "accident_severity_encoded(0=Minor,1=Serious,2=Fatal)",
        "metrics": {"r2": float(r2), "rmse": float(rmse)},
    }

    return bundle


def main():
    if not os.path.exists(ACCIDENTS_PATH):
        raise FileNotFoundError(f"Missing accidents CSV: {ACCIDENTS_PATH}")
    if not os.path.exists(CLIMATE_PATH):
        raise FileNotFoundError(f"Missing climate CSV: {CLIMATE_PATH}")

    merged = load_and_prepare_data()
    if len(merged) < 50:
        print(f"Warning: very small training set after merge: {len(merged)} rows.")
    else:
        print(f"Training rows after merge: {len(merged)}")

    bundle = train_model(merged)

    os.makedirs(os.path.dirname(MODEL_OUT_PATH), exist_ok=True)
    joblib.dump(bundle, MODEL_OUT_PATH)
    print(f"Saved model to: {MODEL_OUT_PATH}")
    print("Model metrics:", bundle.get("metrics"))
    print("Feature importance:", bundle.get("feature_importance"))


if __name__ == "__main__":
    main()

