// Data
const INDIAN_LOCATIONS = {
    "Gujarat": {
        "Vadodara": [
            { name: "Alkapuri", lat: 22.3130, lng: 73.1650 },
            { name: "Station Road", lat: 22.3117, lng: 73.1812 },
            { name: "Waghodia", lat: 22.3008, lng: 73.3639 },
            { name: "Sama Savli", lat: 22.3486, lng: 73.1932 },
            { name: "Gotri", lat: 22.3087, lng: 73.1497 }
        ],
        "Ahmedabad": [
            { name: "Navrangpura", lat: 23.0360, lng: 72.5469 },
            { name: "Satellite", lat: 23.0276, lng: 72.5054 },
            { name: "Vastrapur", lat: 23.0384, lng: 72.5290 },
            { name: "Bopal", lat: 23.0333, lng: 72.4634 }
        ],
        "Surat": [
            { name: "Adajan", lat: 21.1963, lng: 72.7937 },
            { name: "Vesu", lat: 21.1418, lng: 72.7709 },
            { name: "Varachha", lat: 21.2185, lng: 72.8465 }
        ]
    },
    "Maharashtra": {
        "Mumbai": [
            { name: "Andheri", lat: 19.1136, lng: 72.8697 },
            { name: "Bandra", lat: 19.0596, lng: 72.8295 },
            { name: "Dadar", lat: 19.0193, lng: 72.8429 }
        ],
        "Pune": [
            { name: "Kothrud", lat: 18.5074, lng: 73.8077 },
            { name: "Viman Nagar", lat: 18.5679, lng: 73.9143 },
            { name: "Hinjewadi", lat: 18.5913, lng: 73.7389 }
        ]
    },
    "Karnataka": {
        "Bengaluru": [
            { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
            { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
            { name: "Whitefield", lat: 12.9698, lng: 77.7499 }
        ]
    },
    "Delhi": {
        "New Delhi": [
            { name: "Connaught Place", lat: 28.6315, lng: 77.2167 },
            { name: "Hauz Khas", lat: 28.5494, lng: 77.2001 },
            { name: "Dwarka", lat: 28.5823, lng: 77.0500 }
        ]
    }
};

// Services
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

function validateClaimLocation(homeZone, claimLat, claimLng, maxRadiusKm = 5) {
    if (!homeZone || !homeZone.lat || !homeZone.lng) {
        return { valid: false, message: 'Home zone is not set.' };
    }

    const distance = getDistanceFromLatLonInKm(homeZone.lat, homeZone.lng, claimLat, claimLng);

    if (distance <= maxRadiusKm) {
        return { valid: true, distance: distance.toFixed(2), message: `Valid: Claim is inside your Home Zone (${distance.toFixed(2)} km away).` };
    } else {
        return { valid: false, distance: distance.toFixed(2), message: `Invalid: Claim is outside the allowed ${maxRadiusKm}km operational radius (${distance.toFixed(2)} km away).` };
    }
}

async function verifyWeatherCondition(lat, lng) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&precipitation=true`;
        const res = await fetch(url);
        const data = await res.json();

        // Open-Meteo weather codes (WMO)
        // 0: Clear, 1-3: Cloudy, 51+: Rain/Drizzle/Snow, 95+: Thunderstorm
        const code = data.current_weather.weathercode;
        const isBadWeather = code >= 51; // Consider anything from drizzle upwards as "bad weather"

        return {
            verified: isBadWeather,
            detail: isBadWeather ? `Bad weather detected: Open-Meteo reported condition code ${code}.` : `No significant bad weather detected (Condition code ${code}).`,
            data: data.current_weather
        };
    } catch (error) {
        console.error("Open-Meteo fetch failed:", error);
        return { verified: false, detail: "Error reaching weather API." };
    }
}

async function verifyNewsIncident(issueType, lat, lng) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create a pseudo-random success rate for demonstration purposes
    const randomCheck = Math.random();
    const isVerified = randomCheck > 0.4; // 60% chance to be verified visually

    if (isVerified) {
        return {
            verified: true,
            detail: `Verified: Active ${issueType} reports confirmed in the vicinity via mocked local news aggregation.`
        }
    } else {
        return {
            verified: false,
            detail: `Unverified: No recent ${issueType} incidents found at this location within the last 24 hours.`
        }
    }
}

// App Logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    lucide.createIcons();

    let homeZone = null;
    let selectedState = '';
    let selectedCity = '';
    let selectedArea = '';

    // DOM Elements
    const homeZoneActiveBadge = document.getElementById('homeZoneActiveBadge');
    const homeZoneSet = document.getElementById('homeZoneSet');
    const homeZoneControls = document.getElementById('homeZoneControls');
    const homeZoneCoords = document.getElementById('homeZoneCoords');

    const btnDetectLocation = document.getElementById('btnDetectLocation');
    const btnSetManually = document.getElementById('btnSetManually');

    const selectState = document.getElementById('selectedState');
    const selectCity = document.getElementById('selectedCity');
    const selectArea = document.getElementById('selectedArea');
    const claimType = document.getElementById('claimType');

    const claimForm = document.getElementById('claimForm');
    const btnSubmitClaim = document.getElementById('btnSubmitClaim');

    const resultBox = document.getElementById('resultBox');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');

    // Initialize state
    const savedZone = localStorage.getItem('user_home_zone');
    if (savedZone) {
        homeZone = JSON.parse(savedZone);
        updateHomeZoneUI();
    }

    // Populate States
    const states = Object.keys(INDIAN_LOCATIONS);
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        selectState.appendChild(option);
    });

    // Event Listeners
    selectState.addEventListener('change', (e) => {
        selectedState = e.target.value;

        // Reset and populate cities
        selectCity.innerHTML = '<option value="" disabled selected>Select City</option>';
        selectCity.disabled = false;

        selectArea.innerHTML = '<option value="" disabled selected>Select Area</option>';
        selectArea.disabled = true;
        selectedCity = '';
        selectedArea = '';

        if (selectedState && INDIAN_LOCATIONS[selectedState]) {
            const cities = Object.keys(INDIAN_LOCATIONS[selectedState]);
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                selectCity.appendChild(option);
            });
        }
    });

    selectCity.addEventListener('change', (e) => {
        selectedCity = e.target.value;

        // Reset and populate areas
        selectArea.innerHTML = '<option value="" disabled selected>Select Area</option>';
        selectArea.disabled = false;
        selectedArea = '';

        if (selectedState && selectedCity && INDIAN_LOCATIONS[selectedState][selectedCity]) {
            const areas = INDIAN_LOCATIONS[selectedState][selectedCity];
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.name;
                option.textContent = area.name;
                selectArea.appendChild(option);
            });
        }
    });

    selectArea.addEventListener('change', (e) => {
        selectedArea = e.target.value;
    });

    btnDetectLocation.addEventListener('click', () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const newZone = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
                setHomeZoneData(newZone);
            }, (error) => {
                alert("Geolocation error: " + error.message)
            })
        } else {
            alert("Geolocation is not supported by your browser.")
        }
    });

    btnSetManually.addEventListener('click', () => {
        const newZone = { lat: 40.7128, lng: -74.0060 }
        setHomeZoneData(newZone);
        alert("Home Zone set to Mock Coordinates (NYC: 40.7128, -74.0060)")
    });

    claimForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!homeZone) {
            showResult('error', 'Claim Invalidated', 'You must set your Home Zone first.');
            return;
        }

        if (!selectedState || !selectedCity || !selectedArea) {
            showResult('error', 'Claim Invalidated', 'Please select a complete local area from the dropdowns.');
            return;
        }

        const areasList = INDIAN_LOCATIONS[selectedState][selectedCity];
        const areaConfig = areasList.find(a => a.name === selectedArea);

        if (!areaConfig) {
            showResult('error', 'Claim Invalidated', 'Could not resolve coordinates for the selected area.');
            return;
        }

        const cLat = areaConfig.lat;
        const cLng = areaConfig.lng;
        const cType = claimType.value;

        // Loading state
        btnSubmitClaim.disabled = true;
        btnSubmitClaim.innerHTML = '<i data-lucide="loader-2" class="spinner"></i> Verifying...';
        lucide.createIcons();
        resultBox.style.display = 'none';

        try {
            // Step 1: Check if inside home zone
            const distanceCheck = validateClaimLocation(homeZone, cLat, cLng, 5);

            if (!distanceCheck.valid) {
                showResult('error', 'Claim Invalidated', distanceCheck.message);
                resetButton();
                return;
            }

            // Step 2: Validate via secondary external API
            let verifyResult;
            if (cType === 'weather') {
                verifyResult = await verifyWeatherCondition(cLat, cLng);
            } else {
                verifyResult = await verifyNewsIncident(cType, cLat, cLng);
            }

            if (verifyResult.verified) {
                showResult('success', 'Claim Verified', `${distanceCheck.message}\n\nExternal Verification:\n${verifyResult.detail}`);
            } else {
                showResult('error', 'Claim Invalidated', `${distanceCheck.message}\n\nExternal Verification Failed:\n${verifyResult.detail}`);
            }

        } catch (err) {
            showResult('error', 'Claim Invalidated', "System error: " + err.message);
        }

        resetButton();
    });

    function setHomeZoneData(zone) {
        homeZone = zone;
        localStorage.setItem('user_home_zone', JSON.stringify(zone));
        updateHomeZoneUI();
    }

    function updateHomeZoneUI() {
        if (!homeZone) return;
        homeZoneActiveBadge.style.display = 'inline-block';
        homeZoneControls.style.display = 'none';
        homeZoneSet.style.display = 'block';
        homeZoneCoords.textContent = `Lat: ${homeZone.lat.toFixed(4)}, Lng: ${homeZone.lng.toFixed(4)}`;
    }

    function showResult(type, title, message) {
        resultBox.style.display = 'block';
        resultBox.className = `glass-panel result-modal animate-fade-in result-${type}`;

        if (type === 'error') {
            resultIcon.innerHTML = '<i data-lucide="x-circle" color="var(--accent-error)"></i>';
        } else {
            resultIcon.innerHTML = '<i data-lucide="check-circle" color="var(--accent-success)"></i>';
        }

        resultTitle.textContent = title;
        resultMessage.textContent = message;
        lucide.createIcons();
    }

    function resetButton() {
        btnSubmitClaim.disabled = false;
        btnSubmitClaim.textContent = 'Verify & Submit Claim';
    }
});
