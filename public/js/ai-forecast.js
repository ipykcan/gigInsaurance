// ai-forecast.js

// A simple client-side "AI" heuristics model that combines Open-Meteo weather
// with synthetic event generators to predict the working conditions for 7 days.

export async function getWorkingConditionForecast(lat, lng) {
    if (!lat || !lng) {
        throw new Error("Location required for forecast");
    }

    try {
        // Fetch 7 days of daily weather data from Open-Meteo
        // We request humidity and wind speed because the ML model uses:
        // ['rainfall_mm', 'humidity', 'wind_speed']
        const urlWithExtra = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,precipitation_sum,relative_humidity_2m_mean,windspeed_10m_max&timezone=auto`;
        const urlBasic = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,precipitation_sum&timezone=auto`;

        let req = await fetch(urlWithExtra);
        let data = null;
        if (!req.ok) {
            // Fallback if Open-Meteo rejects the extra params
            req = await fetch(urlBasic);
        }

        if (!req.ok) throw new Error("Failed to fetch weather data");
        data = await req.json();

        if (!data || !data.daily) throw new Error("Invalid forecast data");

        const daily = data.daily;
        const forecast = [];

        const AI_PREDICT_URL = "http://127.0.0.1:5000/predict";
        let aiStatusText = "AI pending";
        let aiServerFailed = false;

        // Optional news-based signals (from your local Python server).
        // If it fails (server not running / CORS / network), we fall back to heuristic factors.
        let newsHighlights = [];
        let strikeRiskPercentOverride = null;
        let newsRiskPercentOverride = null;

        // `nearestLocation` is passed as the 3rd argument from dashboard.js.
        // Backward compatible: if the caller doesn't pass it, we skip the news step.
        const nearestLocation = arguments[2] ?? null;
        const city = nearestLocation?.city ?? '';
        const state = nearestLocation?.state ?? '';

        if (city || state) {
            // Localized Mock News Generator (to avoid needing a paid API key)
            const area = city || state;
            const newsTemplates = [
                `Traffic diversions announced in ${area} due to metro construction.`,
                `Major accident reported on the outer ring road of ${area}, expect delays.`,
                `Delivery partner union in ${area} threatens flash strike this week over payout cuts.`,
                `${area} municipal corporation issues heavy rainfall alert for the next 48 hours.`,
                `Surge pricing expected in ${area} downtown due to upcoming local festival.`,
                `New speed limits enforced in ${area} city limits starting tomorrow.`,
                `Gig workers in ${area} demand better insurance coverage after recent incidents.`
            ];
            
            // Randomly select 2-3 headlines
            const shuffled = newsTemplates.sort(() => 0.5 - Math.random());
            newsHighlights = shuffled.slice(0, 3).map((title, index) => ({
                title: title,
                url: "#"
            }));
            
            // Pseudo-random risk overrides based on city hash
            let hash = 0;
            for (let i = 0; i < area.length; i++) hash = area.charCodeAt(i) + ((hash << 5) - hash);
            strikeRiskPercentOverride = Math.abs(hash % 100) > 70 ? Math.abs(hash % 40) + 40 : Math.abs(hash % 20);
            newsRiskPercentOverride = Math.abs((hash * 3) % 100) > 80 ? Math.abs(hash % 30) + 30 : Math.abs(hash % 15);
        }

        // Synthetic state to keep pseudo-random strikes consistent for the same dates 
        // to simulate a real predictive model on immutable conditions.

        for (let i = 0; i < 7; i++) {
            const dateStr = daily.time[i];
            const maxTemp = daily.temperature_2m_max[i];
            const precip = daily.precipitation_sum[i];
            const wCode = daily.weathercode[i];
            const humidity = daily.relative_humidity_2m_mean ? daily.relative_humidity_2m_mean[i] : null;
            const windSpeed = daily.windspeed_10m_max ? daily.windspeed_10m_max[i] : null;

            // AI Decision Rules (Heuristics mapping environmental states to rider risks)
            let status = 'Safe to Work';
            let riskLevel = 'green';
            let emoji = '✅';

            if (maxTemp >= 40) {
                status = 'Extreme Heat Warning';
                riskLevel = 'red';
                emoji = '🔥';
            } else if (precip >= 20) {
                status = 'Heavy Rain / Flood Risk';
                riskLevel = 'red';
                emoji = '⛈️';
            } else if (precip > 5) {
                status = 'Moderate Rain';
                riskLevel = 'orange';
                emoji = '🌧️';
            } else if (maxTemp >= 34) {
                status = 'High Temp Advisory';
                riskLevel = 'orange';
                emoji = '☀️';
            } else if (wCode >= 95) {
                status = 'Thunderstorms Predicted';
                riskLevel = 'red';
                emoji = '⚡';
            }

            // Pseudo-random modifier for socioeconomic strikes based on date hash
            const hash = dateStr.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            if (hash % 11 === 0 && riskLevel !== 'red') {
                status = 'Labor Strike Warning';
                riskLevel = 'red';
                emoji = '⚠️';
            } else if (hash % 7 === 0 && riskLevel === 'green') {
                status = 'High Delivery Demand';
                riskLevel = 'green';
                emoji = '📈';
            }

            // --- Multi-factor risk scoring for the dashboard ---
            // These are used only for UI breakdown (what is contributing to ops risk).
            let weatherRiskPercent = 20;
            if (maxTemp >= 40) weatherRiskPercent = 90;
            else if (maxTemp >= 34) weatherRiskPercent = 65;
            else if (precip >= 20) weatherRiskPercent = 85;
            else if (precip > 5) weatherRiskPercent = 50;
            else if (wCode >= 95) weatherRiskPercent = 75;
            else weatherRiskPercent = 25;

            let strikeRiskPercent = typeof strikeRiskPercentOverride === 'number' ? strikeRiskPercentOverride : 15;
            if (typeof strikeRiskPercentOverride !== 'number') {
                if (hash % 11 === 0) strikeRiskPercent = 85;
                else if (hash % 7 === 0) strikeRiskPercent = 45;
            }

            let newsRiskPercent = typeof newsRiskPercentOverride === 'number' ? newsRiskPercentOverride : 15;
            if (typeof newsRiskPercentOverride !== 'number') {
                if (precip >= 20) newsRiskPercent = 70;
                else if (wCode >= 95) newsRiskPercent = 85;
                else if (wCode >= 51) newsRiskPercent = 55;
                else if (precip > 5) newsRiskPercent = 40;
                // Rare extra bump for "news incident"
                if (hash % 13 === 0) newsRiskPercent = Math.min(95, newsRiskPercent + 20);
            }

            // --- Real AI model inference (via Python server) ---
            // If the server is reachable, use it to compute working_condition_percent.
            let workingConditionPercent = null;
            if (typeof humidity === 'number' && typeof windSpeed === 'number') {
                try {
                    const resp = await fetch(AI_PREDICT_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            features: {
                                rainfall_mm: precip,
                                humidity: humidity,
                                wind_speed: windSpeed
                            }
                        })
                    });
                    if (resp.ok) {
                        const json = await resp.json();
                        workingConditionPercent = json?.working_condition_percent;
                    }
                } catch (e) {
                    // If server isn't running, keep heuristic values as fallback.
                    if (!aiServerFailed) {
                        aiServerFailed = true;
                        aiStatusText = "AI server not running";
                    }
                }
            }

            // If ML returned a percent, use it to drive risk level UI.
            if (typeof workingConditionPercent === 'number') {
                if (workingConditionPercent >= 70) {
                    riskLevel = 'green';
                    status = 'AI: Safe to Work';
                    emoji = '✅';
                } else if (workingConditionPercent >= 40) {
                    riskLevel = 'orange';
                    status = 'AI: Caution / Reduced Operations';
                    emoji = '⚠️';
                } else {
                    riskLevel = 'red';
                    status = 'AI: High Risk / Pause Operations';
                    emoji = '🚫';
                }
            }

            forecast.push({
                date: dateStr,
                maxTemp,
                precip,
                humidity,
                windSpeed,
                weatherRiskPercent,
                strikeRiskPercent,
                newsRiskPercent,
                workingConditionPercent,
                aiStatus: aiServerFailed ? aiStatusText : null,
                status,
                riskLevel,
                emoji
            });
        }

        return { forecast, newsHighlights };
    } catch (e) {
        console.error("AI Forecast error:", e);
        return null; // Let UI handle rendering fallback
    }
}
