# app.py - Complete Gig Worker Insurance Backend
from flask import Flask, jsonify, request, send_file
import requests
import joblib
import numpy as np
from datetime import datetime
import os

app = Flask(__name__)

# ============================================
# CONFIGURATION - UPDATE THESE!
# ============================================

# Get your free API key from https://openweathermap.org/api
WEATHER_API_KEY = "f1255cc2d0846ec893aca62c3223d3ac"  # ← YOU MUST UPDATE THIS

# List of supported cities
SUPPORTED_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata',
    'Hyderabad', 'Pune', 'Ahmedabad', 'Vadodara', 'Jaipur',
    'Lucknow', 'Nagpur', 'Indore', 'Bhopal', 'Patna',
    'Surat', 'Visakhapatnam', 'Kanpur', 'Varanasi', 'Agra'
]

# ============================================
# LOAD YOUR TRAINED MODEL
# ============================================

# Try to load your trained model
model = None
try:
    model = joblib.load('area_risk_model.pkl')
    print("✅ Model loaded successfully!")
except:
    print("⚠️ No trained model found. Using fallback calculation.")
    print("   Train your model first with main_pipeline.py")

# ============================================
# WEATHER API FUNCTIONS
# ============================================

def get_weather_for_city(city):
    """Get current weather for a city"""
    
    # If no API key, use mock data for demo
    if WEATHER_API_KEY == "YOUR_API_KEY_HERE":
        return get_mock_weather(city)
    
    try:
        url = "http://api.openweathermap.org/data/2.5/weather"
        params = {
            'q': city,
            'appid': WEATHER_API_KEY,
            'units': 'metric'
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if response.status_code == 200:
            return {
                'temperature': data['main']['temp'],
                'humidity': data['main']['humidity'],
                'wind_speed': data['wind']['speed'],
                'weather_desc': data['weather'][0]['description'],
                'rainfall': data.get('rain', {}).get('1h', 0),
                'icon': data['weather'][0]['icon']
            }
        else:
            print(f"API Error for {city}: {data.get('message', 'Unknown error')}")
            return get_mock_weather(city)
            
    except Exception as e:
        print(f"Error fetching weather for {city}: {e}")
        return get_mock_weather(city)

def get_mock_weather(city):
    """Return mock weather data for demo when API key is missing"""
    import random
    
    # Different weather based on city for demo variety
    city_weather = {
        'Mumbai': {'temp': 32, 'humidity': 75, 'wind': 15, 'rain': 45, 'desc': 'light rain'},
        'Delhi': {'temp': 38, 'humidity': 45, 'wind': 20, 'rain': 0, 'desc': 'clear sky'},
        'Bangalore': {'temp': 28, 'humidity': 65, 'wind': 12, 'rain': 10, 'desc': 'scattered clouds'},
        'Chennai': {'temp': 35, 'humidity': 70, 'wind': 18, 'rain': 5, 'desc': 'haze'},
        'Kolkata': {'temp': 34, 'humidity': 80, 'wind': 14, 'rain': 30, 'desc': 'light rain'},
        'Vadodara': {'temp': 36, 'humidity': 55, 'wind': 16, 'rain': 0, 'desc': 'clear sky'},
    }
    
    default = {'temp': 30, 'humidity': 60, 'wind': 12, 'rain': 0, 'desc': 'clear sky'}
    data = city_weather.get(city, default)
    
    # Add some randomness for realism
    return {
        'temperature': data['temp'] + random.uniform(-2, 2),
        'humidity': data['humidity'] + random.uniform(-5, 5),
        'wind_speed': data['wind'] + random.uniform(-2, 2),
        'weather_desc': data['desc'],
        'rainfall': data['rain'],
        'icon': '01d'
    }

# ============================================
# RISK CALCULATION
# ============================================

def calculate_risk_score(weather):
    """Calculate risk score from weather data using your model or fallback"""
    
    if model:
        # Use your trained model
        try:
            features = [[
                weather['rainfall'],
                weather['humidity'],
                weather['wind_speed']
            ]]
            risk_score = model.predict(features)[0]
        except:
            # Fallback if model prediction fails
            risk_score = fallback_calculation(weather)
    else:
        # Use fallback calculation
        risk_score = fallback_calculation(weather)
    
    # Ensure score is between 0-10
    risk_score = max(0, min(10, risk_score))
    
    # Determine risk level
    if risk_score < 3:
        level = "Low Risk"
    elif risk_score < 6:
        level = "Moderate Risk"
    elif risk_score < 8:
        level = "High Risk"
    else:
        level = "Critical Risk"
    
    return {
        'score': round(risk_score, 1),
        'level': level
    }

def fallback_calculation(weather):
    """Fallback formula if model isn't available"""
    score = (
        (weather['rainfall'] / 50) * 4 +      # Rain contribution (max 4)
        (weather['humidity'] / 100) * 3 +     # Humidity contribution (max 3)
        (weather['wind_speed'] / 30) * 3      # Wind contribution (max 3)
    )
    return score

# ============================================
# API ENDPOINTS
# ============================================

@app.route('/')
def home():
    """Redirect to registration"""
    return send_file('templates/register.html')

@app.route('/register')
def register():
    """Registration page"""
    return send_file('templates/register.html')

@app.route('/risk')
def risk():
    """Risk page for registered worker"""
    return send_file('templates/risk.html')

# ============================================
# API: Get all cities risk scores
# ============================================
@app.route('/api/all-cities-risk')
def all_cities_risk():
    """Get risk scores for all supported cities"""
    results = []
    
    for city in SUPPORTED_CITIES:
        weather = get_weather_for_city(city)
        risk = calculate_risk_score(weather)
        
        results.append({
            'city': city,
            'risk_score': risk['score'],
            'risk_level': risk['level'],
            'temperature': round(weather['temperature']),
            'weather_desc': weather['weather_desc'],
            'rainfall': weather['rainfall']
        })
    
    return jsonify({
        'cities': results,
        'timestamp': datetime.now().isoformat(),
        'total_cities': len(results)
    })

# ============================================
# API: Get single city risk
# ============================================
@app.route('/api/city-risk/<city>')
def city_risk(city):
    """Get risk score for a specific city"""
    
    if city not in SUPPORTED_CITIES:
        return jsonify({'error': 'City not supported'}), 404
    
    weather = get_weather_for_city(city)
    risk = calculate_risk_score(weather)
    
    return jsonify({
        'city': city,
        'risk_score': risk['score'],
        'risk_level': risk['level'],
        'weather': weather,
        'timestamp': datetime.now().isoformat()
    })

# ============================================
# API: Trigger payment (for teammate)
# ============================================
@app.route('/api/trigger-payment', methods=['POST'])
def trigger_payment():
    """Endpoint for teammate to call when payment is due"""
    data = request.json
    
    worker_id = data.get('workerId')
    amount = data.get('amount')
    city = data.get('city')
    reason = data.get('reason')
    
    # Generate payment link
    payment_link = f"http://localhost:5000/pay?workerId={worker_id}&amount={amount}&city={city}&reason={reason}"
    
    print(f"💰 Payment triggered: {worker_id} - ₹{amount} - {city}")
    
    return jsonify({
        'success': True,
        'payment_link': payment_link,
        'worker_id': worker_id,
        'amount': amount,
        'city': city
    })

# ============================================
# API: Get transaction history (for payment gateway)
# ============================================
transactions_db = []  # Simple in-memory storage

@app.route('/api/transaction/<worker_id>', methods=['GET'])
def get_transactions(worker_id):
    """Get transaction history for a worker"""
    worker_transactions = [t for t in transactions_db if t['worker_id'] == worker_id]
    return jsonify(worker_transactions)

@app.route('/api/payment/callback', methods=['POST'])
def payment_callback():
    """Callback from payment page"""
    data = request.json
    transactions_db.append(data)
    print(f"✅ Payment recorded: {data}")
    return jsonify({'success': True})

# ============================================
# Start Server
# ============================================
if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 GIG WORKER INSURANCE BACKEND")
    print("="*60)
    print(f"📍 Server: http://localhost:5000")
    print(f"📍 Supported cities: {len(SUPPORTED_CITIES)} cities")
    print(f"📍 Weather API: {'✅ Configured' if WEATHER_API_KEY != 'YOUR_API_KEY_HERE' else '⚠️ Using Mock Data'}")
    print("\n📊 Available Endpoints:")
    print("   GET  /                   - Landing page")
    print("   GET  /worker-dashboard    - Worker view")
    print("   GET  /admin-dashboard     - Admin view")
    print("   GET  /live-demo           - Live demo with all cities")
    print("   GET  /api/all-cities-risk - JSON data for all cities")
    print("   GET  /api/city-risk/{city} - JSON for single city")
    print("   POST /api/trigger-payment - Call from teammate")
    print("="*60)
    
    app.run(port=5000, debug=True)