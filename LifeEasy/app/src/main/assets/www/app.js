// ============================================================
// OFFLINE-FIRST ENGINE (POWERED BY SUPABASE)
// All server calls go through ofetch() which:
//   1. Immediately updates STATE + re-renders (optimistic UI)
//   2. Tries to perform the operation via Supabase Client
//   3. If offline / fails → pushes to syncQueue & persists to localStorage
//   4. When connection returns → processSyncQueue() drains the queue
// ============================================================

// ─── helpers ────────────────────────────────────────────────
function save() {
    try {
        localStorage.setItem('proflow_state', JSON.stringify(STATE));
    } catch (e) {
        console.warn('save() failed', e);
        // Quota exceeded is silent data loss — don't let it stay silent.
        if (e && e.name === 'QuotaExceededError') {
            // Drop the oldest/most-retried queue items first — they're the ones
            // that can never succeed anyway while the SDK is broken — then retry once.
            if (STATE.syncQueue && STATE.syncQueue.length) {
                STATE.syncQueue.sort((a, b) => (b.retries || 0) - (a.retries || 0));
                STATE.syncQueue.splice(0, Math.ceil(STATE.syncQueue.length / 2));
                try {
                    localStorage.setItem('proflow_state', JSON.stringify(STATE));
                    toast('⚠️ Storage was full — cleared old pending sync items to save your data');
                    return;
                } catch (e2) { /* fall through to alert below */ }
            }
            alert('Storage is full — your last change may not have been saved! Please back up your data.');
        }
    }
}

// Initialize Supabase using the explicit window context to prevent scoping errors
const supabaseUrl = 'https://awxqtgaffcdbnxltfdbk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eHF0Z2FmZmNkYm54bHRmZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTY4NjcsImV4cCI6MjA5ODIzMjg2N30.4BCLCTVApXkozVkbhvWn251TO0eEiCz6DMxsgCQLSpk';
// Guarded: if the SDK script failed to load for any reason, don't let it take
// the whole file down — every function below still needs to be defined so the
// offline-cached UI keeps working; only server calls would be unavailable.
const supabaseClient = window.supabase
    ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
    : { from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }), insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }) }), update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }) }) }), delete: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }) }) }), auth: { getSession: () => Promise.resolve({ data: { session: null } }), signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase SDK not loaded' } }), signUp: () => Promise.resolve({ error: { message: 'Supabase SDK not loaded' } }) } };

// ─── SUPABASE OPERATION MAPPER (STEP 4) ──────────────────────
// Maps old PHP endpoints directly to clean Supabase operations 
async function executeSupabaseOperation(endpoint, payload) {
    let table = '';
    let action = ''; // 'insert', 'update', 'delete'
    let data = { ...payload };
    let matchField = 'id';
    let matchValue = payload.id;
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData?.session?.user) {
        data.user_id = sessionData.session.user.id;
    }

    // Separate action types and prevent frontend temp IDs from spilling into DB identity columns
    if (endpoint.startsWith('add_')) {
        action = 'insert';
        delete data.id;
    } else if (endpoint.startsWith('update_')) {
        action = 'update';
        delete data.id;
    } else if (endpoint.startsWith('delete_')) {
        action = 'delete';
    }

    switch (endpoint) {
        // --- TASKS ---
        // --- TASKS ---
        case 'add_task.php':
            table = 'tasks';
            if (payload.due === "") data.due_date = null;
            else if (payload.due) data.due_date = payload.due;
            delete data.due;

            if (payload.reminder === "") data.reminder = null; // <-- Fixes the crash
            break;
        case 'update_task_details.php':
            table = 'tasks';
            matchField = 'task_id';
            if (payload.due === "") data.due_date = null;
            else if (payload.due) data.due_date = payload.due;
            delete data.due;

            if (payload.reminder === "") data.reminder = null; // <-- Fixes the crash
            break;
        case 'update_task.php':
            table = 'tasks';
            matchField = 'task_id';
            data = { completed: payload.completed };
            break;
        case 'delete_task.php':
            table = 'tasks';
            matchField = 'task_id';
            break;

        // --- PLANS ---
        case 'add_plan.php':
        case 'update_plan.php':
        case 'delete_plan.php':
            table = 'plans';
            if (endpoint === 'update_plan.php') data = { completed: payload.completed };
            break;

        // --- COUNTERS ---
        case 'add_counter.php':
            table = 'counters';
            data = { name: payload.name, value: payload.value, step: payload.step, color: payload.color };
            break;
        case 'update_counter.php':
            table = 'counters';
            data = { value: payload.value, last_updated: payload.lastUpdated || new Date().toLocaleString() };
            break;
        case 'delete_counter.php':
            table = 'counters';
            break;

        // --- MONEY ---
        case 'add_money.php':
        case 'update_money.php':
        case 'delete_money.php':
            table = 'money';
            if (endpoint === 'update_money.php') data = { settled: true };
            break;

        // --- ALARMS ---
        case 'add_alarm.php':
        case 'update_alarm.php':
        case 'delete_alarm.php':
            table = 'alarms';
            if (endpoint === 'update_alarm.php') data = { enabled: payload.enabled };
            break;

        // --- ROADMAPS ---
        case 'add_roadmap.php':
        case 'delete_roadmap.php':
            table = 'roadmaps';
            // Explicitly pass data properties for insertion
            if (endpoint === 'add_roadmap.php') {
                data = {
                    title: payload.title,
                    desc: payload.desc,
                    category: payload.category,
                    target: payload.target,
                    color: payload.color
                };
            }
            break;
        // --- STEPS ---
        case 'add_step.php':
            table = 'steps';
            data = {
                title: payload.title,
                desc: payload.desc,
                date: payload.date,
                order: payload.order,
                completed: payload.completed || false,
                roadmap_id: payload.roadmapId
            };
            break;
        case 'update_step.php':
            table = 'steps';
            data = { completed: payload.completed };
            break;
        case 'delete_step.php':
            table = 'steps';
            break;
        // --- ATTENDANCE ---
        case 'add_attendance.php':
            table = 'attendance';
            data = {
                subject: payload.subject,
                attended: payload.attended || 0,
                missed: payload.missed || 0,
                last_updated: payload.lastUpdated || new Date().toLocaleString()
            };
            break;
        case 'update_attendance.php':
            table = 'attendance';
            data = {
                attended: payload.attended,
                missed: payload.missed,
                last_updated: payload.lastUpdated || new Date().toLocaleString()
            };
            break;
        case 'delete_attendance.php':
            table = 'attendance';
            break;
        // --- ACADEMIC ---
        case 'add_academic.php':
        case 'update_academic.php':
        case 'delete_academic.php':
            table = 'academic';
            break;

        // --- EXPENSE ACCOUNTS ---
        case 'add_account.php':
            table = 'accounts';
            data = {
                name: payload.name,
                balance: payload.balance || 0
            };
            break;
        case 'delete_account.php':
            table = 'accounts';
            break;
        // --- EXPENSES ---
        case 'add_expense.php':
            table = 'expenses';
            data = {
                amount: payload.amount,
                category: payload.category,
                note: payload.note || '',
                date: payload.date,
                time: payload.time,
                account_id: payload.accountId
            };
            break;
        case 'delete_expense.php':
            table = 'expenses';
            break;

        // --- NOTES ---
        case 'add_note.php':
            table = 'notes';
            data = {
                title: payload.title || '',
                body: payload.body || '',
                checklist: payload.checklist || null,
                color: payload.color || null,
                pinned: payload.pinned || false,
                archived: payload.archived || false,
                trashed: payload.trashed || false,
                updated_at: payload.updatedAt || new Date().toISOString()
            };
            break;
        case 'update_note.php': {
            table = 'notes';
            const d = {};
            if (payload.title !== undefined) d.title = payload.title;
            if (payload.body !== undefined) d.body = payload.body;
            if (payload.checklist !== undefined) d.checklist = payload.checklist;
            if (payload.color !== undefined) d.color = payload.color;
            if (payload.pinned !== undefined) d.pinned = payload.pinned;
            if (payload.archived !== undefined) d.archived = payload.archived;
            if (payload.trashed !== undefined) d.trashed = payload.trashed;
            d.updated_at = payload.updatedAt || new Date().toISOString();
            data = d;
            break;
        }
        case 'delete_note.php':
            table = 'notes';
            break;

        // --- SLEEP TRACKER ---
        case 'add_sleep.php':
            table = 'sleep_logs';
            data = {
                date: payload.date,
                bedtime: payload.bedtime,
                wake_time: payload.wake,
                duration_mins: payload.durationMins
            };
            break;
        case 'delete_sleep.php':
            table = 'sleep_logs';
            break;
        default:
            throw new Error(`Unmapped endpoint: ${endpoint}`);
    }

    let query = supabaseClient.from(table);
    let response;

    if (action === 'insert') {
        response = await query.insert([data]).select();
    } else if (action === 'update') {
        response = await query.update(data).eq(matchField, matchValue).select();
    } else if (action === 'delete') {
        response = await query.delete().eq(matchField, matchValue);
    }

    if (response.error) throw response.error;

    // Format output ID to preserve old frontend callbacks mapping temporary keys
    if (action === 'insert' && response.data && response.data[0]) {
        const row = response.data[0];
        return { success: true, id: Number(row.id || row.task_id) };
    }
    return { success: true };
}

function ofetch(endpoint, payload, onSuccess) {
    if (navigator.onLine) {
        executeSupabaseOperation(endpoint, payload)
            .then(d => {
                if (d && d.success) {
                    if (onSuccess) onSuccess(d);
                    save();
                }
            })
            .catch(err => {
                console.warn('Supabase offline fallback triggered:', err);
                STATE.syncQueue = STATE.syncQueue || [];
                // Snapshot the payload (not a live reference!) — otherwise later edits to
                // this same STATE record (e.g. adjusting a counter before its "add" has
                // synced) silently mutate the already-queued request too.
                STATE.syncQueue.push({ endpoint, payload: JSON.parse(JSON.stringify(payload)) });
                save();
                showSyncBadge();
            });
    } else {
        STATE.syncQueue = STATE.syncQueue || [];
        STATE.syncQueue.push({ endpoint, payload: JSON.parse(JSON.stringify(payload)) });
        save();
        showSyncBadge();
    }
}

// ─── sync queue ─────────────────────────────────────────────
async function processSyncQueue() {
    if (!STATE.syncQueue || STATE.syncQueue.length === 0) return;
    if (!navigator.onLine) return;

    const queue = [...STATE.syncQueue];
    STATE.syncQueue = [];
    save();

    let ok = 0, fail = 0;
    const idMap = {}; // tempId -> realId, resolved as we go

    // 👇 FIX 1: Restored the proper item loop
    for (const item of queue) {
        item.retries = item.retries || 0;

        for (const key of ['id', 'accountId', 'roadmapId']) {
            // Rewrite any id in this payload that points at a tempId we've since resolved
            if (item.payload[key] !== undefined && idMap[item.payload[key]] !== undefined) {
                item.payload[key] = idMap[item.payload[key]];
            }
        }

        try {
            const d = await executeSupabaseOperation(item.endpoint, item.payload);
            if (d && d.success) {
                ok++;
                // If this was an "add", remember tempId -> realId and patch STATE now
                if (item.endpoint.startsWith('add_') && d.id) {
                    const tempId = item.payload.id;
                    idMap[tempId] = d.id;
                    for (const key of ['tasks', 'plans', 'counters', 'money', 'alarms', 'roadmaps', 'steps', 'attendance', 'academic', 'accounts', 'expenses', 'notes', 'sleepLogs']) {                        const arr = STATE[key];
                        // 👇 FIX 2: Restored the array check and the 'rec' finder
                        if (Array.isArray(arr)) {
                            const rec = arr.find(x => x.id === tempId);
                            if (rec) {
                                rec.id = d.id;
                                rec.pendingSync = false;
                            }
                        }
                    }
                }
            } else {
                throw new Error("Sync operation failed");
            }
        } catch (err) {
            item.retries++;
            if (item.retries < 3) { STATE.syncQueue.push(item); fail++; }
            else { console.warn("Dropping item after 3 failed retries:", item); toast("A sync operation failed permanently."); }
        }
    }

    save();
    if (ok > 0) { toast(`☁️ Synced ${ok} item${ok > 1 ? 's' : ''} to cloud!`); hideSyncBadge(); load(); }
    if (fail > 0) showSyncBadge();
}

window.addEventListener('online', processSyncQueue);
// Note: startup sync is now triggered once, in sequence, from index.html's
// DOMContentLoaded handler via `processSyncQueue().then(load)` — this avoids
// a second, parallel DOMContentLoaded trigger racing against it.

// ─── sync badge (visual indicator) ──────────────────────────
function showSyncBadge() {
    let b = document.getElementById('syncBadge');
    if (!b) {
        b = document.createElement('div');
        b.id = 'syncBadge';
        b.title = 'Pending offline changes – will sync when online';
        b.innerHTML = '📶 <span id="syncCount"></span>';
        Object.assign(b.style, {
            position: 'fixed', top: '10px', right: '10px',
            background: 'var(--accent3)', color: '#fff',
            fontSize: '11px', fontWeight: '700',
            padding: '4px 10px', borderRadius: '20px',
            zIndex: '99999', cursor: 'pointer', transition: '0.3s'
        });
        b.onclick = processSyncQueue;
        document.body.appendChild(b);
    }
    const cnt = (STATE.syncQueue || []).length;
    document.getElementById('syncCount').textContent = cnt > 0 ? ` ${cnt} pending` : '';
    b.style.display = 'flex';
}

function hideSyncBadge() {
    const b = document.getElementById('syncBadge');
    if (b) b.style.display = 'none';
}

// ─── server load ─────────────────────────────────────────────
async function load() {
    try {
        const saved = localStorage.getItem('proflow_state');
        if (saved) {
            try { Object.assign(STATE, JSON.parse(saved)); } catch (e) { }
        }

        // Pull down migrated data across all tables from Supabase concurrently
        const [
            rTasks, rCounters, rPlans, rMoney, rAlarms,
            rRoadmaps, rSteps, rAttendance, rAcademic, rAccounts, rExpenses,
            rNotes, rSleep
        ] = await Promise.all([
            supabaseClient.from('tasks').select('*'),
            supabaseClient.from('counters').select('*'),
            supabaseClient.from('plans').select('*'),
            supabaseClient.from('money').select('*'),
            supabaseClient.from('alarms').select('*'),
            supabaseClient.from('roadmaps').select('*'),
            supabaseClient.from('steps').select('*'),
            supabaseClient.from('attendance').select('*'),
            supabaseClient.from('academic').select('*'),
            supabaseClient.from('accounts').select('*'),
            supabaseClient.from('expenses').select('*'),
            supabaseClient.from('notes').select('*'),
            supabaseClient.from('sleep_logs').select('*')
        ]);

        if (rTasks.error?.status === 401 || rCounters.error?.status === 401) {
            document.getElementById('authModal').style.display = 'flex';
            return;
        }

        // Map data directly into app state collections while matching frontend naming conventions
        if (rTasks.data) STATE.tasks = rTasks.data.map(t => ({ ...t, id: t.task_id }));
        if (rCounters.data) STATE.counters = rCounters.data.map(c => ({ ...c, lastUpdated: c.last_updated }));
        if (rPlans.data) STATE.plans = rPlans.data;
        if (rMoney.data) STATE.money = rMoney.data;
        if (rAlarms.data) STATE.alarms = rAlarms.data;
        if (rRoadmaps.data) STATE.roadmaps = rRoadmaps.data;
        if (rSteps.data) STATE.steps = rSteps.data.map(s => ({ ...s, roadmapId: s.roadmap_id }));
        if (rAttendance.data) STATE.attendance = rAttendance.data.map(a => ({ ...a, lastUpdated: a.last_updated }));
        if (rAcademic.data) STATE.academic = rAcademic.data;
        if (rAccounts.data) STATE.accounts = rAccounts.data;
        if (rExpenses.data) STATE.expenses = rExpenses.data.map(e => ({ ...e, accountId: e.account_id }));
        if (rNotes.data) {
           const serverNotes = rNotes.data.map(n => ({ ...n, updatedAt: n.updated_at }));
           const pendingIds = new Set((STATE.syncQueue || []).filter(q => q.endpoint === 'add_note.php').map(q => q.payload.id));
           const unsynced = (STATE.notes || []).filter(n => pendingIds.has(n.id));
           STATE.notes = [...unsynced, ...serverNotes];
        }
        if (rSleep.data) {
            const serverSleep = rSleep.data.map(s => ({ ...s, wake: s.wake_time, durationMins: s.duration_mins }));
            const pendingIds = new Set((STATE.syncQueue || []).filter(q => q.endpoint === 'add_sleep.php').map(q => q.payload.id));
            const unsynced = (STATE.sleepLogs || []).filter(s => pendingIds.has(s.id));
            STATE.sleepLogs = [...unsynced, ...serverSleep];
        }

        save();
        renderAll();
        if (typeof updateGreeting === 'function') updateGreeting();

        if ((STATE.syncQueue || []).length > 0) showSyncBadge();
        else hideSyncBadge();

    } catch (err) {
        console.log('Offline mode — using cached data', err);
        if ((STATE.syncQueue || []).length > 0) showSyncBadge();
    }
}

// ============================================================
// AUTHENTICATION
// ============================================================
function switchAuthTab(tab) {
    document.getElementById('loginError').innerText = '';
    document.getElementById('regError').innerText = '';
    if (tab === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('tabRegister').classList.remove('active');
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('tabLogin').classList.remove('active');
        document.getElementById('tabRegister').classList.add('active');
    }
}

async function handleAuth(event, endpoint) {
    event.preventDefault();
    const isLogin = endpoint === 'login.php';
    const username = document.getElementById(isLogin ? 'loginUsername' : 'regUsername').value;
    const password = document.getElementById(isLogin ? 'loginPassword' : 'regPassword').value;
    const errorId = isLogin ? 'loginError' : 'regError';

    try {
        if (isLogin) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: username.includes('@') ? username : username + "@lifeeasy.local",
                password: password
            });
            if (error) throw error;
        } else {
            const { data, error } = await supabaseClient.auth.signUp({
                email: username.includes('@') ? username : username + "@lifeeasy.local",
                password: password
            });
            if (error) throw error;
            toast('Account created! Please log in.');
            switchAuthTab('login');
            return;
        }

        document.getElementById('authModal').style.display = 'none';
        document.getElementById('loginPassword').value = '';
        document.getElementById('regPassword').value = '';
        load();

    } catch (err) {
        document.getElementById(errorId).innerText = err.message || 'Authentication failed.';
    }
}

async function logoutUser() {
    try {
        await supabaseClient.auth.signOut();
        document.getElementById('authModal').style.display = 'flex';
        switchAuthTab('login');
    } catch (e) {
        console.error('Logout error', e);
    }
}

// ============================================================
// THEME
// ============================================================
function toggleTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') {
        localStorage.removeItem('theme');
        root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
        localStorage.setItem('theme', theme);
        root.setAttribute('data-theme', theme);
    }
    root.style.display = 'none'; root.offsetHeight; root.style.display = '';
}

function initTheme() {
    const t = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const sel = document.getElementById('themeSelect');
    if (sel) sel.value = t;
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme'))
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
});

// ============================================================
// VAULT (UPDATED TO INTEGRATE WITH SUPABASE STORAGE BUCKET)
// ============================================================
function renderVault() {
    supabaseClient.from('vault').select('*')
        .then(({ data, error }) => {
            const el = document.getElementById('vaultFiles');
            if (!el) return;
            if (!error && data && data.length > 0) {
                el.innerHTML = data.map(f => `
                    <div class="card-sm" style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:14px;">${f.filename}</div>
                            <div style="font-size:10px;color:var(--text3);">Uploaded: ${new Date(f.upload_date).toLocaleDateString()}</div>
                        </div>
                        <div style="display:flex;gap:10px;">
                            <a href="${f.filepath}" download target="_blank" class="btn-secondary" style="padding:4px 8px;">Download</a>
                            <button onclick="deleteVaultFile(${f.id}, '${f.filepath}')" style="background:none;border:none;color:var(--red);cursor:pointer;">🗑</button>
                        </div>
                    </div>`).join('');
            } else {
                el.innerHTML = '<p style="text-align:center;padding:20px;">Vault is empty</p>';
            }
        })
        .catch(() => {
            const el = document.getElementById('vaultFiles');
            if (el) el.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text3);">📵 Vault unavailable</p>';
        });
}

async function deleteVaultFile(id, filepath) {
    if (!confirm('Delete this file?')) return;
    try {
        const pathParts = filepath.split('/storage/v1/object/public/vault/');
        if (pathParts.length > 1) {
            const storagePath = pathParts[1];
            await supabaseClient.storage.from('vault').remove([storagePath]);
        }
        const { error } = await supabaseClient.from('vault').delete().eq('id', id);
        if (error) throw error;
        toast('File deleted 🗑️');
        renderVault();
    } catch (err) {
        toast('Failed to delete file.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    if (!dropZone) return;
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--green)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--accent)');
    dropZone.addEventListener('drop', e => { e.preventDefault(); uploadFile(e.dataTransfer.files); });
    if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFile(fileInput.files); });
});

async function uploadFile(files) {
    if (!files || !files.length) return;
    const file = files[0];
    const dz = document.getElementById('dropZone');
    if (dz) dz.style.borderColor = 'var(--accent2)';

    try {
        // 👇 ADDED THESE TWO LINES: Grab the logged-in user's ID
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;

        if (!userId) throw new Error("You must be logged in to upload files.");

        const fileExt = file.name.split('.').pop();
        const generatedName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        // 1. Upload the file to the storage bucket
        const { data: sData, error: sErr } = await supabaseClient.storage
            .from('vault')
            .upload(generatedName, file);

        if (sErr) throw sErr;

        // 2. Get the public URL
        const { data: urlObj } = supabaseClient.storage.from('vault').getPublicUrl(generatedName);

        // 3. Save the record to the database (Now userId is safely attached!)
        const { error: tErr } = await supabaseClient.from('vault').insert([
            { user_id: userId, filename: file.name, filepath: urlObj.publicUrl }
        ]);

        if (tErr) throw tErr;

        if (dz) dz.style.borderColor = 'var(--accent)';
        toast('File saved to Vault! 🔒');
        renderVault();
    } catch (err) {
        if (dz) dz.style.borderColor = 'var(--accent)';
        alert('Upload failed: ' + (err.message || err));
    }
}

// ============================================================
// DATE NAVIGATION
// ============================================================
function goToDate() {
    const val = document.getElementById('goToDateInput').value;
    if (!val) return toast('Please select a date');
    calCurrentDate = new Date(val + 'T00:00:00');
    STATE.selectedDate = val;
    renderCalendar(); renderPlanner();
    toast(`Jumped to ${fmtDisplay(val)}`);
}

function goToToday() {
    const today = new Date();
    const str = fmtDate(today);
    calCurrentDate = today;
    STATE.selectedDate = str;
    document.getElementById('goToDateInput').value = '';
    renderCalendar(); renderPlanner();
    toast('Jumped to today 📅');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}

// ============================================================
// TASKS  (offline-first)
// ============================================================
function saveTask() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return toast('Please enter a task title');

    const editId = document.getElementById('taskModal').dataset.editId;
    const taskData = {
        title,
        description: document.getElementById('taskDesc').value,
        category: document.getElementById('taskCategory').value,
        priority: parseInt(document.getElementById('taskPriority').value),
        due: document.getElementById('taskDue').value,
        reminder: document.getElementById('taskReminder').value
    };

    if (editId) {
        taskData.id = parseInt(editId);
        const idx = STATE.tasks.findIndex(x => x.id === taskData.id);
        if (idx >= 0) { taskData.completed = STATE.tasks[idx].completed; STATE.tasks[idx] = taskData; }
        renderTasks(); renderDashboard(); closeModal('taskModal'); save();
        ofetch('update_task_details.php', taskData, () => toast('Task updated! ✅'));
    } else {
        const tempId = Date.now();
        taskData.id = tempId; taskData.completed = false;
        STATE.tasks.unshift(taskData);
        renderTasks(); renderDashboard(); closeModal('taskModal'); save();
        toast('Saved! ✅');

        ofetch('add_task.php', taskData, d => {
            const t = STATE.tasks.find(x => x.id === tempId);
            if (t) t.id = Number(d.id);
            renderTasks();
            save();
        });
    }
    if (taskData.reminder) scheduleReminderToast(taskData);
}

function toggleTask(e, id) {
    if (e) e.stopPropagation();
    const t = STATE.tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    renderTasks(); renderDashboard(); save();
    toast(t.completed ? 'Task done! 🎉' : 'Task reopened');
    ofetch('update_task.php', { id, completed: t.completed });
}

// Fixed function structure error here
function deleteTask(e, id) {
    if (e) e.stopPropagation();
    STATE.tasks = STATE.tasks.filter(t => t.id !== id);
    renderTasks(); renderDashboard(); save();
    toast('Task deleted 🗑️');
    ofetch('delete_task.php', { id });
}

// ============================================================
// PLANNER  (offline-first)
// ============================================================
function savePlan() {
    const title = document.getElementById('planTitle').value.trim();
    if (!title) return toast('Please enter a title');
    const planData = {
        title,
        desc: document.getElementById('planDesc').value,
        date: document.getElementById('planDate').value,
        time: document.getElementById('planTime').value || '09:00',
        color: selectedColors.plan
    };
    const tempId = Date.now();
    planData.id = tempId; planData.completed = false;
    STATE.plans.push(planData);
    renderCalendar(); renderPlanner(); renderDashboard(); closeModal('plannerModal'); save();
    toast('Event added 📅');

    ofetch('add_plan.php', planData, d => {
        const p = STATE.plans.find(x => x.id === tempId);
        if (p) p.id = d.id;
        renderCalendar(); renderPlanner(); renderDashboard(); closeModal('plannerModal');
        save();
    });
}

function togglePlan(e, id) {
    if (e) e.stopPropagation();
    const p = STATE.plans.find(x => x.id === id);
    if (!p) return;
    p.completed = !p.completed;
    renderPlanner(); renderDashboard(); save();
    ofetch('update_plan.php', { id, completed: p.completed });
}

function deletePlan(e, id) {
    if (e) e.stopPropagation();
    STATE.plans = STATE.plans.filter(x => x.id !== id);
    renderCalendar(); renderPlanner(); renderDashboard(); save();
    toast('Deleted 🗑️');
    ofetch('delete_plan.php', { id });
}

// ============================================================
// COUNTERS  (offline-first)
// ============================================================
function saveCounter() {
    const name = document.getElementById('counterName').value.trim();
    if (!name) return toast('Enter a name');
    const cData = {
        name,
        value: parseInt(document.getElementById('counterStart').value) || 0,
        step: parseInt(document.getElementById('counterStep').value) || 1,
        color: selectedColors.counter
    };
    const tempId = Date.now();
    cData.id = tempId;
    STATE.counters.push(cData);
    renderCounters(); closeModal('counterModal'); save();
    toast('Counter created 🔢');

    ofetch('add_counter.php', cData, d => {
        const c = STATE.counters.find(x => x.id === tempId);
        if (c) c.id = d.id;
        renderCounters();
        save();
    });
}

function adjustCounter(id, dir) {
    const c = STATE.counters.find(x => x.id === id);
    if (!c) return;
    c.value += dir * c.step;
    c.lastUpdated = new Date().toLocaleString();
    renderCounters(); save();
    ofetch('update_counter.php', { id, value: c.value });
}

function resetCounter(id) {
    const c = STATE.counters.find(x => x.id === id);
    if (!c) return;
    c.value = 0; c.lastUpdated = new Date().toLocaleString();
    renderCounters(); save();
    ofetch('update_counter.php', { id, value: 0 });
}

function deleteCounter(e, id) {
    if (e) e.stopPropagation();
    STATE.counters = STATE.counters.filter(x => x.id !== id);
    renderCounters(); save();
    toast('Counter deleted 🗑️');
    ofetch('delete_counter.php', { id });
}

// ============================================================
// MONEY  (offline-first)
// ============================================================
function saveMoney() {
    const person = document.getElementById('moneyPerson').value.trim();
    const amount = parseFloat(document.getElementById('moneyAmount').value);
    if (!person || !amount) return toast('Fill required fields');

    const mData = {
        person, amount,
        type: document.getElementById('moneyType').value,
        note: document.getElementById('moneyNote').value,
        due: document.getElementById('moneyDue').value
    };
    const tempId = Date.now();
    mData.id = tempId; mData.settled = false;
    STATE.money.push(mData);
    renderMoney(); renderDashboard(); closeModal('moneyModal'); save();
    toast('Saved 💰');

    ofetch('add_money.php', mData, d => {
        const m = STATE.money.find(x => x.id === tempId);
        if (m) m.id = d.id;
        renderMoney(); renderDashboard(); save();
    });
}

function settleMoney(e, id) {
    if (e) e.stopPropagation();
    const m = STATE.money.find(x => x.id === id);
    if (!m) return;
    m.settled = true;
    renderMoney(); save();
    toast('Settled ✓');
    ofetch('update_money.php', { id });
}

function deleteMoney(e, id) {
    if (e) e.stopPropagation();
    STATE.money = STATE.money.filter(x => x.id !== id);
    renderMoney(); save();
    toast('Deleted 🗑️');
    ofetch('delete_money.php', { id });
}

// ============================================================
// ALARMS  (offline-first)
// ============================================================
function saveAlarm() {
    const time = document.getElementById('alarmTime').value;
    if (!time) return toast('Please set a time');
    const days = [...document.querySelectorAll('.day-btn.selected')].map(b => b.dataset.day).join('');
    const [h, m] = time.split(':').map(Number);
    const aData = { time, hour: h, minute: m, label: document.getElementById('alarmLabel').value || 'Alarm', days };
    const tempId = Date.now();
    aData.id = tempId; aData.enabled = true;
    STATE.alarms.push(aData);
    renderAlarms(); closeModal('alarmModal'); save();
    toast('Alarm set ⏰');

    ofetch('add_alarm.php', aData, d => {
        const a = STATE.alarms.find(x => x.id === tempId);
        if (a) a.id = d.id;
        renderAlarms(); renderDashboard();
        save();
    });
}

function toggleAlarm(e, id) {
    if (e) e.stopPropagation();
    const a = STATE.alarms.find(x => x.id === id);
    if (!a) return;
    a.enabled = !a.enabled;
    renderAlarms(); renderDashboard(); save();
    toast(a.enabled ? 'Alarm enabled' : 'Alarm disabled');
    ofetch('update_alarm.php', { id, enabled: a.enabled });
}

function deleteAlarm(e, id) {
    if (e) e.stopPropagation();
    STATE.alarms = STATE.alarms.filter(x => x.id !== id);
    renderAlarms(); renderDashboard(); save();
    toast('Alarm deleted 🗑️');
    ofetch('delete_alarm.php', { id });
}

// ============================================================
// ROADMAPS  (offline-first)
// ============================================================
function saveRoadmap() {
    const title = document.getElementById('roadmapTitle').value.trim();
    if (!title) return toast('Please enter a title');
    const rData = {
        title,
        desc: document.getElementById('roadmapDesc').value,
        category: document.getElementById('roadmapCategory').value,
        target: document.getElementById('roadmapTarget').value,
        color: selectedColors.roadmap
    };
    const tempId = Date.now();
    rData.id = tempId;
    rData.pendingSync = true;
    STATE.roadmaps.push(rData);
    renderRoadmaps(); closeModal('roadmapModal'); save();
    toast('Roadmap created 🗺️');

    ofetch('add_roadmap.php', rData, d => {
        const r = STATE.roadmaps.find(x => x.id === tempId);
        if (r) { r.id = d.id; r.pendingSync = false; }
        renderRoadmaps(); renderDashboard(); save();
    });
}

function deleteRoadmap(e, id) {
    if (e) e.stopPropagation();
    STATE.roadmaps = STATE.roadmaps.filter(r => r.id !== id);
    STATE.steps = STATE.steps.filter(s => s.roadmapId !== id);
    document.getElementById('roadmapDetail-view').style.display = 'none';
    document.getElementById('roadmapList-view').style.display = 'block';
    renderRoadmaps(); save();
    toast('Roadmap Deleted! 🗑️');
    ofetch('delete_roadmap.php', { id });
}

function saveStep() {
    const title = document.getElementById('stepTitle').value.trim();
    if (!title) return toast('Please enter a title');
    const rid = parseInt(document.getElementById('stepModal').dataset.roadmapId);
    const order = STATE.steps.filter(s => s.roadmapId === rid).length;
    const sData = {
        roadmapId: rid, title,
        desc: document.getElementById('stepDesc').value,
        date: document.getElementById('stepDate').value,
        order
    };
    const tempId = Date.now();
    sData.id = tempId; sData.completed = false;
    STATE.steps.push(sData);
    closeModal('stepModal');
    renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid));
    renderRoadmaps();
    save();
    toast('Step added 🏁');

    ofetch('add_step.php', sData, d => {
        const s = STATE.steps.find(x => x.id === tempId);
        if (s) s.id = d.id;
        renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid));
        save();
    });
}

function toggleStep(e, id, rid) {
    if (e) e.stopPropagation();
    const s = STATE.steps.find(x => x.id === id);
    if (!s) return;
    s.completed = !s.completed;
    renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid)); renderRoadmaps(); save();
    ofetch('update_step.php', { id, completed: s.completed });
}

function deleteStep(e, id, rid) {
    if (e) e.stopPropagation();
    STATE.steps = STATE.steps.filter(s => s.id !== id);
    renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid)); renderRoadmaps(); save();
    toast('Step deleted! 🗑️');
    ofetch('delete_step.php', { id });
}

// ============================================================
// ATTENDANCE  (offline-first)
// ============================================================
function saveAttendance() {
    const sub = document.getElementById('attSubject').value.trim();
    if (!sub) return toast('Need a subject name!');
    const tempId = Date.now();
    const aData = { id: tempId, subject: sub, attended: 0, missed: 0, lastUpdated: new Date().toLocaleString() };
    STATE.attendance.push(aData);
    renderAttendance(); closeModal('attendanceModal'); save();
    toast('Class Added! 📊');

    ofetch('add_attendance.php', aData, d => {
        const a = STATE.attendance.find(x => x.id === tempId);
        if (a) a.id = d.id;
        renderAttendance(); closeModal('attendanceModal'); renderDashboard();
        save();
    });
}

function markAtt(e, id, isAttend) {
    if (e) e.stopPropagation();
    const item = STATE.attendance.find(a => a.id === id);
    if (!item) return;
    if (isAttend) item.attended++; else item.missed++;
    item.lastUpdated = new Date().toLocaleString();
    renderAttendance(); renderDashboard(); save();
    ofetch('update_attendance.php', { id, attended: item.attended, missed: item.missed });
}

function delAtt(e, id) {
    if (e) e.stopPropagation();
    STATE.attendance = STATE.attendance.filter(a => a.id !== id);
    renderAttendance(); renderDashboard(); save();
    toast('Class Deleted!');
    ofetch('delete_attendance.php', { id });
}

// ============================================================
// ACADEMIC  (offline-first)
// ============================================================
function saveAcademic() {
    const subject = document.getElementById('acadSubject').value.trim();
    if (!subject) return toast('Need a subject!');
    const editId = document.getElementById('academicModal').dataset.editId;
    const aData = {
        subject,
        type: document.getElementById('acadType').value,
        date: document.getElementById('acadDate').value,
        topic: document.getElementById('acadTopic').value,
        desc: document.getElementById('acadDesc').value,
        note: document.getElementById('acadNote').value
    };

    if (editId) {
        aData.id = parseInt(editId);
        const idx = STATE.academic.findIndex(x => x.id === aData.id);
        if (idx >= 0) STATE.academic[idx] = aData;
        renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner();
        closeModal('academicModal'); save();
        toast('Updated! 🎓');
        ofetch('update_academic.php', aData);
    } else {
        const tempId = Date.now();
        aData.id = tempId;
        STATE.academic.push(aData);
        renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner();
        closeModal('academicModal'); save();
        toast('Saved! 🎓');

        ofetch('add_academic.php', aData, d => {
            const a = STATE.academic.find(x => x.id === tempId);
            if (a) a.id = d.id;
            renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner();
            save();
        });
    }
}

function delAcademic(e, id) {
    if (e) e.stopPropagation();
    STATE.academic = STATE.academic.filter(a => a.id !== id);
    renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner(); save();
    toast('Deleted!');
    ofetch('delete_academic.php', { id });
}

// ============================================================
// EXPENSE TRACKER  (offline-first)
// ============================================================
// Balance is DERIVED, not stored/synced — it's the account's opening
// balance minus the sum of its expense rows (deposits are stored as
// negative amounts, so subtracting them adds back to the balance).
// This makes it self-healing: since expenses already sync reliably,
// the balance can never drift out of sync with the server the way a
// separately-mutated `acc.balance` counter would (which is what was
// happening before — it only ever lived in localStorage and got wiped
// back to the opening balance on every load()).
function getAccountBalance(accountId) {
    const acc = STATE.accounts.find(a => a.id == accountId);
    const opening = parseFloat(acc ? acc.balance : 0) || 0;
    const txSum = STATE.expenses
        .filter(e => e.accountId == accountId)
        .reduce((s, e) => s - (parseFloat(e.amount) || 0), 0);
    return opening + txSum;
}

function renderExpenses() {
    if (!STATE.activeAccountId) {
        const mv = document.getElementById('expensesMainView');
        const dv = document.getElementById('transactionDetailView');
        if (mv) mv.style.display = 'block';
        if (dv) dv.style.display = 'none';
    }
    const el = document.getElementById('accountDisplay');
    if (!el) return;

    if (!STATE.accounts || STATE.accounts.length === 0) {
        el.innerHTML = `<div class="empty-state" style="grid-column:span 2">
            <div class="empty-icon">💳</div>
            <p>No accounts yet.<br>Tap <strong>+ Account</strong> to create one.</p>
        </div>`;
        return;
    }

    el.innerHTML = STATE.accounts.map(acc => {
        const txCount = STATE.expenses.filter(e => e.accountId == acc.id).length;
        const bal = getAccountBalance(acc.id);
        return `<div onclick="openAccountDetail(${acc.id})" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;cursor:pointer;transition:all 0.2s;min-width:0;">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Account</div>
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${acc.name}</div>
            <div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};">$${bal.toFixed(2)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:8px;">${txCount} transaction${txCount !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');
}

function openAccountModal() {
    const m = document.getElementById('accountModal');
    if (!m) return;
    document.getElementById('accountName').value = '';
    document.getElementById('accountInitial').value = '0';
    m.classList.add('open');
}

function saveAccount() {
    const name = document.getElementById('accountName').value.trim();
    const balance = parseFloat(document.getElementById('accountInitial').value) || 0;
    if (!name) return toast('Please enter an account name');

    const tempId = Date.now();
    const accData = { id: tempId, name, balance, pendingSync: true }; STATE.accounts.push(accData);
    renderExpenses(); closeModal('accountModal'); save();
    toast('Account created! 💳');

    ofetch('add_account.php', { id: tempId, name, balance }, d => {
        const a = STATE.accounts.find(x => x.id === tempId);
        if (a) { a.id = d.id; a.pendingSync = false; }
        renderExpenses(); closeModal('accountModal'); renderDashboard();
        save();
    });
}

function openAccountDetail(id) {
    STATE.activeAccountId = id;
    const acc = STATE.accounts.find(a => a.id == id);
    if (!acc) return;
    document.getElementById('expensesMainView').style.display = 'none';
    document.getElementById('transactionDetailView').style.display = 'block';
    document.getElementById('accountNameTitle').innerHTML =
        `${acc.name} <span onclick="deleteAccount(${acc.id})" style="font-size:16px;cursor:pointer;color:var(--red);margin-left:12px;padding:4px;" title="Delete Account">🗑️</span>`;
    renderTransactions(id);
}

function hideTransactionDetail() {
    STATE.activeAccountId = null;
    document.getElementById('transactionDetailView').style.display = 'none';
    document.getElementById('expensesMainView').style.display = 'block';
    renderExpenses();
}

function openTransactionModal() {
    const acc = STATE.accounts.find(a => a.id == STATE.activeAccountId);
    if (navigator.onLine && acc && acc.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!');
    const m = document.getElementById('transactionModal');
    if (!m) return toast('Modal not found!');
    document.getElementById('transAmount').value = '';
    document.getElementById('transNote').value = '';
    document.getElementById('transCategory').value = 'Food';
    m.classList.add('open');
}

function openAddFundModal() {
    const acc = STATE.accounts.find(a => a.id == STATE.activeAccountId);
    if (navigator.onLine && acc && acc.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!');
    const m = document.getElementById('addFundModal');
    if (!m) return toast('Fund modal not found!');
    document.getElementById('fundAmount').value = '';
    document.getElementById('fundNote').value = '';
    m.classList.add('open');
}

function saveAddFund() {
    const amount = parseFloat(document.getElementById('fundAmount').value);
    const note = document.getElementById('fundNote').value.trim();
    const accountId = STATE.activeAccountId;
    if (!amount || amount <= 0) return toast('Enter a valid amount');
    if (!accountId) return toast('No account selected');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const storedAmount = -Math.abs(amount); // Funds added are negative expenses

    const tempId = Date.now();
    const expenseData = { id: tempId, accountId, amount: storedAmount, category: 'Deposit', note: note || 'Added Funds', date: dateStr, time: timeStr };

    // 1. Update State (balance itself is derived — see getAccountBalance — so we just add the expense row)
    STATE.expenses.push(expenseData);

    // 2. Refresh UI and Save
    save();
    renderTransactions(accountId);
    renderExpenses();
    renderDashboard();
    closeModal('addFundModal');
    toast('Funds added! 💰');

    // 3. Sync to Database
    ofetch('add_expense.php', expenseData, d => {
        const exp = STATE.expenses.find(e => e.id === tempId);
        if (exp) {
            exp.id = Number(d.id);
            save(); // Update local ID and re-save
            renderTransactions(accountId);
        }
    });
}

function saveTransaction() {
    const amount = parseFloat(document.getElementById('transAmount').value);
    const category = document.getElementById('transCategory').value;
    const note = document.getElementById('transNote').value.trim();
    const accountId = STATE.activeAccountId;
    if (!amount || amount <= 0) return toast('Enter a valid amount');
    if (!accountId) return toast('No account selected');

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const tempId = Date.now();
    const expenseData = { id: tempId, accountId, amount, category, note, date: dateStr, time: timeStr };

    // 1. Update State (balance itself is derived — see getAccountBalance — so we just add the expense row)
    STATE.expenses.push(expenseData);

    // 2. Refresh UI and Save
    save();
    renderTransactions(accountId);
    renderExpenses();
    renderDashboard();
    closeModal('transactionModal');
    toast('Saved! ✅');

    // 3. Sync to Database
    ofetch('add_expense.php', expenseData, d => {
        const exp = STATE.expenses.find(e => e.id === tempId);
        if (exp) {
            exp.id = Number(d.id);
            save(); // Update local ID and re-save
            renderTransactions(accountId);
        }
    });
}

function deleteExpense(btn) {
    const expenseId = btn.getAttribute('data-expense-id');
    const accountId = btn.getAttribute('data-account-id');
    if (!expenseId || expenseId === 'undefined') return toast('Cannot delete: missing ID.');
    if (!confirm('Delete this transaction?')) return;

    // Balance is derived (see getAccountBalance) — removing the expense row is enough
    STATE.expenses = STATE.expenses.filter(ex => ex.id != expenseId);
    renderTransactions(accountId); renderExpenses(); renderDashboard(); save();
    toast('Transaction deleted 🗑️');
    ofetch('delete_expense.php', { id: expenseId });
}

function deleteAccount(id) {
    if (!confirm('Delete this account and all its transactions? This cannot be undone.')) return;
    STATE.accounts = STATE.accounts.filter(a => a.id != id);
    STATE.expenses = STATE.expenses.filter(e => e.accountId != id);
    renderExpenses();
    hideTransactionDetail(); renderDashboard(); save();
    toast('Account deleted 🗑️');
    ofetch('delete_account.php', { id });
}

// ============================================================
// TRANSACTION LIST RENDERER
// ============================================================
function renderTransactions(accountId) {
    const list = document.getElementById('transactionList');
    if (!list) return;
    const acc = STATE.accounts.find(a => a.id == accountId);

    const trans = STATE.expenses
        .filter(e => e.accountId == accountId)
        .sort((a, b) => {
            const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00'));
            const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00'));
            return db - da;
        });

    const expensesOnly = trans.filter(t => parseFloat(t.amount) > 0);
    const totalSpent = expensesOnly.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const bal = getAccountBalance(accountId);

    const categoryIcons = {
        'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Shopping': '🛍️',
        'Health': '💊', 'Entertainment': '🎮', 'Education': '📚',
        'Utilities': '💡', 'Other': '📌', 'Deposit': '💰'
    };
    const catColors = ['#7c6ef5', '#5de8c1', '#f5a623', '#f5647c', '#64c8f5', '#c87cf5', '#f57c64'];

    const catTotals = {};
    expensesOnly.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount || 0); });
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    let html = `
    <div style="background:linear-gradient(135deg,rgba(124,110,245,0.12),rgba(93,232,193,0.06));border:1px solid rgba(124,110,245,0.25);border-radius:var(--radius);padding:20px;margin-bottom:16px;">
        <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Current Balance</div>
        <div style="font-family:'Syne',sans-serif;font-size:38px;font-weight:800;color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};line-height:1;">$${bal.toFixed(2)}</div>
        <div style="display:flex;gap:24px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
            <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Total Spent</div><div style="font-size:18px;font-weight:700;color:var(--red);margin-top:2px;">-$${totalSpent.toFixed(2)}</div></div>
            <div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Transactions</div><div style="font-size:18px;font-weight:700;color:var(--text);margin-top:2px;">${trans.length}</div></div>
        </div>
    </div>`;

    if (catEntries.length > 0) {
        html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
        <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:14px;">Spending by Category</div>`;
        catEntries.forEach(([cat, amt], i) => {
            const pct = totalSpent > 0 ? (amt / totalSpent * 100) : 0;
            const color = catColors[i % catColors.length];
            const icon = categoryIcons[cat] || '📌';
            html += `<div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:6px;font-size:13px;"><span>${icon}</span><span style="font-weight:500;">${cat}</span></div>
                    <div><span style="font-size:13px;font-weight:700;color:var(--red);">-$${parseFloat(amt).toFixed(2)}</span><span style="font-size:10px;color:var(--text3);margin-left:6px;">${pct.toFixed(0)}%</span></div>
                </div>
                <div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.5s;"></div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    if (trans.length === 0) {
        html += `<div class="empty-state"><div class="empty-icon">💸</div><p>No expenses yet.<br>Tap + Expense to add one.</p></div>`;
    } else {
        const groups = {};
        trans.forEach(t => { const d = t.date || 'Unknown'; if (!groups[d]) groups[d] = []; groups[d].push(t); });
        const todayStr = new Date().toISOString().split('T')[0];

        Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const dayTotal = groups[date].filter(t => t.amount > 0).reduce((s, t) => s + parseFloat(t.amount || 0), 0);
            let displayDate;
            try { displayDate = date === todayStr ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); }
            catch (e) { displayDate = date; }

            html += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;padding:0 4px;">
                <span>${displayDate}</span><span style="color:var(--red);">-$${dayTotal.toFixed(2)}</span>
            </div>`;

            groups[date].forEach(t => {
                const isIncome = parseFloat(t.amount) < 0;
                const displayAmt = Math.abs(parseFloat(t.amount)).toFixed(2);
                const amtSign = isIncome ? '+' : '-';
                const amtColor = isIncome ? 'var(--green)' : 'var(--red)';
                const icon = isIncome ? '💰' : (categoryIcons[t.category] || '📌');
                let timeDisplay = '';
                if (t.time) {
                    const [h, m] = t.time.split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
                    timeDisplay = `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
                }
                html += `
                <div style="display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;">
                    <div style="width:44px;height:44px;border-radius:12px;background:${isIncome ? 'rgba(93,232,193,0.1)' : 'rgba(245,100,124,0.1)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;">${icon}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:14px;font-weight:600;">${t.category}</div>
                        <div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.note || 'No note'}</div>
                        ${timeDisplay ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;">🕐 ${timeDisplay}</div>` : ''}
                    </div>
                    <div style="text-align:right;flex-shrink:0;">
                        <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:${amtColor};">${amtSign}$${displayAmt}</div>
                        <button data-expense-id="${t.id}" data-account-id="${accountId}" onclick="deleteExpense(this)"
                                style="background:none;border:none;font-size:18px;color:var(--text3);cursor:pointer;margin-top:6px;padding:2px;">🗑</button>
                    </div>
                </div>`;
            });
        });
    }
    list.innerHTML = html;
}

// ============================================================
// EXPORT / IMPORT (LOCAL STATE FALLBACK FOR COHESIVE SYSTEM)
// ============================================================
function exportData() {
    const localData = { ...STATE };
    delete localData.syncQueue;
    const uri = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localData));
    const a = document.createElement('a');
    a.href = uri; a.download = 'lifeeasy_supabase_backup.json';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Backup Exported Locally! 💾');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    toast('Reading backup file...');
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const jsonData = JSON.parse(e.target.result);
            Object.assign(STATE, jsonData);
            save();
            toast('Local cache restored! Uploading modifications...');
            setTimeout(() => location.reload(), 1500);
        } catch { toast('Invalid backup file! ❌'); }
    };
    reader.readAsText(file);
    event.target.value = '';
}