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
            const locationDisplay = document.querySelector('.profile-location-text');
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

                        // Fetch Current Weather from free Open-Meteo API
                        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${zone.lat}&longitude=${zone.lng}&current_weather=true`)
                            .then(res => res.json())
                            .then(weatherData => {
                                if(weatherData && weatherData.current_weather) {
                                    const t = Math.round(weatherData.current_weather.temperature);
                                    const code = weatherData.current_weather.weathercode;
                                    let icon = '🌤️';
                                    if(code >= 95) icon = '⚡';
                                    else if(code >= 61) icon = '🌧️';
                                    else if(code >= 51) icon = '🌦️';
                                    else if(code >= 3) icon = '☁️';
                                    else if(code === 0) icon = '☀️';

                                    const weatherChip = document.getElementById('heroWeatherChip');
                                    const weatherIcon = document.getElementById('heroWeatherIcon');
                                    const weatherText = document.getElementById('heroWeatherText');
                                    
                                    if(weatherChip && weatherIcon && weatherText) {
                                        weatherIcon.textContent = icon;
                                        weatherText.textContent = `${t}°C`;
                                        weatherChip.style.display = 'flex';
                                    }
                                }
                            }).catch(err => console.error("Current weather failed", err));

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
            // Financial stats loaded after premium info


            // Fetch Premium info
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                let premium = userData.premium ? userData.premium : null;
                let activePlan = userData.activePlan ? userData.activePlan : 'No Active Plan';
                let planStartDate = userData.planStartDate ? userData.planStartDate : null;

                // Pre-fill AI Recommender form if profile data exists
                if (userData.monthlyIncome) {
                    const aiIncome = document.getElementById('aiIncome');
                    if (aiIncome) aiIncome.value = userData.monthlyIncome;
                }
                if (userData.weeklyHours) {
                    const aiHours = document.getElementById('aiHours');
                    if (aiHours) aiHours.value = userData.weeklyHours;
                }
                if (userData.age) {
                    const aiAge = document.getElementById('aiAge');
                    if (aiAge) aiAge.value = userData.age;
                }

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
                    // if (plansSection) plansSection.style.display = 'none';

                    if (btnOverlayShowPlans) {
                        btnOverlayShowPlans.addEventListener('click', () => {
                            noPlanOverlay.style.display = 'none';
                            plansSection.style.display = '';

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
                    // if (plansSection) plansSection.style.display = 'none';
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

                    const activePlanDashboard = document.getElementById('activePlanDashboard');
                    const plansSection = document.getElementById('plansSection');
                    const activePlanNameDisplay = document.getElementById('activePlanNameDisplay');
                    const activePlanDepositAmount = document.getElementById('activePlanDepositAmount');

                    let weeklyPremium = 50;
                    if (activePlan === 'Mid Guard') weeklyPremium = 100;
                    else if (activePlan === 'Pro Armor') weeklyPremium = 200;
                    window.userPremiumAmount = weeklyPremium;

                    if (activePlan !== 'No Active Plan') {
                        if (plansSection) plansSection.style.display = 'none';
                        if (activePlanDashboard) activePlanDashboard.style.display = 'block';
                        if (activePlanNameDisplay) activePlanNameDisplay.textContent = activePlan;
                        if (activePlanDepositAmount) activePlanDepositAmount.textContent = weeklyPremium;

                        const cards = document.querySelectorAll('.plan-card');
                        cards.forEach(card => {
                            const planTitle = card.querySelector('h4');
                            if (planTitle && planTitle.textContent.trim().replace('ACTIVE', '') === activePlan) {
                                card.classList.add('active-plan');
                                card.style.border = '2px solid #ff8a2a';
                                if (!planTitle.innerHTML.includes('ACTIVE')) {
                                    const badge = document.createElement('span');
                                    badge.innerHTML = '<span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; margin-left: 8px; vertical-align: middle;">ACTIVE</span>';
                                    planTitle.appendChild(badge.firstChild);
                                }
                            }
                        });
                    } else {
                        if (plansSection) plansSection.style.display = 'flex';
                        if (activePlanDashboard) activePlanDashboard.style.display = 'none';
                    }

                    const btnRenewPlan = document.getElementById('btnRenewPlan');
                    if (btnRenewPlan) {
                        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                        const now = Date.now();
                        let canRenew = true;

                        if (planStartDate) {
                            const startMs = planStartDate.toMillis ? planStartDate.toMillis() : (planStartDate.seconds ? planStartDate.seconds * 1000 : 0);
                            if (startMs > 0 && (now - startMs) < thirtyDaysMs) {
                                canRenew = false;
                            }
                        }

                        if (!canRenew) {
                            btnRenewPlan.disabled = true;
                            btnRenewPlan.style.opacity = '0.5';
                            btnRenewPlan.textContent = 'Active Plan Locked (1 Month)';
                        } else {
                            btnRenewPlan.disabled = false;
                            btnRenewPlan.style.opacity = '1';
                            btnRenewPlan.textContent = 'Renew or Change Plan';
                            btnRenewPlan.addEventListener('click', () => {
                                if (heroCard) heroCard.style.display = 'none';
                                if (statsSection) statsSection.style.display = 'none';
                                if (forecastSection) forecastSection.style.display = 'none';
                                if (contentGrid) contentGrid.style.display = 'none';
                                if (aiRecommendation) aiRecommendation.style.display = 'none';
                                if (plansSection) plansSection.style.display = '';

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
                }

                // Load financial stats
                await loadFinancialStats(user.uid);

                // Setup Weekly Deposit Button from Active Plan Dashboard
                const btnMakeWeeklyDeposit = document.getElementById('btnMakeWeeklyDeposit');
                if (btnMakeWeeklyDeposit) {
                    btnMakeWeeklyDeposit.addEventListener('click', async () => {
                        btnMakeWeeklyDeposit.disabled = true;
                        btnMakeWeeklyDeposit.textContent = 'Processing...';
                        try {
                            await addDoc(collection(db, 'deposits'), {
                                user_id: user.uid,
                                amount: window.userPremiumAmount,
                                currency: 'INR',
                                timestamp: serverTimestamp()
                            });
                            alert(`Weekly deposit of ₹${window.userPremiumAmount} successful!`);
                        } catch (e) {
                            console.warn('Firebase deposit failed, mocking locally:', e);
                            // Mock deposit locally
                            let mockedDeposits = parseInt(localStorage.getItem('mocked_deposits_amount') || '0');
                            mockedDeposits += window.userPremiumAmount;
                            localStorage.setItem('mocked_deposits_amount', mockedDeposits);
                            localStorage.setItem('mocked_deposit_timestamp', Date.now());
                            alert(`Weekly deposit of ₹${window.userPremiumAmount} successful!`);
                        } finally {
                            await loadFinancialStats(user.uid);
                            btnMakeWeeklyDeposit.innerHTML = `Make Weekly Deposit - ₹<span id="activePlanDepositAmount">${window.userPremiumAmount}</span>`;
                            btnMakeWeeklyDeposit.disabled = false;
                        }
                    });
                }

                // Setup Change Plan Button
                const btnChangePlan = document.getElementById('btnChangePlan');
                if (btnChangePlan) {
                    btnChangePlan.addEventListener('click', () => {
                        const activePlanDashboard = document.getElementById('activePlanDashboard');
                        const plansSection = document.getElementById('plansSection');
                        if (activePlanDashboard) activePlanDashboard.style.display = 'none';
                        if (plansSection) plansSection.style.display = 'flex';
                        
                        // Update buttons to show Renew/Switch
                        const planCards = document.querySelectorAll('.plan-card');
                        planCards.forEach(card => {
                            const cardTitle = card.querySelector('h4').textContent.replace('ACTIVE', '').trim();
                            if (cardTitle === activePlan) {
                                card.style.borderColor = '#10b981';
                            }
                        });
                    });
                }

                // AI Recommender Form Logic
                const btnGetAiRec = document.getElementById('btnGetAiRec');
                if (btnGetAiRec) {
                    btnGetAiRec.addEventListener('click', async () => {
                        const income = parseInt(document.getElementById('aiIncome').value) || 0;
                        const hours = parseInt(document.getElementById('aiHours').value) || 0;
                        const age = parseInt(document.getElementById('aiAge').value) || 0;
                        
                        if (income === 0 || hours === 0 || age === 0) {
                            alert("Please fill out all details for a personalized recommendation.");
                            return;
                        }

                        btnGetAiRec.textContent = 'Analyzing...';
                        btnGetAiRec.disabled = true;

                        // Save to profile
                        try {
                            const userRef = doc(db, 'users', user.uid);
                            await setDoc(userRef, {
                                age: age,
                                weeklyHours: hours,
                                monthlyIncome: income
                            }, { merge: true });
                        } catch(err) {
                            console.error("Failed to save profile from AI recommender", err);
                        }

                        // Simulate AI heuristic calculation
                        setTimeout(() => {
                            let recommendedPlan = 'Basic Shield';
                            let reason = `Based on your moderate income and hours, Basic Shield minimizes costs while providing essential coverage.`;
                            let price = 49;
                            let rawPlanId = 'basic';

                            if (income >= 50000 || (hours > 50 && income > 30000)) {
                                recommendedPlan = 'Pro Armor';
                                reason = `Your high income and extensive working hours (${hours}h/wk) indicate maximum exposure. Pro Armor offers comprehensive protection without limits.`;
                                price = 149;
                                rawPlanId = 'pro';
                            } else if (income >= 25000) {
                                recommendedPlan = 'Mid Guard';
                                reason = `For a balanced profile (₹${income}/mo, ${hours}h/wk), Mid Guard provides the best risk-to-value ratio, covering most standard incidents.`;
                                price = 89;
                                rawPlanId = 'mid';
                            }

                            document.getElementById('aiRecText').textContent = reason;
                            
                            const btnAiPurchase = document.getElementById('btnAiPurchase');
                            btnAiPurchase.textContent = `Purchase ${recommendedPlan} - ₹${price}/mo`;
                            
                            document.getElementById('aiRecResult').style.display = 'block';
                            btnGetAiRec.textContent = 'Get Recommendation';
                            btnGetAiRec.disabled = false;

                            btnAiPurchase.onclick = () => {
                                // Simulate selecting the plan card and clicking Pay Now
                                const cards = document.querySelectorAll('.plan-card');
                                cards.forEach(c => {
                                    if (c.dataset.plan === rawPlanId) {
                                        window.scrollTo({ top: c.offsetTop - 100, behavior: 'smooth' });
                                        c.click(); // Expand accordion
                                    }
                                });
                            };
                        }, 1000);
                    });
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

    // 3. Shift Tracker Logic
    const btnToggleShift = document.getElementById('btnToggleShift');
    const shiftStatusText = document.getElementById('shiftStatusText');
    const shiftStatusDot = document.getElementById('shiftStatusDot');

    if (btnToggleShift && shiftStatusText) {
        let shiftStartMs = localStorage.getItem('active_shift_start');

        if (shiftStartMs) {
            shiftStatusText.textContent = "On Duty";
            shiftStatusText.style.color = "";
            if (shiftStatusDot) shiftStatusDot.classList.add('on-duty');
            btnToggleShift.innerHTML = `End Shift <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
            btnToggleShift.style.background = "#ef4444";
            btnToggleShift.style.boxShadow = "0 4px 14px rgba(239, 68, 68, 0.35)";
        }

        btnToggleShift.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                alert("You must be signed in to log a shift!");
                return;
            }

            if (shiftStartMs) {
                // End shift
                btnToggleShift.disabled = true;
                btnToggleShift.textContent = "Ending...";

                const durationMs = Date.now() - parseInt(shiftStartMs);
                const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);

                try {
                    await addDoc(collection(db, 'shifts'), {
                        user_id: user.uid,
                        duration_hours: Number(durationHours),
                        timestamp: serverTimestamp()
                    });

                    localStorage.removeItem('active_shift_start');
                    shiftStartMs = null;

                    shiftStatusText.textContent = "Off Duty";
                    shiftStatusText.style.color = "";
                    if (shiftStatusDot) shiftStatusDot.classList.remove('on-duty');
                    btnToggleShift.innerHTML = `Start Shift <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
                    btnToggleShift.style.background = "#10b981";
                    btnToggleShift.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.35)";

                    alert(`Shift ended successfully! You worked for ${durationHours} hours.`);
                } catch (e) {
                    console.error('Failed to log shift:', e);
                    alert('Failed to log shift. Please try again.');
                    btnToggleShift.innerHTML = `End Shift <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
                } finally {
                    btnToggleShift.disabled = false;
                }
            } else {
                // Start shift
                const conf = confirm("Start your driver shift now?");
                if (!conf) return;

                shiftStartMs = Date.now().toString();
                localStorage.setItem('active_shift_start', shiftStartMs);

                shiftStatusText.textContent = "On Duty";
                shiftStatusText.style.color = "";
                if (shiftStatusDot) shiftStatusDot.classList.add('on-duty');
                btnToggleShift.innerHTML = `End Shift <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
                btnToggleShift.style.background = "#ef4444";
                btnToggleShift.style.boxShadow = "0 4px 14px rgba(239, 68, 68, 0.35)";
            }
        });
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
            let lastDepositTime = 0;

            snapDep.forEach(d => {
                totalDep += d.data().amount || 0;
                const ts = d.data().timestamp;
                if (ts) {
                    const timeMs = ts.toMillis ? ts.toMillis() : (ts.seconds ? ts.seconds * 1000 : 0);
                    if (timeMs > lastDepositTime) lastDepositTime = timeMs;
                }
            });

            // Include mocked local deposits
            let mockedDeposits = parseInt(localStorage.getItem('mocked_deposits_amount') || '0');
            let mockedTime = parseInt(localStorage.getItem('mocked_deposit_timestamp') || '0');
            if (mockedDeposits > 0) {
                totalDep += mockedDeposits;
                if (mockedTime > lastDepositTime) lastDepositTime = mockedTime;
            }

            // Get sum of payouts (payments)
            const qPay = query(collection(db, 'payments'), where('user_id', '==', uid));
            const snapPay = await getDocs(qPay);
            let totalPay = 0;
            snapPay.forEach(d => totalPay += d.data().amount || 0);

            if (userTotalDeposits) userTotalDeposits.textContent = `₹${totalDep}`;
            if (userTotalPayouts) userTotalPayouts.textContent = `₹${totalPay}`;

            const activePlanTotalDeposits = document.getElementById('activePlanTotalDeposits');
            if (activePlanTotalDeposits) {
                activePlanTotalDeposits.textContent = `₹${totalDep}`;
            }

            // Check if deposited in the last 7 days (7 * 24 * 60 * 60 * 1000 ms)
            const btnMakeWeeklyDeposit = document.getElementById('btnMakeWeeklyDeposit');
            const now = Date.now();
            const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
            
            if (btnMakeWeeklyDeposit) {
                if (lastDepositTime > 0 && (now - lastDepositTime) < oneWeekMs) {
                    btnMakeWeeklyDeposit.disabled = true;
                    btnMakeWeeklyDeposit.style.opacity = '0.5';
                    btnMakeWeeklyDeposit.textContent = 'Weekly Deposit Complete';
                } else {
                    btnMakeWeeklyDeposit.disabled = false;
                    btnMakeWeeklyDeposit.style.opacity = '1';
                    btnMakeWeeklyDeposit.innerHTML = `Make Weekly Deposit - ₹<span id="activePlanDepositAmount">${window.userPremiumAmount}</span>`;
                }
            }

            const btnPayPremium = document.getElementById('btnPayPremium');
            const msgEl = document.getElementById('premiumMessage');
            if (btnPayPremium) {
                const now = Date.now();
                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
                if (lastDepositTime > 0 && (now - lastDepositTime) < oneWeekMs) {
                    btnPayPremium.disabled = true;
                    btnPayPremium.style.opacity = '0.5';
                    btnPayPremium.innerHTML = '<span style="font-weight: 600;">Premium Paid for this Week</span>';
                    if (msgEl) {
                        msgEl.style.color = '#f59e0b';
                        msgEl.textContent = 'You have already deposited this week. You will be able to deposit again next week.';
                    }
                } else {
                    btnPayPremium.disabled = false;
                    btnPayPremium.style.opacity = '1';
                    const paymentAmount = window.userPremiumAmount || 100;
                    btnPayPremium.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                            <line x1="2" y1="10" x2="22" y2="10"></line>
                        </svg>
                        Deposit ₹${paymentAmount} Premium
                    `;
                    if (msgEl && msgEl.textContent === 'You have already deposited this week. You will be able to deposit again next week.') {
                        msgEl.textContent = '';
                    }
                }
            }

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
                    currency: 'USD',
                    timestamp: serverTimestamp()
                });

                // loadFinancialStats will handle button state and message color.
                msgEl.style.color = '#10b981';
                msgEl.textContent = `Payment of ₹${paymentAmount} successful!`;
                await loadFinancialStats(user.uid);
            } catch (e) {
                console.error("Payment failed", e);
                msgEl.style.color = '#ef4444';
                msgEl.textContent = 'Payment failed. Please try again.';
                btnPayPremium.disabled = false;
                btnPayPremium.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                        <line x1="2" y1="10" x2="22" y2="10"></line>
                    </svg>
                    Deposit ₹${paymentAmount} Premium
                `;
            }
        });
    }

    const payNowBtn = document.getElementById('payNowBtn');
    if (payNowBtn) {
        payNowBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                alert("Please sign in to continue.");
                return;
            }

            const activeCard = document.querySelector('.plan-card.active-plan');
            if (!activeCard) {
                alert("Please select a plan first.");
                return;
            }

            const planName = activeCard.querySelector('h4').textContent;
            const price = Number(activeCard.dataset.price);

            payNowBtn.disabled = true;
            payNowBtn.textContent = 'Processing...';

            try {
                // Set user's premium and activePlan
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, { 
                    premium: price, 
                    activePlan: planName,
                    planStartDate: serverTimestamp() 
                }, { merge: true });

                try {
                    // Add deposit record
                    await addDoc(collection(db, 'deposits'), {
                        user_id: user.uid,
                        amount: price,
                        currency: 'USD',
                        timestamp: serverTimestamp()
                    });
                } catch(depositErr) {
                    console.warn("Deposit record failed (maybe currency/rules), but plan is active", depositErr);
                }

                alert(`Successfully subscribed to ${planName}!`);
                
                // Reload the page to reset the dashboard state completely
                window.location.reload();

            } catch (e) {
                console.error("Plan purchase failed", e);
                alert("Failed to process payment. Please try again.");
                payNowBtn.disabled = false;
                payNowBtn.textContent = `Pay Now - ₹${price}`;
            }
        });
    }


    async function loadForecast(lat, lng, nearestLocation) {
        const container = document.getElementById('forecastContainer');

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

        // Update AI Recommendation Context
        const aiRecMsg = document.querySelector('#aiRecommendation .ai-recommendation-content p');
        if (aiRecMsg && forecast.length > 0) {
            let highRiskDays = forecast.filter(d => d.riskLevel === 'red' || d.riskLevel === 'orange');
            if (highRiskDays.length > 0) {
                let riskTypes = [];
                let hasWeather = highRiskDays.some(d => (d.weatherRiskPercent || 0) > 25);
                let hasStrike = highRiskDays.some(d => (d.strikeRiskPercent || 0) > 25);
                let hasNews = highRiskDays.some(d => (d.newsRiskPercent || 0) > 25);

                if (hasStrike) riskTypes.push("civil strikes");
                if (hasWeather) riskTypes.push("severe weather");
                if (hasNews) riskTypes.push("local news disruptions");

                let riskStr = riskTypes.length > 0 ? riskTypes.join(" and ") : "unpredictable anomalies";
                aiRecMsg.textContent = `Alert: Increased risk of ${riskStr} detected for your area this week. Please stay vigilant or ensure your plan is active for maximum protection.`;
            } else {
                aiRecMsg.textContent = "Your location forecast looks clear this week! Both weather and local news metrics show predominantly safe working conditions.";
            }
        }

        if (container) {
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
    }

    function renderForecastEmpty(msg) {
        const container = document.getElementById('forecastContainer');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); width: 100%; background: #f8fafc; border-radius: 12px; border: 1px solid var(--border);">
                    ${msg}
                </div>
            `;
        }
    }

});