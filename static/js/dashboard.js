import { auth, db, onAuthStateChanged, signOut, collection, getDocs, query, where, addDoc, serverTimestamp } from './firebase-config.js';
import { getNearestLocation } from './locations.js';
import { getWorkingConditionForecast } from './ai-forecast.js';

document.addEventListener('DOMContentLoaded', () => {
    // If an admin session exists, never allow client dashboard
    const role = localStorage.getItem('session_role');
    if (role === 'admin' && localStorage.getItem('admin_authenticated') === 'true') {
        window.location.href = "../html/admin-dashboard.html";
        return;
    }

    // 1. Check Auth State to protect the dashboard
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // User is signed out, redirect to login page
            window.location.href = "../html/register.html";
        } else {
            localStorage.setItem('session_role', 'client');
            // Update the UI with user info dynamically
            const userNameElements = document.querySelectorAll('.profile-name');
            const avatarElements = document.querySelectorAll('.avatar-circle');

            const username = user.email ? user.email.split('@')[0] : 'User';
            const initial = username.charAt(0).toUpperCase();

            userNameElements.forEach(el => el.textContent = username);
            avatarElements.forEach(el => el.textContent = initial);

            // Fetch and display Location from Claim Home Zone (per-user)
            const locationDisplay = document.querySelector('.profile-location span');
            if (locationDisplay) {
                const savedZone = localStorage.getItem(`user_home_zone_${user.uid}`);
                if (savedZone) {
                    try {
                        const zone = JSON.parse(savedZone);
                        const nearest = getNearestLocation(zone.lat, zone.lng);
                        if (nearest) {
                            locationDisplay.textContent = `${nearest.name}, ${nearest.city}`;
                        } else {
                            locationDisplay.textContent = `Lat: ${zone.lat.toFixed(4)}, Lng: ${zone.lng.toFixed(4)}`;
                        }

                        // Load 7-Day AI Forecast automatically!
                        loadForecast(zone.lat, zone.lng, nearest);

                    } catch (e) {
                        locationDisplay.textContent = 'Location Unknown';
                        renderForecastEmpty('Location Invalid. Cannot generate AI predictive forecast.');
                    }
                } else {
                    locationDisplay.textContent = 'Home Zone Not Set';
                    renderForecastEmpty('Set your Home Zone in the Claim panel to generate an AI predictive forecast.');
                }
            }

            // Load claim summary stats
            await loadClientClaimStats(user.uid);
            await loadFinancialStats(user.uid);
        }
    });

    // 2. Handle Sign Out
    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
        btnSignOut.addEventListener('click', async () => {
            try {
                // Disable button and show processing state
                btnSignOut.disabled = true;
                btnSignOut.textContent = "Signing Out...";

                await signOut(auth);
                // onAuthStateChanged will catch this and naturally redirect
            } catch (error) {
                console.error("Error signing out:", error);
                btnSignOut.disabled = false;
                btnSignOut.textContent = "Sign Out";
                alert("Failed to sign out. Please try again.");
            }
        });
    }

    // Existing Dashboard UI Logic (can be expanded later)
    console.log("Dashboard JS loaded.");

    async function loadClientClaimStats(uid) {
        const statAccepted = document.getElementById('statAccepted');
        const statRejected = document.getElementById('statRejected');
        const statTotal = document.getElementById('statTotal');
        const barAccepted = document.getElementById('barAccepted');
        const barRejected = document.getElementById('barRejected');

        try {
            const q = query(collection(db, 'claims'), where('user_id', '==', uid));
            const snap = await getDocs(q);
            let accepted = 0;
            let rejected = 0;

            snap.forEach(docSnap => {
                const c = docSnap.data();
                if (c && c.is_verified) accepted += 1;
                else rejected += 1;
            });

            const total = accepted + rejected;
            if (statAccepted) statAccepted.textContent = String(accepted);
            if (statRejected) statRejected.textContent = String(rejected);
            if (statTotal) statTotal.textContent = String(total);

            const accPct = total === 0 ? 0 : Math.round((accepted / total) * 100);
            const rejPct = total === 0 ? 0 : Math.round((rejected / total) * 100);
            if (barAccepted) barAccepted.style.width = `${accPct}%`;
            if (barRejected) barRejected.style.width = `${rejPct}%`;
        } catch (e) {
            console.error('Failed to load claim stats', e);
        }
    }

    async function loadFinancialStats(uid) {
        const userTotalDeposits = document.getElementById('userTotalDeposits');
        const userTotalPayouts = document.getElementById('userTotalPayouts');

        try {
            // Get sum of deposits
            const qDep = query(collection(db, 'deposits'), where('user_id', '==', uid));
            const snapDep = await getDocs(qDep);
            let totalDep = 0;
            snapDep.forEach(d => totalDep += d.data().amount || 0);

            // Get sum of payouts (payments)
            const qPay = query(collection(db, 'payments'), where('user_id', '==', uid));
            const snapPay = await getDocs(qPay);
            let totalPay = 0;
            snapPay.forEach(d => totalPay += d.data().amount || 0);

            if (userTotalDeposits) userTotalDeposits.textContent = `₹${totalDep}`;
            if (userTotalPayouts) userTotalPayouts.textContent = `₹${totalPay}`;
        } catch (e) {
            console.error('Failed to load financial stats', e);
        }
    }

    const btnPayPremium = document.getElementById('btnPayPremium');
    if (btnPayPremium) {
        btnPayPremium.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) return;

            const msgEl = document.getElementById('premiumMessage');
            btnPayPremium.disabled = true;
            btnPayPremium.innerHTML = 'Processing Payment...';
            msgEl.textContent = '';

            // Spoof delay for payment gateway
            await new Promise(resolve => setTimeout(resolve, 1500));

            try {
                await addDoc(collection(db, 'deposits'), {
                    user_id: user.uid,
                    amount: 100,
                    currency: 'INR',
                    timestamp: serverTimestamp()
                });

                msgEl.style.color = '#10b981';
                msgEl.textContent = 'Payment of ₹100 successful!';

                // Refresh UI
                await loadFinancialStats(user.uid);
            } catch (e) {
                console.error("Payment failed", e);
                msgEl.style.color = '#ef4444';
                msgEl.textContent = 'Payment failed. Please try again.';
            }

            btnPayPremium.disabled = false;
            btnPayPremium.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                Deposit ₹100 Premium
            `;
        });
    }

    async function loadForecast(lat, lng, nearestLocation) {
        const container = document.getElementById('forecastContainer');
        if (!container) return;

        const forecastArr = await getWorkingConditionForecast(lat, lng, nearestLocation);
        const forecast = forecastArr?.forecast ? forecastArr.forecast : forecastArr;
        const newsHighlights = forecastArr?.newsHighlights ?? forecastArr?.news ?? [];
        if (!forecast) {
            renderForecastEmpty('Failed to load AI prediction data from meteorological systems. Try again later.');
            return;
        }

        const newsEl = document.getElementById('newsHighlights');
        if (newsEl) {
            if (Array.isArray(newsHighlights) && newsHighlights.length > 0) {
                newsEl.innerHTML = `<div style="font-weight:800; color:var(--text-dark); margin-bottom:6px;">Latest Disruptions (News)</div>` +
                    newsHighlights.map(h => `<div>• <a href="${h.url || '#'}" target="_blank" rel="noreferrer" style="color:var(--accent-primary); text-decoration:none;">${h.title}</a></div>`).join('');
            } else {
                newsEl.innerHTML = `<div style="font-weight:800; color:var(--text-dark); margin-bottom:6px;">Latest Disruptions (News)</div>` +
                    `<div style="color:var(--text-muted);">No recent headlines found (or news service unavailable).</div>`;
            }
        }

        container.innerHTML = forecast.map(day => {
            const bgMap = {
                'green': '#ecfdf5',
                'orange': '#fffbeb',
                'red': '#fef2f2'
            };
            const borderMap = {
                'green': '#10b981',
                'orange': '#f59e0b',
                'red': '#ef4444'
            };
            const textMap = {
                'green': '#065f46',
                'orange': '#92400e',
                'red': '#991b1b'
            };

            const dateObj = new Date(day.date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            return `
                <div style="flex: 0 0 170px; background: ${bgMap[day.riskLevel]}; border: 1px solid ${borderMap[day.riskLevel]}40; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.85rem; font-weight: 700; color: ${textMap[day.riskLevel]};">${dayName}</div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:10px; width:100%;">
                        <div style="font-size: 2.1rem; line-height:1;">${day.emoji}</div>
                        <div style="text-align:left;">
                            <div style="font-size:0.82rem; color:${textMap[day.riskLevel]}; font-weight:800;">
                                ${typeof day.workingConditionPercent === 'number' ? `${Math.round(day.workingConditionPercent)}% Working` : (day.aiStatus || 'AI pending')}
                            </div>
                            <div style="font-size:0.66rem; color:${textMap[day.riskLevel]}80; margin-top:3px;">
                                Weather: ${Math.round(day.maxTemp)}°C, ${Math.round(day.precip)}mm rain
                            </div>
                        </div>
                    </div>

                    <div style="width:100%; margin-top:2px;">
                        <div style="font-size:0.7rem; font-weight:800; color:${textMap[day.riskLevel]}; margin-bottom:6px;">
                            Contributing factors
                        </div>
                        <div style="display:flex; height:10px; border-radius:999px; overflow:hidden; border:1px solid var(--border); background:#fff;">
                            ${(() => {
                                const w = Number(day.weatherRiskPercent ?? 0);
                                const s = Number(day.strikeRiskPercent ?? 0);
                                const n = Number(day.newsRiskPercent ?? 0);
                                const total = Math.max(1, w + s + n);
                                const wp = (w / total) * 100;
                                const sp = (s / total) * 100;
                                const np = (n / total) * 100;
                                return `
                                    <div title="Weather risk" style="width:${wp}%; background:#f97316;"></div>
                                    <div title="Upcoming strikes" style="width:${sp}%; background:#ef4444;"></div>
                                    <div title="News / disruptions" style="width:${np}%; background:#3b82f6;"></div>
                                `;
                            })()}
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.62rem; color:var(--text-muted); margin-top:6px;">
                            <span>Weather</span>
                            <span>Strikes</span>
                            <span>News</span>
                        </div>
                    </div>

                    <div style="font-size: 0.78rem; font-weight: 800; color: white; background: ${borderMap[day.riskLevel]}; padding: 6px 8px; border-radius: 6px; text-align: center; width: 100%; line-height: 1.2;">
                        ${day.status}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderForecastEmpty(msg) {
        const container = document.getElementById('forecastContainer');
        if (!container) return;
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); width: 100%; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border);">
                ${msg}
            </div>
        `;
    }
});
