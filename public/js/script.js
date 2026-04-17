import { auth, db, onAuthStateChanged, doc, setDoc, createUserWithEmailAndPassword, getDoc, serverTimestamp } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const insuranceForm = document.getElementById('insuranceForm');

    let currentUser = null;
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
    });

    const radioButtons = document.querySelectorAll('input[name="nightShiftRad"]');
    const nightShiftHidden = document.getElementById('nightShift');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (nightShiftHidden) nightShiftHidden.value = e.target.value;
        });
    });

    const step1Auth = document.getElementById('step1Auth');
    const step2Profile = document.getElementById('step2Profile');

    if (insuranceForm) {
        insuranceForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            const emailInput = document.getElementById('email');
            const pwdInput = document.getElementById('password');
            const email = emailInput ? emailInput.value.trim() : '';
            const pwd = pwdInput ? pwdInput.value : '';

            const fullNameInput = document.getElementById('fullName');
            const fullName = fullNameInput ? fullNameInput.value.trim() : '';

            const ageInput = document.getElementById('age');
            const age = ageInput ? ageInput.value : '';

            const dailyIncomeInput = document.getElementById('dailyIncome');
            const dailyIncome = dailyIncomeInput ? dailyIncomeInput.value : '';

            const shiftStartInput = document.getElementById('shiftStart');
            const shiftStart = shiftStartInput ? shiftStartInput.value : '';

            const shiftEndInput = document.getElementById('shiftEnd');
            const shiftEnd = shiftEndInput ? shiftEndInput.value : '';

            const nightFreqInput = document.querySelector('input[name="nightFrequency"]:checked');
            const nightFrequency = nightFreqInput ? nightFreqInput.value : '';

            let premium = 0;
            if (dailyIncome) {
                const inc = Number(dailyIncome);
                if (inc < 500) premium = 1200;
                else if (inc >= 500 && inc <= 1500) premium = 800;
                else premium = 400;
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
                        fullName: fullName,
                        age: age,
                        dailyIncome: Number(dailyIncome),
                        shiftStart: shiftStart,
                        shiftEnd: shiftEnd,
                        nightFrequency: nightFrequency,
                        createdAt: serverTimestamp(),
                        lastLoginAt: serverTimestamp(),
                        isNewUser: true,
                        premium: premium
                    }, { merge: true });

                    localStorage.setItem('session_role', 'client');
                    window.location.href = 'dashboard.html';
                } else {
                    // Already logged in
                    const userRef = doc(db, 'users', currentUser.uid);
                    await setDoc(userRef, { premium: premium }, { merge: true });
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    alert("Account already exists with this email! Please click Sign In.");
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
