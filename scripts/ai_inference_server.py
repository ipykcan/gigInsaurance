import json
import os
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

import joblib


MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")


def load_model():
    data = joblib.load(MODEL_PATH)
    if isinstance(data, dict) and "model" in data:
        return data["model"]
    return data


MODEL = load_model()


def clamp(n, lo, hi):
    return max(lo, min(hi, n))


def predict_working_condition_percent(rainfall_mm, humidity, wind_speed):
    """
    Your trained model is a RandomForestRegressor that predicts:
      severity_y: 0=Minor, 1=Serious, 2=Fatal
    We convert severity -> "working condition safe%" where:
      Minor -> 100%
      Fatal -> 0%
    """
    features = [[float(rainfall_mm), float(humidity), float(wind_speed)]]
    severity_y = float(MODEL.predict(features).ravel()[0])
    severity_y = clamp(severity_y, 0.0, 2.0)

    safe_percent = (2.0 - severity_y) / 2.0 * 100.0
    safe_percent = float(clamp(safe_percent, 0.0, 100.0))
    return {
        "severity_y": severity_y,
        "working_condition_percent": safe_percent,
    }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Allow browser fetch from file:// or localhost
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/predict":
            self._send_json(404, {"error": "Not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
            data = json.loads(raw.decode("utf-8"))

            f = data.get("features", data)
            rainfall_mm = f.get("rainfall_mm")
            humidity = f.get("humidity")
            wind_speed = f.get("wind_speed")

            if rainfall_mm is None or humidity is None or wind_speed is None:
                self._send_json(400, {"error": "Missing features: rainfall_mm, humidity, wind_speed"})
                return

            result = predict_working_condition_percent(rainfall_mm, humidity, wind_speed)
            self._send_json(200, {"ok": True, **result})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def do_GET(self):
        if self.path != "/news":
            self._send_json(404, {"error": "Not found"})
            return

        try:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            city = (params.get("city", [""])[0] or "").strip()
            state = (params.get("state", [""])[0] or "").strip()

            # If both are missing, we can't scope news; return empty.
            if not city and not state:
                self._send_json(200, {
                    "ok": True,
                    "city": city,
                    "state": state,
                    "strikeRiskPercent": 15,
                    "newsRiskPercent": 15,
                    "headlines": [],
                })
                return

            location_terms = []
            if state:
                location_terms.append(f"\"{state}\"")
            if city:
                location_terms.append(f"\"{city}\"")
            location_expr = "(" + " OR ".join(location_terms) + ")"

            # Query last 48 hours.
            end_ts = int(time.time())
            start_ts = end_ts - 48 * 3600

            def to_gdelt_dt(epoch):
                # GDELT expects YYYYMMDDHHMMSS
                return time.strftime("%Y%m%d%H%M%S", time.gmtime(epoch))

            startdatetime = to_gdelt_dt(start_ts)
            enddatetime = to_gdelt_dt(end_ts)

            def fetch_gdelt(query):
                # GDELT2 Doc API - free, no key
                base = "https://api.gdeltproject.org/api/v2/doc/doc"
                q = {
                    "query": query,
                    "mode": "ArtList",
                    "format": "json",
                    "startdatetime": startdatetime,
                    "enddatetime": enddatetime,
                    "maxrecords": "20",
                }
                url = base + "?" + urllib.parse.urlencode(q)
                req = urllib.request.Request(url, headers={"User-Agent": "FraudShield/1.0"})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw)

            # Strike / labor disruptions
            strike_query = f"{location_expr} (strike OR protest OR \"industrial action\" OR labor OR boycott OR \"work stoppage\")"
            # Broader disruption news
            news_query = f"{location_expr} (accident OR disaster OR flood OR storm OR earthquake OR \"road closure\" OR disruption OR outage)"

            strike_data = fetch_gdelt(strike_query)
            news_data = fetch_gdelt(news_query)

            strike_articles = strike_data.get("articles") or []
            news_articles = news_data.get("articles") or []

            strike_count = len(strike_articles)
            news_count = len(news_articles)

            def to_risk_percent(count, base=15):
                # Simple scaling: every ~3 articles increases risk by 10 up to 95.
                risk = base + (count / 3.0) * 10.0
                return float(max(0, min(95, round(risk, 0))))

            strikeRiskPercent = to_risk_percent(strike_count, base=15)
            newsRiskPercent = to_risk_percent(news_count, base=15)

            # Return top headlines from the "news" query.
            headlines = []
            for a in news_articles[:5]:
                title = a.get("title") or a.get("domain") or "News"
                url = a.get("url") or ""
                headlines.append({"title": title, "url": url})

            self._send_json(200, {
                "ok": True,
                "city": city,
                "state": state,
                "strikeRiskPercent": strikeRiskPercent,
                "newsRiskPercent": newsRiskPercent,
                "headlines": headlines,
                "debug": {"strike_count": strike_count, "news_count": news_count},
            })
        except Exception as e:
            # If network/rate-limits block us, return safe defaults
            self._send_json(200, {
                "ok": True,
                "strikeRiskPercent": 15,
                "newsRiskPercent": 15,
                "headlines": [],
                "error": str(e),
            })

    def log_message(self, format, *args):
        # Silence default console spam
        return


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def main():
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadedHTTPServer((host, port), Handler)
    print(f"AI inference server running on http://{host}:{port}/predict")
    print("Request JSON: { features: { rainfall_mm, humidity, wind_speed } }")
    server.serve_forever()


if __name__ == "__main__":
    main()

