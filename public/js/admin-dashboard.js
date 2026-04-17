import {
    auth,
    db,
    onAuthStateChanged,
    signOut,
    signInAnonymously,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc
} from './firebase-config.js';

const cssEscape = (value) => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
    // Minimal fallback for attribute selectors
    return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
};

function requireAdminSession() {
    const role = localStorage.getItem('session_role');
    const ok = role === 'admin' && localStorage.getItem('admin_authenticated') === 'true';
    if (!ok) {
        window.location.href = "register.html";
        return false;
    }
    return true;
}

function formatTimestamp(ts) {
    if (!ts) return '—';
    try {
        // Firestore Timestamp has toDate()
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        return d.toLocaleString();
    } catch {
        return '—';
    }
}

function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function getClaimStatsForUser(uid) {
    const q = query(collection(db, 'claims'), where('user_id', '==', uid));
    const snap = await getDocs(q);
    let accepted = 0;
    let rejected = 0;
    const rows = [];
    snap.forEach((docSnap) => {
        const c = docSnap.data();
        const ok = Boolean(c.is_verified);
        if (ok) accepted += 1;
        else rejected += 1;
        rows.push({
            id: docSnap.id,
            issue_type: c.issue_type ?? '—',
            state: c.state ?? '—',
            city: c.city ?? '—',
            area: c.area ?? '—',
            is_verified: ok,
            is_paid: Boolean(c.is_paid),
            timestamp: c.timestamp ?? null
        });
    });
    rows.sort((a, b) => {
        const ta = a.timestamp?.seconds ?? 0;
        const tb = b.timestamp?.seconds ?? 0;
        return tb - ta;
    });
    return { accepted, rejected, total: accepted + rejected, recent: rows.slice(0, 10) };
}

async function ensureAdminFirebaseSession() {
    // Many Firestore rules require a signed-in user. Admin login is local-only,
    // so we sign in anonymously to satisfy "request.auth != null" rules.
    try {
        const current = auth.currentUser;
        if (current && current.isAnonymous) return;
        if (current && !current.isAnonymous) {
            try { await signOut(auth); } catch { }
        }
        await signInAnonymously(auth);
    } catch (e) {
        console.warn('Anonymous sign-in failed', e);
    }
}

async function loadTotalDepositedForUser(uid) {
    let totalDep = 0;
    try {
        const qDep = query(collection(db, 'deposits'), where('user_id', '==', uid));
        const snapDep = await getDocs(qDep);
        snapDep.forEach(d => totalDep += d.data().amount || 0);
    } catch (e) { }
    return totalDep;
}

async function loadTotalPaidOutForUser(uid) {
    let totalPay = 0;
    try {
        const qPay = query(collection(db, 'payments'), where('user_id', '==', uid));
        const snapPay = await getDocs(qPay);
        snapPay.forEach(d => totalPay += d.data().amount || 0);
    } catch (e) { }
    return totalPay;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAdminSession()) return;

    await ensureAdminFirebaseSession();

    const btnAdminSignOut = document.getElementById('btnAdminSignOut');
    const usersList = document.getElementById('usersList');
    const userDetails = document.getElementById('userDetails');
    const userSearch = document.getElementById('userSearch');

    if (btnAdminSignOut) {
        btnAdminSignOut.addEventListener('click', async () => {
            localStorage.removeItem('admin_authenticated');
            localStorage.removeItem('session_role');
            window.location.href = "register.html";
        });
    }

    let users = [];
    let activeUid = null;

    async function loadUsers() {
        usersList.innerHTML = `<div class="admin-empty">Loading users...</div>`;
        try {
            const qUsers = query(collection(db, 'users'), orderBy('lastLoginAt', 'desc'), limit(200));
            const snap = await getDocs(qUsers);
            users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('Falling back to unordered users list', e);
            try {
                const snap = await getDocs(collection(db, 'users'));
                users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e2) {
                console.error('Failed to read users collection', e2);
                usersList.innerHTML = `
                    <div class="admin-empty">
                        Failed to load users from Firestore.
                        <br/><br/>
                        This usually means your Firestore rules require a signed-in user and/or do not allow reads on the <code>users</code> collection.
                        <br/>
                        Error: <code>${escapeHtml(e2?.code ?? e2?.message ?? 'unknown')}</code>
                    </div>
                `;
                return;
            }
        }

        if (users.length === 0) {
            usersList.innerHTML = `<div class="admin-empty">No users found yet. Create a client account first.</div>`;
            return;
        }

        renderUsers();
    }

    function matchesSearch(u, term) {
        if (!term) return true;
        const t = term.toLowerCase();
        return String(u.email ?? '').toLowerCase().includes(t) || String(u.uid ?? u.id ?? '').toLowerCase().includes(t);
    }

    function renderUsers() {
        const term = (userSearch?.value ?? '').trim();
        const filtered = users.filter(u => matchesSearch(u, term));
        if (filtered.length === 0) {
            usersList.innerHTML = `<div class="admin-empty">No matches.</div>`;
            return;
        }

        usersList.innerHTML = filtered.map(u => {
            const email = u.email ?? '(no email)';
            const uid = u.uid ?? u.id;
            const activeClass = uid === activeUid ? 'active' : '';

            const scoreNum = Number(u.credit_score);
            let scorePill = '';
            if (u.credit_score !== undefined && !isNaN(scoreNum)) {
                let sClass = 'score-high';
                if (scoreNum < 50) sClass = 'score-low';
                else if (scoreNum < 80) sClass = 'score-medium';
                scorePill = `<span class="pill ${sClass}">Score: ${scoreNum}%</span>`;
            } else {
                scorePill = `<span class="pill">Score: Pending</span>`;
            }

            return `
                <div class="admin-user-row ${activeClass}" data-uid="${escapeHtml(uid)}">
                    <div class="admin-user-main">
                        <div class="admin-user-email">${escapeHtml(email)}</div>
                        <div class="admin-user-uid">${escapeHtml(uid)}</div>
                    </div>
                    <div class="admin-user-stats">
                        <span class="pill">Claims: <span data-stat-total="${escapeHtml(uid)}">—</span></span>
                        <span class="pill success">Accepted: <span data-stat-acc="${escapeHtml(uid)}">—</span></span>
                        <span class="pill error">Rejected: <span data-stat-rej="${escapeHtml(uid)}">—</span></span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click handlers
        usersList.querySelectorAll('.admin-user-row').forEach(row => {
            row.addEventListener('click', async () => {
                const uid = row.getAttribute('data-uid');
                if (!uid) return;
                activeUid = uid;
                renderUsers();
                await renderUserDetails(uid);
            });
        });

        // Prefetch stats for visible users (best-effort)
        prefetchVisibleStats(filtered.slice(0, 25)).catch(() => { });
    }

    async function recordIndividualClaimPayout(uid, claimId, btnElement) {
        if (btnElement) {
            btnElement.disabled = true;
            const originalText = btnElement.innerHTML;
            btnElement.innerHTML = 'Connecting...';
            await new Promise(r => setTimeout(r, 800));
            btnElement.innerHTML = 'Transferring...';
            await new Promise(r => setTimeout(r, 800));
            btnElement.innerHTML = 'Paid!';
            await new Promise(r => setTimeout(r, 500));
        }

        try {
            const amount = 1000; // demo payout of ₹1000 per valid claim
            await addDoc(collection(db, 'payments'), {
                user_id: uid,
                claim_id: claimId,
                amount: amount,
                currency: 'USD',
                timestamp: serverTimestamp(),
                note: 'Claim Payout (demo)'
            });

            // Mark the claim as paid
            const claimRef = doc(db, 'claims', claimId);
            await updateDoc(claimRef, { is_paid: true });

            alert(`Insurance Payout Successful!\nAmount Transferred: ₹${amount}`);

            // Re-render UI
            if (activeUid === uid) {
                await renderUserDetails(uid);
            }
        } catch (e) {
            console.error('Payment record failed', e);
            alert(`Failed to record payment.\n${e?.code ?? e?.message ?? ''}`);
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = 'Approve Payout';
            }
        }
    }

    async function prefetchVisibleStats(list) {
        for (const u of list) {
            const uid = u.uid ?? u.id;
            const { accepted, rejected, total } = await getClaimStatsForUser(uid);

            const tEl = document.querySelector(`[data-stat-total="${cssEscape(uid)}"]`);
            const aEl = document.querySelector(`[data-stat-acc="${cssEscape(uid)}"]`);
            const rEl = document.querySelector(`[data-stat-rej="${cssEscape(uid)}"]`);
            if (tEl) tEl.textContent = String(total);
            if (aEl) aEl.textContent = String(accepted);
            if (rEl) rEl.textContent = String(rejected);
        }
    }

    async function renderUserDetails(uid) {
        const u = users.find(x => (x.uid ?? x.id) === uid);
        if (!u) {
            userDetails.innerHTML = `<div class="admin-empty">User not found.</div>`;
            return;
        }

        userDetails.innerHTML = `<div class="admin-empty">Loading details...</div>`;
        const stats = await getClaimStatsForUser(uid);
        const totalDeposited = await loadTotalDepositedForUser(uid);
        const totalPaidOut = await loadTotalPaidOutForUser(uid);

        let feedbacks = [];
        try {
            const qFeed = query(collection(db, 'feedbacks'), where('user_id', '==', uid));
            const snapFeed = await getDocs(qFeed);
            snapFeed.forEach(d => feedbacks.push({ id: d.id, ...d.data() }));
            feedbacks.sort((a, b) => {
                const ta = a.timestamp?.seconds ?? 0;
                const tb = b.timestamp?.seconds ?? 0;
                return tb - ta;
            });
        } catch (e) { }

        const feedbackRows = feedbacks.map(f => {
            return `
            <tr>
                <td><span class="pill ${f.type === 'complaint' ? 'error' : 'success'}">${escapeHtml(f.type || 'unknown')}</span></td>
                <td>${escapeHtml(f.message)}</td>
                <td>${escapeHtml(formatTimestamp(f.timestamp))}</td>
            </tr>`;
        }).join('');

        const email = u.email ?? '(no email)';
        const createdAt = formatTimestamp(u.createdAt);
        const lastLoginAt = formatTimestamp(u.lastLoginAt);
        const homeZone = u.homeZone ? `Lat: ${u.homeZone.lat?.toFixed?.(4) ?? u.homeZone.lat}, Lng: ${u.homeZone.lng?.toFixed?.(4) ?? u.homeZone.lng}` : 'Not set';

        const fullName = u.fullName || 'Not provided';
        const service = u.service || 'Not provided';
        const dailyIncome = u.dailyIncome ? '₹' + u.dailyIncome : 'Not provided';
        const shiftTiming = (u.shiftStart && u.shiftEnd) ? `${u.shiftStart} to ${u.shiftEnd}` : 'Not configured';

        // Simple payout placeholder: accepted claims * 1000
        const payout = stats.accepted * 1000;

        const claimsRows = stats.recent.map(c => {
            let actionHtml = '';
            if (c.is_verified) {
                if (c.is_paid) {
                    actionHtml = '<span class="pill" style="border-color:#10b981; color:#10b981; background:transparent;">Paid Out</span>';
                } else {
                    actionHtml = `<button class="pill claim-payout-btn" data-claim-id="${escapeHtml(c.id)}" style="cursor:pointer; background:#3b82f6; color:white; border:none; padding: 6px 12px;">Approve Payout</button>`;
                }
            } else {
                actionHtml = '<span style="color:var(--text-muted); font-size:0.8rem;">No Payout</span>';
            }

            return `
            <tr>
                <td>${escapeHtml(c.issue_type)}</td>
                <td>${escapeHtml(`${c.area}, ${c.city}`)}</td>
                <td>${c.is_verified ? '<span class="pill success">Accepted</span>' : '<span class="pill error">Rejected</span>'}</td>
                <td>${escapeHtml(formatTimestamp(c.timestamp))}</td>
                <td>${actionHtml}</td>
            </tr>
        `}).join('');

        const scoreNum = Number(u.credit_score);
        let scoreUI = '';
        if (u.credit_score !== undefined && !isNaN(scoreNum)) {
            let color = '#10b981'; // green
            if (scoreNum < 50) color = '#ef4444'; // red
            else if (scoreNum < 80) color = '#f59e0b'; // orange

            scoreUI = `
                <div style="font-size: 1.5rem; font-weight: 800; color: ${color};">${scoreNum}%</div>
                <div class="score-progress-bar">
                    <div class="score-progress-fill" style="width: ${scoreNum}%; background: ${color};"></div>
                </div>
            `;
        } else {
            scoreUI = `
                <div style="color: var(--text-muted); font-weight: 500;">Pending Analysis</div>
                <div class="score-progress-bar">
                    <div class="score-progress-fill" style="width: 0%; background: var(--text-muted);"></div>
                </div>
            `;
        }

        userDetails.innerHTML = `
            <div class="details-grid">
                <div class="detail-card">
                    <div class="detail-label">FULL NAME</div>
                    <div class="detail-value" style="color: #ff8a2a;">${escapeHtml(fullName)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">EMAIL</div>
                    <div class="detail-value">${escapeHtml(email)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">WORK PROFILE</div>
                    <div class="detail-value">${escapeHtml(service)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">SHIFT COMPASS</div>
                    <div class="detail-value">${escapeHtml(shiftTiming)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">DAILY TARGET</div>
                    <div class="detail-value">${escapeHtml(dailyIncome)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">UID</div>
                    <div class="detail-value" style="font-size: 0.8rem;">${escapeHtml(uid)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">CREATED AT</div>
                    <div class="detail-value">${escapeHtml(createdAt)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">LAST LOGIN</div>
                    <div class="detail-value">${escapeHtml(lastLoginAt)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">HOME ZONE</div>
                    <div class="detail-value">${escapeHtml(homeZone)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">CLAIMS (ACCEPTED / REJECTED)</div>
                    <div class="detail-value">${stats.accepted} / ${stats.rejected}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">TOTAL DEPOSITED</div>
                    <div class="detail-value" style="color: #10b981;">₹${escapeHtml(totalDeposited)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">TOTAL PAID OUT</div>
                    <div class="detail-value" style="color: #3b82f6;">₹${escapeHtml(totalPaidOut)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-label">AI LEGITIMACY SCORE</div>
                    <div class="detail-value" style="margin-top: 8px;">
                        ${scoreUI}
                    </div>
                </div>
            </div>

            <div style="margin-top: 25px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div class="detail-label" style="margin-bottom:0;">RECENT CLAIMS</div>
                <button class="pill error" id="btnDeleteUser" style="cursor:pointer; background:#ef4444; color:white; border:none; padding: 6px 12px;">Delete User</button>
            </div>
                ${stats.recent.length === 0 ? `<div class="admin-empty">No claims yet.</div>` : `
                    <table class="claims-table">
                        <thead>
                            <tr>
                                <th>Issue</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th>Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${claimsRows}
                        </tbody>
                    </table>
                `}

        <div style="margin-top: 25px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="detail-label" style="margin-bottom:0;">RECENT FEEDBACK & COMPLAINTS</div>
        </div>
                ${feedbacks.length === 0 ? `<div class="admin-empty">No reviews or complaints submitted yet.</div>` : `
                    <table class="claims-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th style="width: 50%;">Message</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${feedbackRows}
                        </tbody>
                    </table>
                `}
            </div >
            `;

        // Attach per-claim payout handlers
        userDetails.querySelectorAll('.claim-payout-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const claimId = btn.getAttribute('data-claim-id');
                await recordIndividualClaimPayout(uid, claimId, btn);
            });
        });

        // Delete user handler
        const btnDeleteUser = userDetails.querySelector('#btnDeleteUser');
        if (btnDeleteUser) {
            btnDeleteUser.addEventListener('click', async () => {
                const conf = confirm(`Are you sure you want to permanently delete user ${escapeHtml(email)}? This cannot be undone.`);
                if (!conf) return;

                btnDeleteUser.disabled = true;
                btnDeleteUser.textContent = "Deleting...";

                try {
                    await deleteDoc(doc(db, 'users', uid));
                    alert("User successfully deleted.");
                    activeUid = null;
                    userDetails.innerHTML = `< div class="admin-empty" > Select a client to view details.</div > `;
                    await loadUsers();
                } catch (e) {
                    console.error('Error deleting user:', e);
                    alert("Failed to delete user: " + (e.message || e.code));
                    btnDeleteUser.disabled = false;
                    btnDeleteUser.textContent = "Delete User";
                }
            });
        }
    }

    if (userSearch) {
        userSearch.addEventListener('input', () => renderUsers());
    }

    await loadUsers();
});

