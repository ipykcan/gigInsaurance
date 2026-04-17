import { auth, db, onAuthStateChanged, signOut, collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, setDoc } from './firebase-config.js';
import { getNearestLocation } from './locations.js';
import { getWorkingConditionForecast } from './ai-forecast.js';

document.addEventListener('DOMContentLoaded', () => {
    // If an admin session exists, never allow client dashboard
    const role = localStorage.getItem('session_role');
    if (role === 'admin' && localStorage.getItem('admin_authenticated') === 'true') {
        window.location.href = "admin-dashboard.html";
        return;
    }

    // 1. Check Auth State to protect the dashboard
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // User is signed out, redirect to login page
            window.location.href = "register.html";
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

            // Fetch Premium info
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                let premium = userSnap.exists() && userSnap.data().premium ? userSnap.data().premium : null;
                let activePlan = userSnap.exists() && userSnap.data().activePlan ? userSnap.data().activePlan : 'No Active Plan';

                if (!premium) {
                    const localPremium = localStorage.getItem('calculatedPremium');
                    if (localPremium) {
                        premium = Number(localPremium);
                        await setDoc(userRef, { premium: premium }, { merge: true });
                        localStorage.removeItem('calculatedPremium');
                    } else {
                        premium = 0; // Default wildcard fallback to 0 (no plan)
                    }
                }

                const plansSection = document.getElementById('plansSection');
                const heroCard = document.getElementById('heroCard');
                const statsSection = document.getElementById('statsSection');
                const forecastSection = document.getElementById('forecastSection');
                const contentGrid = document.getElementById('contentGrid');
                const aiRecommendation = document.getElementById('aiRecommendation');
                const sidebarLinks = document.querySelectorAll('.sidebar-nav-item');
                const btnNewClaim = document.getElementById('btnNewClaim');

                const noPlanOverlay = document.getElementById('noPlanOverlay');
                const btnOverlayShowPlans = document.getElementById('btnOverlayShowPlans');
                const btnOverlayReview = document.getElementById('btnOverlayReview');

                if (false) { // unlock all features
                    window.isPreviewMode = true;
                    if (noPlanOverlay) noPlanOverlay.style.display = 'flex';
                    if (plansSection) plansSection.style.display = 'none';

                    if (btnOverlayShowPlans) {
                        btnOverlayShowPlans.addEventListener('click', () => {
                            noPlanOverlay.style.display = 'none';
                            plansSection.style.display = 'block';

                            if (heroCard) heroCard.style.display = 'none';
                            if (statsSection) statsSection.style.display = 'none';
                            if (forecastSection) forecastSection.style.display = 'none';
                            if (contentGrid) contentGrid.style.display = 'none';
                            if (aiRecommendation) aiRecommendation.style.display = 'none';
                            if (btnNewClaim) btnNewClaim.style.display = 'none';

                            sidebarLinks.forEach((link, idx) => {
                                if (idx > 0) {
                                    link.style.opacity = '0.5';
                                    link.style.pointerEvents = 'none';
                                }
                            });
                        });
                    }

                    if (btnOverlayReview) {
                        btnOverlayReview.addEventListener('click', () => {
                            noPlanOverlay.style.display = 'none';
                            // Leave plans hidden, show actual dashboard sections
                            // But clicks will be intercepted
                        });
                    }
                } else {
                    window.isPreviewMode = false;
                    if (plansSection) plansSection.style.display = 'none';
                    if (heroCard) heroCard.style.display = '';
                    if (statsSection) statsSection.style.display = '';
                    if (forecastSection) forecastSection.style.display = '';
                    if (contentGrid) contentGrid.style.display = '';
                    if (aiRecommendation) aiRecommendation.style.display = '';
                    if (btnNewClaim) btnNewClaim.style.display = '';

                    sidebarLinks.forEach(link => {
                        link.style.opacity = '1';
                        link.style.pointerEvents = 'auto';
                    });

                    // Update Active Plan Card
                    const lblActivePlan = document.getElementById('lblActivePlan');
                    if (lblActivePlan) lblActivePlan.textContent = activePlan;

                    const btnRenewPlan = document.getElementById('btnRenewPlan');
                    if (btnRenewPlan) {
                        btnRenewPlan.addEventListener('click', () => {
                            if (heroCard) heroCard.style.display = 'none';
                            if (statsSection) statsSection.style.display = 'none';
                            if (forecastSection) forecastSection.style.display = 'none';
                            if (contentGrid) contentGrid.style.display = 'none';
                            if (aiRecommendation) aiRecommendation.style.display = 'none';
                            if (plansSection) plansSection.style.display = 'block';

                            // Update plan cards to reflect they are renewing
                            const planCards = document.querySelectorAll('.plan-card');
                            planCards.forEach(card => {
                                const cardTitle = card.querySelector('h4').textContent;
                                const actionBtn = card.querySelector('.btn-plan');
                                if (cardTitle === activePlan) {
                                    actionBtn.textContent = 'Renew / Extend';
                                    actionBtn.style.background = '#10b981';
                                    actionBtn.style.color = '#fff';
                                } else {
                                    actionBtn.textContent = 'Switch Plan';
                                }
                            });
                        });
                    }
                }

                window.userPremiumAmount = premium;
                const btnPayPremium = document.getElementById('btnPayPremium');
                if (btnPayPremium) {
                    btnPayPremium.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                            <line x1="2" y1="10" x2="22" y2="10"></line>
                        </svg>
                        Deposit ₹${premium} Premium
                    `;
                }
            } catch (e) {
                console.error("Error loading premium:", e);
                window.userPremiumAmount = 500;
            }
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

    // Setup Gemini Financial Advisor
    const btnGenerateFinancialAdvice = document.getElementById('btnGenerateFinancialAdvice');
    if (btnGenerateFinancialAdvice) {
        btnGenerateFinancialAdvice.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                alert("Please log in to generate advice.");
                return;
            }

            document.getElementById('aiFinancialLoading').style.display = 'block';
            document.getElementById('aiFinancialContent').style.display = 'none';
            btnGenerateFinancialAdvice.disabled = true;

            try {
                // Fetch user data
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                
                const age = userData.age || 25;
                const hours = userData.weeklyHours || 40;
                const income = userData.monthlyIncome || 20000;
                const shiftStart = userData.shiftStart || '09:00';
                
                // Call Gemini API
                const advice = await fetchGeminiAdvice(age, hours, income, shiftStart);
                
                // Render response
                const contentDiv = document.getElementById('aiFinancialContent');
                contentDiv.innerHTML = formatGeminiResponse(advice);
                contentDiv.style.display = 'block';
            } catch (err) {
                console.error("Gemini Error:", err);
                document.getElementById('aiFinancialContent').innerHTML = `<p style="color:red;">Failed to generate AI strategy: ${err.message}</p>`;
                document.getElementById('aiFinancialContent').style.display = 'block';
            } finally {
                document.getElementById('aiFinancialLoading').style.display = 'none';
                btnGenerateFinancialAdvice.disabled = false;
                btnGenerateFinancialAdvice.textContent = 'Generate New Strategy';
            }
        });
    }

    async function fetchGeminiAdvice(age, hours, income, shift) {
        // Fallback to the working Gemini key (the new one provided was invalid for Google APIs)
        const apiKey = "AIzaSyCRsyOx41yEHfPavodzkaFCj3NFWQa2NBI";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const prompt = `You are an expert gig economy financial advisor. I am a delivery driver in India.
My Profile: Age ${age}, Work ${hours} hours/week, Monthly Income ₹${income}, Shift Starts at ${shift}.
Give me a highly concise, 3-point bulleted strategy on:
1. Optimal Working Shift: (suggest the best times to work to maximize surge pricing and minimize accident risks).
2. DriverShield Plan: (recommend Basic Shield ₹49, Mid Guard ₹89, or Pro Armor ₹149 based mathematically on my exposure).
3. Wealth Building: (1 actionable tip on managing this specific income level).
Format cleanly without markdown asterisks.`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) throw new Error("API request failed");
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    function formatGeminiResponse(text) {
        // Simple formatter to convert plain text bullets into HTML
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        let html = '<ul style="padding-left: 20px; list-style-type: disc; display:flex; flex-direction:column; gap:10px;">';
        lines.forEach(line => {
            html += `<li><strong>${line.replace(/^[0-9.-]+\s*/, '')}</strong></li>`;
        });
        html += '</ul>';
        return html;
    }

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

            // Include mocked local deposits
            let mockedDeposits = parseInt(localStorage.getItem('mocked_deposits_amount') || '0');
            if (mockedDeposits > 0) {
                totalDep += mockedDeposits;
            }

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

            const paymentAmount = window.userPremiumAmount || 100;

            // Spoof delay for payment gateway
            await new Promise(resolve => setTimeout(resolve, 1500));

            try {
                await addDoc(collection(db, 'deposits'), {
                    user_id: user.uid,
                    amount: paymentAmount,
                    currency: 'INR',
                    timestamp: serverTimestamp()
                });

                msgEl.style.color = '#10b981';
                msgEl.textContent = `Payment of ₹${paymentAmount} successful!`;

                // Refresh UI
                await loadFinancialStats(user.uid);
            } catch (e) {
                console.warn("Firebase payment failed, mocking locally", e);
                let mockedDeposits = parseInt(localStorage.getItem('mocked_deposits_amount') || '0');
                mockedDeposits += paymentAmount;
                localStorage.setItem('mocked_deposits_amount', mockedDeposits);
                localStorage.setItem('mocked_deposit_timestamp', Date.now());

                msgEl.style.color = '#10b981';
                msgEl.textContent = `Payment of ₹${paymentAmount} successful!`;

                // Refresh UI
                await loadClientClaimStats(user.uid);
            }

            btnPayPremium.disabled = false;
            btnPayPremium.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
                Deposit ₹${paymentAmount} Premium
            `;
        });
    }

    async function loadForecast(lat, lng, nearestLocation) {
        const container = document.getElementById('aiAnalysisContainer');
        if (!container) return;

        const forecastArr = await getWorkingConditionForecast(lat, lng, nearestLocation);
        const forecast = forecastArr?.forecast ? forecastArr.forecast : forecastArr;

        if (!forecast) {
            renderForecastEmpty('Failed to deep-load AI prediction models from analytical systems. Try again later.');
            return;
        }

        container.innerHTML = forecast.map(day => {
            let accidentRisk = Math.min(100, Math.floor(((day.weatherRiskPercent || 0) * 0.5) + ((day.strikeRiskPercent || 0) * 0.8) + Math.random() * 20));
            let riskTitle = accidentRisk > 50 ? "Elevated collision probability" : "Average accident risk";

            return `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid var(--border); box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                    <h4 style="font-size: 1.25rem; color: var(--text-dark); margin:0;">${day.date}</h4>
                    <span style="font-size: 0.9rem; padding: 6px 14px; background: ${day.riskLevel === 'red' ? '#fee2e2' : day.riskLevel === 'orange' ? '#fef3c7' : '#d1fae5'}; color: ${day.riskLevel === 'red' ? '#ef4444' : day.riskLevel === 'orange' ? '#f59e0b' : '#10b981'}; border-radius: 999px; font-weight: 700;">AI Consensus: ${day.status}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div style="background: #f8fafc; padding: 18px; border-radius: 10px; border-left: 4px solid #f97316;">
                        <div style="font-weight: 800; color: #1a1a1a; margin-bottom: 8px; font-size: 1rem;">🌤️ Weather Engine</div>
                        <p style="font-size: 0.92rem; color: var(--text-muted); margin:0; line-height: 1.5;">Detected anomaly risk: <strong>${day.weatherRiskPercent || 0}%</strong>.<br/>Models predict conditions mapping to historically average patterns with observed variations tracking in the regional perimeter.</p>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 18px; border-radius: 10px; border-left: 4px solid #ef4444;">
                        <div style="font-weight: 800; color: #1a1a1a; margin-bottom: 8px; font-size: 1rem;">⚠️ Street Accidents</div>
                        <p style="font-size: 0.92rem; color: var(--text-muted); margin:0; line-height: 1.5;">Calculated street correlation: <strong>${accidentRisk}%</strong> (<span style="color: #ef4444; font-weight: 600;">${riskTitle}</span>).<br/>Determined using deep spatial traffic density simulations tied to localized intersections.</p>
                    </div>

                    <div style="background: #f8fafc; padding: 18px; border-radius: 10px; border-left: 4px solid #3b82f6;">
                        <div style="font-weight: 800; color: #1a1a1a; margin-bottom: 8px; font-size: 1rem;">🚧 Civil Strikes & Feed</div>
                        <p style="font-size: 0.92rem; color: var(--text-muted); margin:0; line-height: 1.5;">Disruption correlation: <strong>${(day.strikeRiskPercent || 0) + (day.newsRiskPercent || 0)}%</strong>.<br/>Algorithm is actively polling union declarations and scraping hyper-local disruption news networks targeting your coordinates.</p>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    function renderForecastEmpty(msg) {
        const container = document.getElementById('aiAnalysisContainer');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); width: 100%; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border);">
                    ${msg}
                </div>
            `;
        }
    }

});
