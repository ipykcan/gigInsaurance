import { auth, db, onAuthStateChanged, doc, updateDoc, setDoc, serverTimestamp, collection, addDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const planName = params.get('plan') || 'Standard Plan';
    const upfrontCost = parseInt(params.get('upfront')) || 200;
    const weeklyPremium = parseInt(params.get('weekly')) || 50;

    const pagePlanTitle = document.getElementById('pagePlanTitle');
    const pagePlanPrice = document.getElementById('pagePlanPrice');
    const featuresList = document.getElementById('featuresList');
    const btnConfirmPay = document.getElementById('btnConfirmPay');
    const paymentAlert = document.getElementById('paymentAlert');
    const weeklyPremiumDisplay = document.getElementById('weeklyPremiumDisplay');

    // Update UI
    pagePlanTitle.textContent = planName;
    pagePlanPrice.innerHTML = `₹${upfrontCost}<span> / first month</span>`;
    if (weeklyPremiumDisplay) {
        weeklyPremiumDisplay.innerHTML = `₹${weeklyPremium} / week`;
    }

    // Mock features based on price
    let featuresArray = [];
    if (upfrontCost <= 200) {
        featuresArray = ['Basic Coverage', 'Email Support', 'Monthly Reports'];
    } else if (upfrontCost <= 500) {
        featuresArray = ['Full Coverage', '24/7 Priority Support', 'Weekly AI Insights'];
    } else {
        featuresArray = ['Premium Coverage', 'Custom Strategy', 'Dedicated Account Manager'];
    }

    featuresList.innerHTML = featuresArray.map(f => `
        <li>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ${f}
        </li>
    `).join('');

    // Payment Logic
    btnConfirmPay.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            showAlert('You must be logged in to make a payment.', 'error');
            return;
        }

        btnConfirmPay.disabled = true;
        btnConfirmPay.textContent = "Processing...";

        // Simulate network delay
        await new Promise(r => setTimeout(r, 1500));

        try {
            // Update User Profile with new premium (weekly rate to bind with dashboard)
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { premium: weeklyPremium, activePlan: planName, monthsActive: 1, planStartDate: serverTimestamp() }, { merge: true });


            showAlert(`Payment successful! You are enrolled. Redirecting to dashboard...`, 'success');

            // Redirect back
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2500);

        } catch (error) {
            console.error(error);
            showAlert('Payment failed due to a server error. Please try again.', 'error');
            btnConfirmPay.disabled = false;
            btnConfirmPay.textContent = "Pay Premium";
        }
    });

    function showAlert(msg, type) {
        paymentAlert.textContent = msg;
        paymentAlert.style.display = 'block';
        paymentAlert.className = 'alert-msg'; // reset
        paymentAlert.classList.add(type === 'success' ? 'alert-success' : 'alert-error');
    }

    // Auth check
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'register.html';
        }
    });
});
