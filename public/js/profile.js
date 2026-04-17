import {
    auth,
    db,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from './firebase-config.js';

function requireSession() {
    const role = localStorage.getItem('session_role');
    if (role !== 'client') {
        window.location.href = "index.html"; // Route back to new registration/login front door
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireSession()) return;

    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
        btnSignOut.addEventListener('click', async () => {
            try {
                await signOut(auth);
                localStorage.removeItem('session_role');
                window.location.href = "index.html";
            } catch (error) {
                console.error("Sign out error", error);
            }
        });
    }

    const profileForm = document.getElementById('profileForm');
    const profName = document.getElementById('profName');
    const profService = document.getElementById('profService');
    const profIncome = document.getElementById('profIncome');
    const profShiftStart = document.getElementById('profShiftStart');
    const profShiftEnd = document.getElementById('profShiftEnd');
    const profAge = document.getElementById('profAge');
    const profHours = document.getElementById('profHours');
    const profMonthlyIncome = document.getElementById('profMonthlyIncome');
    const btnSaveProfile = document.getElementById('btnSaveProfile');

    let currentUserRecord = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                currentUserRecord = userSnap.data();

                // Populate existing profile configs
                if (currentUserRecord.fullName) profName.value = currentUserRecord.fullName;
                if (currentUserRecord.service) profService.value = currentUserRecord.service;
                if (currentUserRecord.dailyIncome) profIncome.value = currentUserRecord.dailyIncome;
                if (currentUserRecord.shiftStart) profShiftStart.value = currentUserRecord.shiftStart;
                if (currentUserRecord.shiftEnd) profShiftEnd.value = currentUserRecord.shiftEnd;
                if (currentUserRecord.age) {
                    if(profAge) profAge.value = currentUserRecord.age;
                }
                if (currentUserRecord.weeklyHours) {
                    if(profHours) profHours.value = currentUserRecord.weeklyHours;
                }
                if (currentUserRecord.monthlyIncome) {
                    if(profMonthlyIncome) profMonthlyIncome.value = currentUserRecord.monthlyIncome;
                }

                // Active Plan Logic
                let activePlan = currentUserRecord.activePlan ? currentUserRecord.activePlan : 'No Active Plan';
                let planStartDate = currentUserRecord.planStartDate ? currentUserRecord.planStartDate : null;
                const lblActivePlan = document.getElementById('lblActivePlan');
                if (lblActivePlan) lblActivePlan.textContent = activePlan;

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
                            window.location.href = 'dashboard.html';
                        });
                    }
                }
            }

            // Financial Stats Logic
            await loadFinancialStats(user.uid);

        } catch (e) {
            console.error('Error fetching profile constraints', e);
        }
    });

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;

            btnSaveProfile.disabled = true;
            btnSaveProfile.textContent = "Saving...";

            try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    fullName: profName.value,
                    service: profService.value,
                    dailyIncome: Number(profIncome.value),
                    shiftStart: profShiftStart.value,
                    shiftEnd: profShiftEnd.value,
                    age: profAge && profAge.value ? Number(profAge.value) : null,
                    weeklyHours: profHours && profHours.value ? Number(profHours.value) : null,
                    monthlyIncome: profMonthlyIncome && profMonthlyIncome.value ? Number(profMonthlyIncome.value) : null
                });

                btnSaveProfile.style.background = "#10b981";
                btnSaveProfile.textContent = "Saved Successfully!";

                setTimeout(() => {
                    btnSaveProfile.style.background = "#ff8a2a";
                    btnSaveProfile.textContent = "Save Profile Settings";
                    btnSaveProfile.disabled = false;
                }, 2500);

            } catch (err) {
                console.error('Error updating profile:', err);
                alert('Failed to save profile. ' + err.message);
                btnSaveProfile.textContent = "Save Profile Settings";
                btnSaveProfile.disabled = false;
            }

        });
    }

    async function loadFinancialStats(uid) {
        const userTotalDeposits = document.getElementById('userTotalDeposits');
        const userTotalPayouts = document.getElementById('userTotalPayouts');

        try {
            // Get sum of deposits
            const qDep = query(collection(db, 'deposits'), where('user_id', '==', uid));
            const snapDep = await getDocs(qDep);
            let totalDep = 0;

            snapDep.forEach(d => {
                totalDep += d.data().amount || 0;
            });

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
});