import { auth, db, onAuthStateChanged, doc, setDoc, createUserWithEmailAndPassword, getDoc, serverTimestamp } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const insuranceForm = document.getElementById('insuranceForm');

    let currentUser = null;
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
    });

    if (insuranceForm) {
        insuranceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                const btnText = submitBtn.querySelector('.button-text');
                const btnLoader = submitBtn.querySelector('.button-loader');
                if (btnText && btnLoader) {
                    btnText.style.display = 'none';
                    btnLoader.style.display = 'flex';
                }
                submitBtn.disabled = true;
            }

            const dailyIncomeInput = document.getElementById('dailyIncome');
            let dailyIncome = 0;
            if (dailyIncomeInput && dailyIncomeInput.value) {
                dailyIncome = Number(dailyIncomeInput.value);
            }

            const emailInput = document.getElementById('email');
            const pwdInput = document.getElementById('password');
            const email = emailInput ? emailInput.value.trim() : '';
            const pwd = pwdInput ? pwdInput.value : '';

            // Calculate Premium based on daily income
            let premium = 0;
            if (dailyIncome < 500) {
                premium = 1200;
            } else if (dailyIncome >= 500 && dailyIncome <= 1500) {
                premium = 800;
            } else {
                premium = 400;
            }

            // Store premium locally so we can use it if they register right after
            localStorage.setItem('calculatedPremium', premium);

            // Process Auth / Redirect
            try {
                if (!currentUser) {
                    // Try to register the user
                    if (!email || !pwd) {
                        throw new Error("Email and password are required.");
                    }
                    const credential = await createUserWithEmailAndPassword(auth, email, pwd);
                    const user = credential.user;

                    const userRef = doc(db, 'users', user.uid);
                    await setDoc(userRef, {
                        uid: user.uid,
                        email: user.email,
                        createdAt: serverTimestamp(),
                        lastLoginAt: serverTimestamp(),
                        isNewUser: true,
                        premium: premium
                    }, { merge: true });

                    localStorage.setItem('session_role', 'client');
                    alert(`Registration successful!\n\nYour estimated premium is ₹${premium}/month.\nProceeding to Dashboard.`);
                    window.location.href = 'dashboard.html';
                } else {
                    // Already logged in
                    const userRef = doc(db, 'users', currentUser.uid);
                    await setDoc(userRef, { premium: premium }, { merge: true });
                    alert(`Your estimated premium is ₹${premium}/month.\n\nProceeding to Dashboard.`);
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    alert("Account already exists with this email! Please sign in.");
                    window.location.href = 'register.html';
                } else {
                    console.error('Registration error:', error);
                    alert(error.message || 'Something went wrong. Please try again.');
                }

                // reset button
                if (submitBtn) {
                    const btnText = submitBtn.querySelector('.button-text');
                    const btnLoader = submitBtn.querySelector('.button-loader');
                    if (btnText && btnLoader) {
                        btnText.style.display = 'inline';
                        btnLoader.style.display = 'none';
                    }
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // Add a Login / Register link to the top header
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        const loginContainer = document.createElement('div');
        loginContainer.style.position = 'absolute';
        loginContainer.style.top = '20px';
        loginContainer.style.right = '30px';
        loginContainer.style.zIndex = '100';

        const loginLink = document.createElement('a');
        loginLink.href = 'register.html';
        loginLink.textContent = 'Login / Register';
        loginLink.style.color = '#fff';
        loginLink.style.backgroundColor = 'var(--accent-primary, #F97316)';
        loginLink.style.padding = '10px 20px';
        loginLink.style.borderRadius = '8px';
        loginLink.style.textDecoration = 'none';
        loginLink.style.fontWeight = '600';
        loginLink.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        loginLink.style.transition = 'all 0.3s ease';

        loginLink.onmouseover = () => {
            loginLink.style.transform = 'translateY(-2px)';
            loginLink.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
        };
        loginLink.onmouseout = () => {
            loginLink.style.transform = 'translateY(0)';
            loginLink.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        };

        loginContainer.appendChild(loginLink);
        document.body.appendChild(loginContainer);
    }
});
