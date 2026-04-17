import pandas as pd
import joblib

# Load files
risk_df = pd.read_csv("location_risk.csv")
model = joblib.load("risk_model.pkl")

# Shift risk mapping
shift_map = {
    "morning": 0.2,
    "afternoon": 0.3,
    "evening": 0.6,
    "night": 0.7
}

# =========================
# Get user input
# =========================
def get_user_input():
    print("\n===== ENTER DRIVER DETAILS =====")

    state = input("Enter State: ")
    city = input("Enter City: ")
    area = input("Enter Area: ")

    weekly_income = float(input("Enter Weekly Income (₹): "))
    working_hours_per_day = float(input("Enter Working Hours per Day: "))
    orders_per_day = float(input("Enter Orders per Day: "))
    shift_timing = input("Enter Shift (morning/afternoon/evening/night): ").lower()

    return {
        "state": state,
        "city": city,
        "area": area,
        "weekly_income": weekly_income,
        "working_hours_per_day": working_hours_per_day,
        "orders_per_day": orders_per_day,
        "shift_timing": shift_timing
    }


# =========================
# Get location risk
# =========================
def get_location_risk(state, city, area):
    row = risk_df[
        (risk_df["state"].str.lower() == state.lower()) &
        (risk_df["city"].str.lower() == city.lower()) &
        (risk_df["area"].str.lower() == area.lower())
    ]

    if row.empty:
        print("\n⚠ Location not found, using default risk values")
        return {
            "rainfall_intensity": 0.5,
            "temperature_trend": 0.5,
            "disruption_frequency": 0.5,
            "location_risk_score": 0.5
        }

    row = row.iloc[0]
    return {
        "rainfall_intensity": float(row["rainfall_intensity"]),
        "temperature_trend": float(row["temperature_trend"]),
        "disruption_frequency": float(row["disruption_frequency"]),
        "location_risk_score": float(row["location_risk_score"])
    }


# =========================
# Derived features
# =========================
def add_features(data):
    data["income_per_hour"] = round(
        data["weekly_income"] / (data["working_hours_per_day"] * 7), 2
    )

    data["activity_level"] = round(
        data["orders_per_day"] / data["working_hours_per_day"], 2
    )

    data["shift_risk"] = shift_map.get(data["shift_timing"], 0.3)

    return data


# =========================
# Predict risk score (ML)
# =========================
def predict_risk(data):
    input_df = pd.DataFrame([{
        "state": data["state"],
        "city": data["city"],
        "area": data["area"],
        "weekly_income": data["weekly_income"],
        "working_hours_per_day": data["working_hours_per_day"],
        "orders_per_day": data["orders_per_day"],
        "shift_timing": data["shift_timing"],
        "rainfall_intensity": data["rainfall_intensity"],
        "temperature_trend": data["temperature_trend"],
        "disruption_frequency": data["disruption_frequency"],
        "location_risk_score": data["location_risk_score"],
        "income_per_hour": data["income_per_hour"],
        "activity_level": data["activity_level"],
        "shift_risk": data["shift_risk"]
    }])

    score = float(model.predict(input_df)[0])
    return round(min(max(score, 0), 1), 3)


# =========================
# Plan mapping
# =========================
def recommend_plan(risk_score):
    if risk_score < 0.4:
        return "Basic Plan", 100
    elif risk_score < 0.7:
        return "Mid Plan", 150
    else:
        return "Pro Plan", 200


# =========================
# Explanation
# =========================
def generate_explanation(data):
    reasons = []

    if data["rainfall_intensity"] > 0.7:
        reasons.append("High rainfall risk in your location.")

    if data["temperature_trend"] > 0.7:
        reasons.append("High temperature / heatwave risk.")

    if data["disruption_frequency"] > 0.5:
        reasons.append("Frequent disruption events in your area.")

    if data["shift_timing"] in ["evening", "night"]:
        reasons.append("Your shift timing increases exposure.")

    if data["activity_level"] > 2.5:
        reasons.append("High work activity increases income risk.")

    if not reasons:
        reasons.append("Moderate risk profile.")

    return reasons


# =========================
# MAIN PIPELINE
# =========================
def run():
    user_data = get_user_input()

    # Location risk
    loc_risk = get_location_risk(
        user_data["state"],
        user_data["city"],
        user_data["area"]
    )
    user_data.update(loc_risk)

    # Derived features
    user_data = add_features(user_data)

    # ML prediction
    risk_score = predict_risk(user_data)

    # Plan
    plan, premium = recommend_plan(risk_score)

    # Explanation
    explanation = generate_explanation(user_data)

    # Output
    print("\n===== RESULT =====")
    print(f"Risk Score: {risk_score}")
    print(f"Recommended Plan: {plan}")
    print(f"Weekly Premium: ₹{premium}")
    print("\nReasons:")
    for r in explanation:
        print("-", r)


# Run
if __name__ == "__main__":
    run()