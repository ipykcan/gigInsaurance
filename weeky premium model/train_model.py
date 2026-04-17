import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Load training data
df = pd.read_csv("training_data.csv")

# Features and target
feature_cols = [
    "state", "city", "area",
    "weekly_income", "working_hours_per_day", "orders_per_day",
    "shift_timing",
    "rainfall_intensity", "temperature_trend", "disruption_frequency",
    "location_risk_score",
    "income_per_hour", "activity_level", "shift_risk"
]

X = df[feature_cols]
y = df["risk_score"]

categorical_features = ["state", "city", "area", "shift_timing"]
numeric_features = [
    "weekly_income", "working_hours_per_day", "orders_per_day",
    "rainfall_intensity", "temperature_trend", "disruption_frequency",
    "location_risk_score",
    "income_per_hour", "activity_level", "shift_risk"
]

# Preprocessing
preprocessor = ColumnTransformer([
    ("num", StandardScaler(), numeric_features),
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features)
])

# Model pipeline
model = Pipeline([
    ("preprocessor", preprocessor),
    ("regressor", RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        random_state=42
    ))
])

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
rmse = mean_squared_error(y_test, y_pred) ** 0.5
r2 = r2_score(y_test, y_pred)

print("Model Evaluation")
print("----------------")
print(f"MAE  : {mae:.4f}")
print(f"RMSE : {rmse:.4f}")
print(f"R2   : {r2:.4f}")

# Save model
joblib.dump(model, "risk_model.pkl")
print("\nModel saved as risk_model.pkl")