# Fraud Shield: Micro-Insurance for Delivery Partners

> **A real-time, AI-powered geofenced micro-insurance platform built to protect gig-economy delivery riders from unforeseen disruptions.**

## What is this project for?
In the face of recent market crashes and economic volatility, gig workers—especially delivery riders—are often left without a financial safety net. They face daily risks ranging from extreme weather conditions (heavy rains, severe heatwaves) to sudden geopolitical strikes or local disasters that halt their daily earnings. 

**Fraud Shield** acts as an on-demand micro-insurance platform specifically tailored for these delivery guys. It allows riders to deposit a nominal weekly premium (e.g., ₹100) and easily file geofenced claims whenever they are sidelined by external factors. When a claim is verified, riders receive an instant payout (e.g., ₹1000) to compensate for lost wages, establishing a crucial financial safety net during tough economic downswings.

## Who are the Users & Why Are They Important?
- **Delivery Partners (Clients)**: The reliable backbone of the modern on-demand delivery market. They are highly vulnerable to localized disruptions and market crashes. Providing them an accessible, transparent financial cushion preserves their livelihood and dignity.
- **System Admins (Insurance Providers)**: Operating the backend claims platform, admins leverage AI and real-time verifiable data (GPS metrics, weather APIs) to instantly approve payouts securely while aggressively combatting fraudulent/fake claims.

##  Key Features
1. **Geofenced Claim Verification**: Riders set a permanent "Home/Delivery Zone". Claims are strictly checked against a 5km operational radius using the Haversine formula to absolutely prevent location spoofing.
2. **Real-time API Validation**: Integrates seamlessly with external APIs (like Open-Meteo) to cross-check claims for heavy rainfall or bad weather at the exact reported GPS coordinates.
3. **Extreme Heat Auto-Approval Policy**: A humanitarian blanket policy that unconditionally auto-approves claims during severe heatwaves to prioritize rider safety over bureaucracy without location limitations.
4. **Transparent Financial Ledger**: Users have full dashboard visibility over their interactive "Total Premiums Deposited" versus their "Total Insurance Payouts Received".
5. **Admin Payout Gateway**: A secure dashboard for administrators featuring a per-claim payout system that logs every transaction natively into Firebase while completely preventing double-payments.

## How the AI Works
To minimize fraudulent behavior and scale trust, the system features a **Python-based Machine Learning Synchronizer**.

- **Predictive Modeling**: A trained Scikit-Learn `RandomForestRegressor` (served via `model.pkl`) evaluates the legitimacy of the rider environments based on deep meteorological features such as `rainfall_mm`, `humidity`, and `wind_speed`.
- **Inference Pipeline**: The isolated Python script (`sync_ai_scores.py`) connects securely to the Firestore database, fetches user claim records, aligns the data with the respective environmental characteristics, and passes it through the AI model via `joblib`. 
- **AI Legitimacy (Credit) Score**: The model calculates a localized confidence score (0-100%) reflecting how reliable the user's claim history is based on learned real versus fake claim patterns. This dynamic "Credit Score" is synchronized directly back to the Admin Dashboard (complete with a colored progress bar), heavily assisting admins in executing rapid, trustworthy approvals.

## Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6 Modules)
- **Backend/Database**: Firebase (Authentication & Firestore)
- **AI Integration**: Python 3.8+, Scikit-Learn, Joblib, Firebase-Admin (`serviceAccountKey.json`)
- **External Real-time Data**: Open-Meteo API
