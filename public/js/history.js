import {
    auth,
    db,
    onAuthStateChanged,
    signOut,
    collection,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    addDoc,
    serverTimestamp,
    doc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const claimsTableBody = document.getElementById('claimsTableBody');
    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackType = document.getElementById('feedbackType');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const feedbackResult = document.getElementById('feedbackResult');
    const btnSubmitFeedback = document.getElementById('btnSubmitFeedback');

    const previewOverlay = document.getElementById('previewOverlay');
    const btnSignOut = document.getElementById('btnSignOut');

    if (btnSignOut) {
        btnSignOut.addEventListener('click', async () => {
            await signOut(auth);
            localStorage.removeItem('session_role');
            window.location.href = 'index.html';
        });
    }

    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;

        // Fetch User Premium Status
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const premium = data.premium || 0;
            const hasActivePlan = premium > 0 && typeof data.activePlan === 'string';

            if (!hasActivePlan) {
                if (previewOverlay) previewOverlay.style.display = 'flex';
                // Lock features
                if (btnSubmitFeedback) btnSubmitFeedback.disabled = true;
                return; // halt execution
            } else {
                if (previewOverlay) previewOverlay.style.display = 'none';
            }
        }

        await loadClaimsHistory(user.uid);
        await loadShiftHistory(user.uid);
    });

    async function loadClaimsHistory(uid) {
        if (!claimsTableBody) return;

        claimsTableBody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">Loading your claims...</td></tr>';

        try {
            const q = query(
                collection(db, 'claims'),
                where('user_id', '==', uid)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                claimsTableBody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #666;">You have no past claims.</td></tr>';
                return;
            }

            const claims = [];
            snap.forEach(docSnap => {
                claims.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort descending by timestamp manually
            claims.sort((a, b) => {
                const ta = a.timestamp?.seconds || 0;
                const tb = b.timestamp?.seconds || 0;
                return tb - ta;
            });

            claimsTableBody.innerHTML = claims.map(c => {
                const dateHtml = formatTimestamp(c.timestamp);
                const issueHtml = escapeHtml(c.issue_type || 'Unknown');
                const locationHtml = escapeHtml((c.area ? c.area + ', ' : '') + c.city);

                let statusHtml = '<span style="background:#f3f4f6; color:#4b5563; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">Pending</span>';
                if (c.is_verified) {
                    if (c.is_paid) {
                        statusHtml = '<span style="background:#d1fae5; color:#059669; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">Paid Out</span>';
                    } else {
                        statusHtml = '<span style="background:#dbeafe; color:#2563eb; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">Accepted</span>';
                    }
                } else if (c.is_verified === false) {
                    statusHtml = '<span style="background:#fee2e2; color:#dc2626; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">Rejected</span>';
                }

                return `
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 12px; font-size: 14px; color: #1a1a1a;">${dateHtml}</td>
                        <td style="padding: 12px; font-size: 14px; color: #1a1a1a;">${issueHtml}</td>
                        <td style="padding: 12px; font-size: 14px; color: #666;">${locationHtml}</td>
                        <td style="padding: 12px;">${statusHtml}</td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error("Failed to load claims:", error);
            claimsTableBody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #dc2626;">Error loading claims.</td></tr>';
        }
    }

    async function loadShiftHistory(uid) {
        const shiftsTableBody = document.getElementById('shiftsTableBody');
        if (!shiftsTableBody) return;

        shiftsTableBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #666;">Loading your shifts...</td></tr>';

        try {
            const q = query(
                collection(db, 'shifts'),
                where('user_id', '==', uid)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                shiftsTableBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #666;">No logged shifts yet.</td></tr>';
                return;
            }

            const shifts = [];
            snap.forEach(docSnap => {
                shifts.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort descending by timestamp manually
            shifts.sort((a, b) => {
                const ta = a.timestamp?.seconds || 0;
                const tb = b.timestamp?.seconds || 0;
                return tb - ta;
            });

            shiftsTableBody.innerHTML = shifts.map(s => {
                const dateHtml = formatTimestamp(s.timestamp);
                const durHtml = s.duration_hours ? s.duration_hours + " hours" : "Unknown";

                return `
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 12px; font-size: 14px; color: #1a1a1a; font-weight: 600;">${dateHtml}</td>
                        <td style="padding: 12px; font-size: 14px; color: #10b981; font-weight: 700;">${durHtml}</td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error("Failed to load shifts:", error);
            shiftsTableBody.innerHTML = '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #dc2626;">Error loading shifts.</td></tr>';
        }
    }

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            btnSubmitFeedback.disabled = true;
            btnSubmitFeedback.innerHTML = 'Submitting...';
            feedbackResult.style.display = 'none';

            try {
                const type = feedbackType.value;
                const message = feedbackMessage.value.trim();

                await addDoc(collection(db, 'feedbacks'), {
                    user_id: currentUser.uid,
                    email: currentUser.email,
                    type: type,
                    message: message,
                    timestamp: serverTimestamp()
                });

                feedbackResult.style.display = 'block';
                feedbackResult.style.background = '#d1fae5';
                feedbackResult.style.color = '#059669';
                feedbackResult.textContent = 'Feedback successfully submitted to administration. Thank you!';

                feedbackMessage.value = '';

                setTimeout(() => {
                    feedbackResult.style.display = 'none';
                }, 4000);

            } catch (error) {
                console.error("Error submitting feedback:", error);
                feedbackResult.style.display = 'block';
                feedbackResult.style.background = '#fee2e2';
                feedbackResult.style.color = '#dc2626';
                feedbackResult.textContent = 'Failed to submit feedback. Please try again.';
            }

            btnSubmitFeedback.disabled = false;
            btnSubmitFeedback.innerHTML = 'Secure Submit';
        });
    }

    function formatTimestamp(ts) {
        if (!ts) return 'Unknown';
        try {
            const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Unknown';
        }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
});
