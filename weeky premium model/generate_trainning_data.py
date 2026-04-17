import pandas as pd
import random

# Load location risk table
risk_df = pd.read_csv("location_risk.csv")

shift_map = {
    "morning": 0.2,
    "afternoon": 0.3,
    "evening": 0.6,
    "night": 0.7
}

def calculate_rule_based_risk_score(row):
    normalized_activity = min(row["activity_level"] / 5, 1.0)

    risk_score = (
        0.35 * row["rainfall_intensity"] +
        0.25 * row["temperature_trend"] +
        0.25 * row["disruption_frequency"] +
        0.10 * normalized_activity +
        0.05 * row["shift_risk"]
    )

    return round(min(risk_score, 1.0), 3)

training_rows = []

# Generate multiple rider samples per area
for _, loc in risk_df.iterrows():
    for _ in range(80):  # increase for more data
        weekly_income = random.randint(3000, 10000)
        working_hours_per_day = random.randint(4, 12)
        orders_per_day = random.randint(8, 35)
        shift_timing = random.choice(["morning", "afternoon", "evening", "night"])

        income_per_hour = round(weekly_income / (working_hours_per_day * 7), 2)
        activity_level = round(orders_per_day / working_hours_per_day, 2)
        shift_risk = shift_map[shift_timing]

        row = {
            "state": loc["state"],
            "city": loc["city"],
            "area": loc["area"],
            "weekly_income": weekly_income,
            "working_hours_per_day": working_hours_per_day,
            "orders_per_day": orders_per_day,
            "shift_timing": shift_timing,
            "rainfall_intensity": float(loc["rainfall_intensity"]),
            "temperature_trend": float(loc["temperature_trend"]),
            "disruption_frequency": float(loc["disruption_frequency"]),
            "location_risk_score": float(loc["location_risk_score"]),
            "income_per_hour": income_per_hour,
            "activity_level": activity_level,
            "shift_risk": shift_risk
        }

        row["risk_score"] = calculate_rule_based_risk_score(row)
        training_rows.append(row)

training_df = pd.DataFrame(training_rows)
training_df.to_csv("training_data.csv", index=False)

print("Training data saved to training_data.csv")
print(training_df.head())