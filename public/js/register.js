import {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from './firebase-config.js';
import { getNearestLocation } from './locations.js';

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authForm');
    const formTitle = document.getElementById('formTitle');
    const btnAuthSubmit = document.getElementById('btnAuthSubmit');
    const toggleText = document.getElementById('toggleText');
    const toggleLink = document.getElementById('toggleLink');
    const labelIdentifier = document.getElementById('labelIdentifier');
    const identifierInput = document.getElementById('identifier');
    const passwordInput = document.getElementById('password');
    const authErrorMsg = document.getElementById('authErrorMsg');

    const btnRoleClient = document.getElementById('btnRoleClient');
    const btnRoleAdmin = document.getElementById('btnRoleAdmin');

    let isLogin = true;
    let role = 'client'; // 'client' | 'admin'
    let isSubmitting = false;
    let selectedHomeZone = null;

    const homeZoneGroup = document.getElementById('homeZoneGroup');
    const btnDetectLocation = document.getElementById('btnDetectLocation');
    const btnSetManually = document.getElementById('btnSetManually');
    const homeZoneDisplay = document.getElementById('homeZoneDisplay');
    const homeZoneCoordsText = document.getElementById('homeZoneCoordsText');

    function updateHomeZoneUI() {
        if (selectedHomeZone) {
            homeZoneDisplay.style.display = 'block';
            const loc = getNearestLocation(selectedHomeZone.lat, selectedHomeZone.lng);
            if (loc) {
                homeZoneCoordsText.textContent = `${loc.name}, ${loc.city}`;
            } else {
                homeZoneCoordsText.textContent = `Lat: ${selectedHomeZone.lat.toFixed(4)}, Lng: ${selectedHomeZone.lng.toFixed(4)}`;
            }
        }
    }

    if (btnDetectLocation) {
        btnDetectLocation.addEventListener('click', () => {
            if ("geolocation" in navigator) {
                btnDetectLocation.textContent = "Detecting...";
                navigator.geolocation.getCurrentPosition((position) => {
                    selectedHomeZone = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    updateHomeZoneUI();
                    btnDetectLocation.textContent = "Detect My Location";
                }, (error) => {
                    alert("Geolocation error: " + error.message);
                    btnDetectLocation.textContent = "Detect My Location";
                });
            } else {
                alert("Geolocation is not supported by your browser.");
            }
        });
    }

    function setRole(nextRole) {
        role = nextRole;
        authErrorMsg.style.display = 'none';

        if (role === 'admin') {
            // Admin can only sign in (no sign up)
            isLogin = true;
            formTitle.textContent = "Admin Sign In";
            btnAuthSubmit.textContent = "Sign In";
            toggleText.textContent = "Admin credentials are fixed.";
            toggleLink.style.display = 'none';

            labelIdentifier.textContent = "Username";
            identifierInput.type = 'text';
            identifierInput.placeholder = 'admin';
            identifierInput.value = '';
            passwordInput.value = '';

            if (btnRoleAdmin) {
                btnRoleAdmin.classList.add('btn');
                btnRoleAdmin.classList.remove('btn-secondary');
                btnRoleAdmin.style.background = 'var(--accent-primary)';
                btnRoleAdmin.style.color = '#fff';
            }
            if (btnRoleClient) {
                btnRoleClient.classList.add('btn-secondary');
                btnRoleClient.style.background = '';
                btnRoleClient.style.color = '';
            }
            if (homeZoneGroup) homeZoneGroup.style.display = 'none';
        } else {
            // Client mode supports sign in / sign up
            formTitle.textContent = isLogin ? "Sign In" : "Create Account";
            btnAuthSubmit.textContent = isLogin ? "Sign In" : "Sign Up";
            toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
            toggleLink.textContent = isLogin ? "Sign Up" : "Sign In";
            toggleLink.style.display = 'inline';

            labelIdentifier.textContent = "Email Address";
            identifierInput.type = 'email';
            identifierInput.placeholder = 'name@company.com';
            identifierInput.value = '';
            passwordInput.value = '';

            if (btnRoleClient) {
                btnRoleClient.classList.remove('btn-secondary');
                btnRoleClient.style.background = 'var(--accent-primary)';
                btnRoleClient.style.color = '#fff';
            }
            if (btnRoleAdmin) {
                btnRoleAdmin.classList.add('btn-secondary');
                btnRoleAdmin.style.background = '';
                btnRoleAdmin.style.color = '';
            }
            if (homeZoneGroup) homeZoneGroup.style.display = (!isLogin) ? 'block' : 'none';
        }
    }

    // Redirect if already logged in (but don't race against form submit)
    onAuthStateChanged(auth, (user) => {
        if (!user) return;
        if (isSubmitting) return;
        if (role === 'admin') return;
        localStorage.setItem('session_role', 'client');
        window.location.href = "dashboard.html";
    });

    if (btnRoleClient) btnRoleClient.addEventListener('click', () => setRole('client'));
    if (btnRoleAdmin) btnRoleAdmin.addEventListener('click', () => setRole('admin'));

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;

        if (role === 'admin') return;

        if (isLogin) {
            formTitle.textContent = "Sign In";
            btnAuthSubmit.textContent = "Sign In";
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = "Sign Up";
        } else {
            formTitle.textContent = "Create Account";
            btnAuthSubmit.textContent = "Sign Up";
            toggleText.textContent = "Already have an account?";
            toggleLink.textContent = "Sign In";
        }

        if (role === 'client' && homeZoneGroup) {
            homeZoneGroup.style.display = (!isLogin) ? 'block' : 'none';
        }

        authErrorMsg.style.display = 'none';
        identifierInput.value = '';
        passwordInput.value = '';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identifier = identifierInput.value.trim();
        const pwd = passwordInput.value;

        isSubmitting = true;
        btnAuthSubmit.disabled = true;
        btnAuthSubmit.innerHTML = '<i data-lucide="loader-2" class="spinner"></i> Processing...';
        lucide.createIcons();
        authErrorMsg.style.display = 'none';

        try {
            if (role === 'admin') {
                const isValidAdmin = identifier === 'admin' && pwd === '1234';
                if (!isValidAdmin) {
                    throw { code: 'local/admin-invalid' };
                }
                localStorage.setItem('session_role', 'admin');
                localStorage.setItem('admin_authenticated', 'true');
                window.location.href = "admin-dashboard.html";
                return;
            }

            if (!isLogin && role === 'client' && !selectedHomeZone) {
                throw new Error('Please detect or manually set your Home Zone to continue.');
            }

            const email = identifier;
            if (isLogin) {
                const credential = await signInWithEmailAndPassword(auth, email, pwd);
                await upsertUserProfile(credential.user);
                localStorage.setItem('session_role', 'client');
                window.location.href = "dashboard.html";
            } else {
                const credential = await createUserWithEmailAndPassword(auth, email, pwd);
                await upsertUserProfile(credential.user, { isNew: true });
                localStorage.setItem('session_role', 'client');
                window.location.href = "dashboard.html";
            }
        } catch (error) {
            console.error(error);
            authErrorMsg.textContent = processFirebaseError(error);
            authErrorMsg.style.display = 'block';
            btnAuthSubmit.disabled = false;
            btnAuthSubmit.textContent = isLogin ? "Sign In" : "Sign Up";
            isSubmitting = false;
        }
    });

    async function upsertUserProfile(user, { isNew } = { isNew: false }) {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        const base = {
            uid: user.uid,
            email: user.email ?? null,
            lastLoginAt: serverTimestamp()
        };
        if (!snap.exists()) {
            await setDoc(ref, {
                ...base,
                createdAt: serverTimestamp(),
                isNewUser: Boolean(isNew),
                homeZone: selectedHomeZone || null,
                homeZoneSetAt: selectedHomeZone ? serverTimestamp() : null
            }, { merge: true });
        } else {
            await setDoc(ref, base, { merge: true });
        }
    }

    function processFirebaseError(error) {
        const code = error.code;
        switch (code) {
            case 'local/admin-invalid': return "Invalid admin username or password.";
            case 'auth/email-already-in-use': return "This email is already registered.";
            case 'auth/invalid-email': return "Invalid email format.";
            case 'auth/user-not-found': return "No account found with this email.";
            case 'auth/wrong-password': return "Incorrect password.";
            case 'auth/weak-password': return "Password should be at least 6 characters.";
            case 'auth/invalid-credential': return "Invalid email or password.";
            default: return `Error: ${code || error.message || "Unknown error"}`;
        }
    }

    // Initial state
    setRole('client');
});
