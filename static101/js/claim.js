import {
    auth,
    db,
    collection,
    addDoc,
    serverTimestamp,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc
} from './firebase-config.js';

import { INDIAN_LOCATIONS, getDistanceFromLatLonInKm } from './locations.js';

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

async function verifyExtremeHeatCondition(lat, lng, thresholdC = 40) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
        const res = await fetch(url);
        const data = await res.json();
        const temp = data?.current_weather?.temperature;
        const ok = typeof temp === 'number' && temp >= thresholdC;
        return {
            verified: ok,
            detail: ok
                ? `Verified: Extreme heat detected (Current temperature ${temp}°C ≥ ${thresholdC}°C).`
                : `Unverified: Temperature not high enough for extreme heat (Current ${temp ?? '—'}°C, threshold ${thresholdC}°C).`,
            data: data?.current_weather ?? null
        };
    } catch (error) {
        console.error("Open-Meteo fetch failed:", error);
        return { verified: false, detail: "Error reaching weather API." };
    }
}

// App Logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    lucide.createIcons();

    // If an admin session exists, never allow claim page
    const role = localStorage.getItem('session_role');
    if (role === 'admin' && localStorage.getItem('admin_authenticated') === 'true') {
        window.location.href = "../html/admin-dashboard.html";
        return;
    }

    let currentUser = null;
    let homeZoneStorageKey = null;

    // Listen for auth changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            localStorage.setItem('session_role', 'client');
            homeZoneStorageKey = `user_home_zone_${user.uid}`;
            await hydrateHomeZoneForUser(user.uid);
        } else {
            // Redirect to landing if not authenticated
            window.location.href = "../html/register.html";
        }
    });

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
    const btnSignOut = document.getElementById('btnSignOut');

    if (btnSignOut) {
        btnSignOut.addEventListener('click', () => {
            signOut(auth);
        });
    }

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

    // Initialize state: wait for auth + hydrateHomeZoneForUser

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
            let distanceCheck = { valid: true, message: 'Location validation skipped for policy override.' };
            let verifyResult = { verified: true, detail: '' };

            if (cType === 'extreme_heat') {
                verifyResult = {
                    verified: true,
                    detail: 'Auto-approved: Extreme Heat claims are unconditionally accepted based on blanket policy.'
                };
            } else {
                // Step 1: Check if inside home zone
                distanceCheck = validateClaimLocation(homeZone, cLat, cLng, 5);

                if (!distanceCheck.valid) {
                    showResult('error', 'Claim Invalidated', distanceCheck.message);
                    resetButton();
                    return;
                }

                // Step 2: Validate via secondary external API
                if (cType === 'weather') {
                    verifyResult = await verifyWeatherCondition(cLat, cLng);
                } else {
                    verifyResult = await verifyNewsIncident(cType, cLat, cLng);
                }
            }

            const isVerifiedOverall = verifyResult.verified && distanceCheck.valid;

            if (verifyResult.verified) {
                showResult('success', 'Claim Verified', `${distanceCheck.message}\n\nVerification Response:\n${verifyResult.detail}`);
            } else {
                showResult('error', 'Claim Invalidated', `${distanceCheck.message}\n\nVerification Failed:\n${verifyResult.detail}`);
            }

            // Save the claim result to Firestore
            if (currentUser) {
                try {
                    await addDoc(collection(db, "claims"), {
                        user_id: currentUser.uid,
                        issue_type: cType,
                        state: selectedState,
                        city: selectedCity,
                        area: selectedArea,
                        is_verified: isVerifiedOverall,
                        verification_message: verifyResult.detail,
                        timestamp: serverTimestamp()
                    });
                    console.log("Claim logged to Firestore successfully.");
                } catch (e) {
                    console.error("Error logging claim to Firestore: ", e);
                }
            }

        } catch (err) {
            showResult('error', 'Claim Invalidated', "System error: " + err.message);
        }

        resetButton();
    });

    function setHomeZoneData(zone) {
        homeZone = zone;
        if (homeZoneStorageKey) {
            localStorage.setItem(homeZoneStorageKey, JSON.stringify(zone));
        }
        updateHomeZoneUI();
        persistHomeZoneIfNeeded(zone).catch((e) => console.error('Failed to persist home zone', e));
    }

    async function hydrateHomeZoneForUser(uid) {
        // Reset UI for a fresh user session (prevents "shared locked" effect)
        homeZone = null;
        if (homeZoneActiveBadge) homeZoneActiveBadge.style.display = 'none';
        if (homeZoneSet) homeZoneSet.style.display = 'none';
        if (homeZoneControls) homeZoneControls.style.display = 'flex';

        // Prefer Firestore (per-user, cross-device)
        try {
            const ref = doc(db, 'users', uid);
            const snap = await getDoc(ref);
            const data = snap.exists() ? snap.data() : null;
            if (data?.homeZone?.lat && data?.homeZone?.lng) {
                homeZone = { lat: data.homeZone.lat, lng: data.homeZone.lng };
                if (homeZoneStorageKey) localStorage.setItem(homeZoneStorageKey, JSON.stringify(homeZone));
                updateHomeZoneUI();
                return;
            }
        } catch (e) {
            console.warn('Could not load home zone from Firestore', e);
        }

        // Fallback: per-user localStorage
        const saved = homeZoneStorageKey ? localStorage.getItem(homeZoneStorageKey) : null;
        if (saved) {
            try {
                homeZone = JSON.parse(saved);
                updateHomeZoneUI();
            } catch { }
        }
    }

    async function persistHomeZoneIfNeeded(zone) {
        if (!currentUser) return;
        const ref = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : null;

        // Permanent lock: don't overwrite if already set in Firestore
        if (existing && existing.homeZone && typeof existing.homeZone.lat !== 'undefined' && typeof existing.homeZone.lng !== 'undefined') {
            return;
        }

        await setDoc(ref, {
            uid: currentUser.uid,
            email: currentUser.email ?? null,
            homeZone: { lat: zone.lat, lng: zone.lng },
            homeZoneSetAt: serverTimestamp()
        }, { merge: true });
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
