# Fraud Shield: Micro-Insurance for Delivery Partners

> **A real-time, AI-powered geofenced micro-insurance platform built to protect gig-economy delivery riders from unforeseen disruptions.**
>  **link to website**: [https://fraud-detection-bf47b.web.app/] 

## What is this project for?
In the face of recent market crashes and economic volatility, gig workers—especially delivery riders—are often left without a financial safety net. They face daily risks ranging from extreme weather conditions (heavy rains, severe heatwaves) to sudden geopolitical strikes or local disasters that halt their daily earnings. 

**Fraud Shield** acts as an on-demand micro-insurance platform specifically tailored for these delivery guys. It allows riders to deposit a nominal weekly premium (e.g., ₹100) and easily file geofenced claims whenever they are sidelined by external factors. When a claim is verified, riders receive an instant payout (e.g., ₹1000) to compensate for lost wages, establishing a crucial financial safety net during tough economic downswings.

## Who are the Users & Why Are They Important?
- **Delivery Partners (Clients)**: The reliable backbone of the modern on-demand delivery market. They are highly vulnerable to localized disruptions and market crashes. Providing them an accessible, transparent financial cushion preserves their livelihood and dignity.
- **System Admins (Insurance Providers)**: Operating the backend claims platform, admins leverage AI and real-time verifiable data (GPS metrics, weather APIs) to instantly approve payouts securely while aggressively combatting fraudulent/fake claims.

## Key Features
1. **Direct Registration Flow with Premium Calculation**: A streamlined signup process on the landing page where a rider's designated premium is dynamically calculated during account creation.
2. **Comprehensive Insurance Payment System**: Users can make weekly premium deposits. The interactive dashboard explicitly tracks and visualizes "Total Premiums Deposited" versus "Total Insurance Payouts Received" to ensure a transparent financial ledger.
3. **Geofenced Claim Verification**: Riders set a permanent "Home/Delivery Zone" hierarchically (State -> City -> Local Area). Claims are strictly checked against a **5km operational radius** using the Haversine formula to absolutely prevent location spoofing.
4. **Real-time API Validation**: Integrates seamlessly with external APIs (like Open-Meteo) to cross-check claims for heavy rainfall, extreme heat, or bad weather at the exact reported GPS coordinates.
5. **Dashboard Location Display**: Instead of displaying raw latitude and longitude points, the user dashboard dynamically reverse-geocodes user coordinates into human-readable local area names.
6. **Extreme Heat Auto-Approval Policy**: A humanitarian blanket policy that unconditionally auto-approves claims during severe heatwaves to prioritize rider safety over bureaucracy.
7. **Admin Payout Gateway**: A secure interactive dashboard for administrators featuring a per-claim payout system that logs every transaction natively into Firebase while completely preventing duplicate payouts.

## How the AI Works
To minimize fraudulent behavior and scale trust, the system features a **Python-based Machine Learning Synchronizer** trained on comprehensive datasets (such as Indian climate and accident prediction records via `Indian_Climate_Dataset_2024_2025.csv` and `accident_prediction_india.csv`).

- **Predictive Modeling**: A trained Scikit-Learn `RandomForestRegressor` (served via `ai_inference_server.py`) evaluates the legitimacy of the rider environments based on deep meteorological and real-world features.
- **Inference Pipeline**: The isolated Python script (`sync_ai_scores.py`) connects securely to the Firestore database (using `serviceAccountKey.json`), fetches user claim records, aligns the data with the respective environmental characteristics, and runs predictions.
- **AI Legitimacy Score**: The model calculates a localized confidence score (0-100%) reflecting how reliable the user's claim history is based on learned real versus fake claim patterns. This dynamic "Credit Score" is synchronized directly back to the Admin Dashboard (complete with a colored progress bar), heavily assisting admins in executing rapid, trustworthy approvals.

## Tech Stack
- **Frontend Architecture**: Multi-page layout (Index/Registration, User Dashboard, Claim Verification, Data Visualizations) utilizing Vanilla HTML5, CSS3, JavaScript (ES6 Modules).
- **Backend/Database**: Firebase Suite (Authentication & Cloud Firestore) integrated via native JavaScript configs (`firebase-config.js`).
- **AI Integration**: Python 3.8+, Scikit-Learn, Joblib, Flask/FastAPI (for AI Server), Firebase-Admin.
- **External Real-time Data**: Open-Meteo API for real-time weather analytics and reverse geocoding integrations.
