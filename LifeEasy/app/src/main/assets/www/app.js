// ============================================================
// STATE & HELPERS
// ============================================================
const STATE = {
    tasks: [], plans: [], counters: [], money: [], alarms: [], roadmaps: [], steps: [], attendance: [], academic: [],
    attendanceRoutines: [], attendanceLogs: [], accounts: [], expenses: [], notes: [], sleepLogs: [], syncQueue: [], customTags: [], tabs: [],
    vaultFolders: [], vaultFiles: [], links: [], dailyReminders: [],

    navPreferences: ['dash', 'planner', 'tasks', 'counter', 'money', 'alarms', 'roadmap', 'attendance', 'academic', 'vault', 'expenses', 'notes', 'sleep', 'tabs', 'settings'],
    hiddenNavModules: [],

    // UPDATED: Now includes the top 4 stats as removable mini widgets
    dashWidgets: ['pending_tasks', 'todays_events', 'net_money', 'active_counters', 'redzone', 'schedule', 'classes', 'tasks'],
    dashHiddenWidgets: ['alarms', 'sleep', 'roadmap', 'specific_account', 'specific_counter', 'specific_note'],
    dashConfig: { accountId: null, counterId: null, noteId: null },

    selectedDate: '', attSelectedDate: '', activeRoadmap: null, activeAccountId: null, taskFilter: 'active', moneyFilter: 'all', taskCategories: ['Work', 'Personal']
};

const WIDGET_DICT = {
    // MINI WIDGETS (Half Size)
    pending_tasks: { icon: '✅', label: 'Pending Tasks (Mini)' },
    todays_events: { icon: '📅', label: 'Today\'s Events (Mini)' },
    net_money: { icon: '💰', label: 'Net Money (Mini)' },
    active_counters: { icon: '🔢', label: 'Active Counters (Mini)' },
    alarms: { icon: '⏰', label: 'Active Alarms (Mini)' },
    sleep: { icon: '😴', label: 'Last Night\'s Sleep (Mini)' },
    roadmap: { icon: '🗺️', label: 'Active Roadmap (Mini)' },
    specific_account: { icon: '💳', label: 'Pinned Account (Mini)' },
    specific_counter: { icon: '🔢', label: 'Pinned Counter (Mini)' },
    specific_note: { icon: '📝', label: 'Pinned Note (Mini)' },

    // FULL WIDGETS (Full Width)
    redzone: { icon: '🚨', label: 'Urgent Deadlines (Full)' },
    schedule: { icon: '📅', label: 'Today\'s Schedule (Full)' },
    tasks: { icon: '📋', label: 'Upcoming Tasks (Full)' },
    classes: { icon: '🎓', label: 'Today\'s Classes (Full)' },
    sleep_full: { icon: '😴', label: 'Sleep Tracker Overview (Full)' }
};

// NEW: Master Dictionary of all App Modules
const NAV_MODULES = {
    dash: { icon: '🏠', label: 'Home' },
    planner: { icon: '📅', label: 'Planner' },
    tasks: { icon: '✅', label: 'Tasks' },
    counter: { icon: '🔢', label: 'Counter' },
    money: { icon: '💰', label: 'Money' },
    alarms: { icon: '⏰', label: 'Alarms' },
    roadmap: { icon: '🗺️', label: 'Roadmap' },
    attendance: { icon: '📊', label: 'Attend' },
    academic: { icon: '🎓', label: 'School' },
    links: { icon: '🔗', label: 'Links' },
    vault: { icon: '🔒', label: 'Vault' },
    expenses: { icon: '💸', label: 'Expenses' },
    notes: { icon: '📝', label: 'Notes' },
    sleep: { icon: '😴', label: 'Sleep' },
    settings: { icon: '⚙️', label: 'Settings' }
};

const COLORS = ['#7c6ef5', '#5de8c1', '#f5a623', '#f5647c', '#64c8f5', '#c87cf5', '#f57c64'];
let selectedColors = { plan: '#7c6ef5', counter: '#7c6ef5', roadmap: '#7c6ef5' };
let currentScreen = 'dash';
let toastTimeout;
function toast(message) {
    const toastEl = document.getElementById('toast');
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toastEl.classList.remove('show'); }, 3000);
}

function fmtDate(d) {
    const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function fmtDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00'); return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function save() {
    try { localStorage.setItem('proflow_state', JSON.stringify(STATE)); } catch (e) { console.warn('save() failed', e); }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}

// ============================================================
// OFFLINE-FIRST ENGINE (POWERED BY SUPABASE)
// ============================================================
const supabaseUrl = 'https://awxqtgaffcdbnxltfdbk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eHF0Z2FmZmNkYm54bHRmZGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTY4NjcsImV4cCI6MjA5ODIzMjg2N30.4BCLCTVApXkozVkbhvWn251TO0eEiCz6DMxsgCQLSpk';
const supabaseClient = window.supabase
    ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
    : { from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }), insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }) }), update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }) }) }), delete: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'Supabase SDK not loaded' } }) }) }), auth: { getSession: () => Promise.resolve({ data: { session: null } }), signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase SDK not loaded' } }), signUp: () => Promise.resolve({ error: { message: 'Supabase SDK not loaded' } }) } };

async function executeSupabaseOperation(endpoint, payload) {
    let table = ''; let action = ''; let data = { ...payload }; let matchField = 'id'; let matchValue = payload.id;
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData?.session?.user) data.user_id = sessionData.session.user.id;

    if (endpoint.startsWith('add_')) { action = 'insert'; delete data.id; }
    else if (endpoint.startsWith('update_')) { action = 'update'; delete data.id; }
    else if (endpoint.startsWith('delete_')) { action = 'delete'; }

    switch (endpoint) {
        case 'add_task.php':
        case 'update_task_details.php': {
            table = 'tasks'; matchField = 'task_id';
            data = {
                title: payload.title,
                description: payload.description || '',
                category: payload.category || 'Work',
                priority: payload.priority || 0,
                due_date: payload.due ? payload.due : null,
                completed: payload.completed || false
            };
            if (payload.reminder && payload.reminder !== 'none') {
                const customVal = payload.customReminderTime || '';
                const millis = typeof calculateReminderTimestamp === 'function' ? calculateReminderTimestamp(payload.reminder, payload.due, '09:00', customVal) : null;
                if (millis && millis > 0) {
                    data.reminder = new Date(millis).toISOString();
                } else {
                    data.reminder = null;
                }
            } else {
                data.reminder = null;
            }
            break;
        }
        case 'update_task.php': table = 'tasks'; matchField = 'task_id'; data = { completed: payload.completed }; break;
        case 'delete_task.php': table = 'tasks'; matchField = 'task_id'; break;
        case 'add_plan.php': case 'update_plan.php': case 'delete_plan.php': table = 'plans'; if (endpoint === 'update_plan.php') data = { completed: payload.completed }; if (endpoint === 'add_plan.php') { data = { title: payload.title, desc: payload.desc, date: payload.date, time: payload.time, color: payload.color, recurrence: payload.recurrence }; } break;
        case 'add_counter.php': table = 'counters'; data = { name: payload.name, value: payload.value, step: payload.step, color: payload.color, last_updated: payload.lastUpdated || new Date().toISOString() }; break;
        case 'update_counter.php': table = 'counters'; data = { value: payload.value, last_updated: payload.lastUpdated || new Date().toISOString() }; break;
        case 'delete_counter.php': table = 'counters'; break;
        case 'add_money.php': case 'update_money.php': case 'delete_money.php': table = 'money'; if (endpoint === 'update_money.php') data = { settled: true }; break;
        case 'add_alarm.php': case 'update_alarm.php': case 'delete_alarm.php': table = 'alarms'; if (endpoint === 'update_alarm.php') data = { enabled: payload.enabled }; break;
        case 'add_roadmap.php': case 'delete_roadmap.php': table = 'roadmaps'; if (endpoint === 'add_roadmap.php') { data = { title: payload.title, desc: payload.desc, category: payload.category, target: payload.target, color: payload.color }; } break;
        case 'add_step.php': table = 'steps'; data = { title: payload.title, desc: payload.desc, date: payload.date, order: payload.order, completed: payload.completed || false, roadmap_id: payload.roadmapId }; break;
        case 'update_step.php': table = 'steps'; data = { completed: payload.completed }; break;
        case 'delete_step.php': table = 'steps'; break;
        case 'add_att_routine.php': table = 'attendance_routines'; data = { subject: payload.subject, room: payload.room, start_time: payload.startTime, end_time: payload.endTime, day_of_week: payload.dayOfWeek }; break;
        case 'update_att_routine.php': table = 'attendance_routines'; data = { subject: payload.subject, room: payload.room, start_time: payload.startTime, end_time: payload.endTime, day_of_week: payload.dayOfWeek }; break;
        case 'delete_att_routine.php': table = 'attendance_routines'; break;
        case 'add_att_log.php': table = 'attendance_logs'; data = { routine_id: payload.routineId, date: payload.date, status: payload.status }; break;
        case 'update_att_log.php': table = 'attendance_logs'; data = { status: payload.status }; break;
        case 'add_academic.php': case 'update_academic.php': case 'delete_academic.php': table = 'academic'; break;
        case 'add_account.php': table = 'accounts'; data = { name: payload.name, balance: payload.balance || 0 }; break;
        case 'delete_account.php': table = 'accounts'; break;
        case 'add_expense.php': table = 'expenses'; data = { amount: payload.amount, category: payload.category, note: payload.note || '', date: payload.date, time: payload.time, account_id: payload.accountId }; break;
        case 'delete_expense.php': table = 'expenses'; break;
        case 'add_note.php':
            table = 'notes';
            data = { title: payload.title || '', body: payload.body || '', checklist: payload.checklist || null, tags: payload.tags || null, color: payload.color || null, pinned: payload.pinned || false, archived: payload.archived || false, trashed: payload.trashed || false, updated_at: payload.updatedAt || new Date().toISOString(), is_whiteboard: payload.isWhiteboard || false, wb_data: payload.wbData || null };
            break;
        case 'update_note.php': {
            table = 'notes'; const d = {};
            if (payload.title !== undefined) d.title = payload.title;
            if (payload.body !== undefined) d.body = payload.body;
            if (payload.checklist !== undefined) d.checklist = payload.checklist;
            if (payload.tags !== undefined) d.tags = payload.tags;
            if (payload.color !== undefined) d.color = payload.color;
            if (payload.pinned !== undefined) d.pinned = payload.pinned;
            if (payload.archived !== undefined) d.archived = payload.archived;
            if (payload.trashed !== undefined) d.trashed = payload.trashed;
            if (payload.isWhiteboard !== undefined) d.is_whiteboard = payload.isWhiteboard;
            if (payload.wbData !== undefined) d.wb_data = payload.wbData;
            d.updated_at = payload.updatedAt || new Date().toISOString();
            data = d;
            break;
        }
        case 'delete_note.php': table = 'notes'; break;
        case 'add_sleep.php': table = 'sleep_logs'; data = { date: payload.date, bedtime: payload.bedtime, wake_time: payload.wake, duration_mins: payload.durationMins }; break;
        case 'delete_sleep.php': table = 'sleep_logs'; break;
        case 'add_link.php': table = 'links'; data = { title: payload.title || '', url: payload.url || '', thumbnail: payload.thumbnail || '', note: payload.note || '' }; break;
        case 'update_link.php': {
            table = 'links'; const d = {};
            if (payload.title !== undefined) d.title = payload.title;
            if (payload.url !== undefined) d.url = payload.url;
            if (payload.thumbnail !== undefined) d.thumbnail = payload.thumbnail;
            if (payload.note !== undefined) d.note = payload.note;
            data = d;
            break;
        }
        case 'delete_link.php': table = 'links'; break;
        default: throw new Error(`Unmapped endpoint: ${endpoint}`);
    }

    // CRITICAL FIX: Restore the user_id that was accidentally erased by the switch statement
    if (sessionData?.session?.user && action !== 'delete') {
        data.user_id = sessionData.session.user.id;
    }

    let query = supabaseClient.from(table);
    let response;

    if (action === 'insert') response = await query.insert([data]).select();
    else if (action === 'update') response = await query.update(data).eq(matchField, matchValue).select();
    else if (action === 'delete') response = await query.delete().eq(matchField, matchValue);

    if (response.error) throw response.error;

    if (action === 'insert' && response.data && response.data[0]) {
        const row = response.data[0];
        return { success: true, id: Number(row.id || row.task_id) };
    }
    return { success: true };
}

function ofetch(endpoint, payload, onSuccess) {
    if (navigator.onLine) {
        executeSupabaseOperation(endpoint, payload).then(d => { if (d && d.success) { if (onSuccess) onSuccess(d); save(); } })
            .catch(err => {
                console.warn('Supabase offline fallback triggered:', err);
                STATE.syncQueue = STATE.syncQueue || []; STATE.syncQueue.push({ endpoint, payload: JSON.parse(JSON.stringify(payload)) }); save(); showSyncBadge();
            });
    } else {
        STATE.syncQueue = STATE.syncQueue || []; STATE.syncQueue.push({ endpoint, payload: JSON.parse(JSON.stringify(payload)) }); save(); showSyncBadge();
    }
}

async function processSyncQueue() {
    if (!STATE.syncQueue || STATE.syncQueue.length === 0) return;
    if (!navigator.onLine) return;

    const queue = [...STATE.syncQueue]; STATE.syncQueue = []; save();
    let ok = 0, fail = 0; const idMap = {};

    for (const item of queue) {
        item.retries = item.retries || 0;
        for (const key of ['id', 'accountId', 'roadmapId', 'routineId']) {
            if (item.payload[key] !== undefined && idMap[item.payload[key]] !== undefined) item.payload[key] = idMap[item.payload[key]];
        }
        try {
            const d = await executeSupabaseOperation(item.endpoint, item.payload);
            if (d && d.success) {
                ok++;
                if (item.endpoint.startsWith('add_') && d.id) {
                    const tempId = item.payload.id; idMap[tempId] = d.id;
                    for (const key of ['tasks', 'plans', 'counters', 'money', 'alarms', 'roadmaps', 'steps', 'attendanceRoutines', 'attendanceLogs', 'academic', 'accounts', 'expenses', 'notes', 'sleepLogs']) {
                        const arr = STATE[key];
                        if (Array.isArray(arr)) { const rec = arr.find(x => x.id === tempId); if (rec) { rec.id = d.id; rec.pendingSync = false; } }
                    }

                    // FIX: Reconcile pinned dashboard widgets with the new Real ID
                    if (STATE.dashConfig.accountId == tempId) STATE.dashConfig.accountId = String(d.id);
                    if (STATE.dashConfig.counterId == tempId) STATE.dashConfig.counterId = String(d.id);
                    if (STATE.dashConfig.noteId == tempId) STATE.dashConfig.noteId = String(d.id);
                }
            } else { throw new Error("Sync operation failed"); }
        } catch (err) {
            item.retries++;
            if (item.retries < 3) { STATE.syncQueue.push(item); fail++; } else { console.warn("Dropping item after 3 failed retries:", item); toast("A sync operation failed permanently."); }
        }
    }
    save();
    if (ok > 0) { toast(`☁️ Synced ${ok} item${ok > 1 ? 's' : ''} to cloud!`); hideSyncBadge(); load(); }
    if (fail > 0) showSyncBadge();
}

window.addEventListener('online', processSyncQueue);

function showSyncBadge() {
    let b = document.getElementById('syncBadge');
    if (!b) {
        b = document.createElement('div'); b.id = 'syncBadge'; b.title = 'Pending offline changes – will sync when online'; b.innerHTML = '📶 <span id="syncCount"></span>';
        Object.assign(b.style, { position: 'fixed', top: '10px', right: '10px', background: 'var(--accent3)', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', zIndex: '99999', cursor: 'pointer', transition: '0.3s' });

        b.onclick = showSyncDetails; // Trigger Inspector instead of silent retry

        document.body.appendChild(b);
    }
    const cnt = (STATE.syncQueue || []).length; document.getElementById('syncCount').textContent = cnt > 0 ? ` ${cnt} pending` : ''; b.style.display = 'flex';
}
function hideSyncBadge() { const b = document.getElementById('syncBadge'); if (b) b.style.display = 'none'; }
// ============================================================
// SYNC INSPECTOR UI
// ============================================================
function showSyncDetails() {
    if (!STATE.syncQueue || STATE.syncQueue.length === 0) return toast('All data is synced! ☁️');

    let html = '<div style="max-height:50vh; overflow-y:auto; margin-bottom:16px;">';

    STATE.syncQueue.forEach((item) => {
        // Beautify the endpoint name (e.g. add_task.php -> ADD TASK)
        const action = item.endpoint.replace('.php', '').replace(/_/g, ' ').toUpperCase();

        // Try to grab the most recognizable name/title from the payload
        const itemName = item.payload.title || item.payload.name || item.payload.subject || (item.payload.amount ? '$' + item.payload.amount : '') || 'Item Data';

        html += `
        <div style="background:var(--surface2); border:1px solid var(--border); padding:12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-size:10px; color:var(--text3); font-weight:700;">${action}</div>
                <div style="font-size:14px; font-weight:600; color:var(--text); margin-top:2px;">${escapeHtml(itemName.toString())}</div>
                ${item.retries ? `<div style="font-size:11px; color:var(--red); margin-top:4px;">Failed retries: ${item.retries}/3</div>` : '<div style="font-size:11px; color:var(--accent3); margin-top:4px;">Pending Sync...</div>'}
            </div>
        </div>`;
    });
    html += '</div>';

    // Inject the Modal Dynamically
    let m = document.getElementById('syncDetailsModal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'syncDetailsModal';
        m.className = 'modal-overlay';
        m.innerHTML = `
            <div class="modal">
                <div class="modal-handle"></div>
                <div class="modal-title">Sync Queue Inspector</div>
                <div id="syncDetailsContent"></div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal('syncDetailsModal')">Close</button>
                    <button class="btn-primary" onclick="closeModal('syncDetailsModal'); toast('Forcing Sync...'); processSyncQueue();">Force Retry</button>
                </div>
            </div>
        `;
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    }

    document.getElementById('syncDetailsContent').innerHTML = html;
    m.classList.add('open');
}
async function load() {
    try {
        const saved = localStorage.getItem('proflow_state');
        if (saved) { try { Object.assign(STATE, JSON.parse(saved)); } catch (e) { } }

        const [rTasks, rCounters, rPlans, rMoney, rAlarms, rRoadmaps, rSteps, rAcademic, rAccounts, rExpenses, rNotes, rSleep, rAttRoutines, rAttLogs, rLinks, rCover] = await Promise.all([
            supabaseClient.from('tasks').select('*'),
            supabaseClient.from('counters').select('*'),
            supabaseClient.from('plans').select('*'),
            supabaseClient.from('money').select('*'),
            supabaseClient.from('alarms').select('*'),
            supabaseClient.from('roadmaps').select('*'),
            supabaseClient.from('steps').select('*'),
            supabaseClient.from('academic').select('*'),
            supabaseClient.from('accounts').select('*'),
            supabaseClient.from('expenses').select('*'),
            supabaseClient.from('notes').select('*'),
            supabaseClient.from('sleep_logs').select('*'),
            supabaseClient.from('attendance_routines').select('*'),
            supabaseClient.from('attendance_logs').select('*'),
            supabaseClient.from('links').select('*'),
            supabaseClient.from('cover_templates').select('*')
        ]);

        if (rTasks.error?.status === 401 || rCounters.error?.status === 401) { document.getElementById('authModal').style.display = 'flex'; return; }

        if (rTasks.data) STATE.tasks = rTasks.data.map(t => ({ ...t, id: Number(t.task_id || t.id), due: t.due_date || t.due }));
        if (rCounters.data) STATE.counters = rCounters.data.map(c => ({ ...c, id: Number(c.id), lastUpdated: c.last_updated || c.lastUpdated || c.created_at || c.createdAt || new Date().toISOString() }));
        if (rPlans.data) STATE.plans = rPlans.data.map(p => ({ ...p, id: Number(p.id) }));
        if (rMoney.data) STATE.money = rMoney.data.map(m => ({ ...m, id: Number(m.id) }));
        if (rAlarms.data) STATE.alarms = rAlarms.data.map(a => ({ ...a, id: Number(a.id) }));
        if (rRoadmaps.data) STATE.roadmaps = rRoadmaps.data.map(r => ({ ...r, id: Number(r.id) }));
        if (rSteps.data) STATE.steps = rSteps.data.map(s => ({ ...s, id: Number(s.id), roadmapId: Number(s.roadmap_id || s.roadmapId) }));
        if (rAcademic.data) STATE.academic = rAcademic.data.map(a => ({ ...a, id: Number(a.id) }));
        if (rAccounts.data) STATE.accounts = rAccounts.data.map(a => ({ ...a, id: Number(a.id) }));
        if (rExpenses.data) STATE.expenses = rExpenses.data.map(e => ({ ...e, id: Number(e.id), accountId: Number(e.account_id || e.accountId) }));
        if (rNotes.data) STATE.notes = rNotes.data.map(n => {
            let parsedChecklist = n.checklist;
            if (typeof parsedChecklist === 'string') { try { parsedChecklist = JSON.parse(parsedChecklist); } catch (e) { parsedChecklist = null; } }

            let parsedTags = n.tags;
            if (typeof parsedTags === 'string') { try { parsedTags = JSON.parse(parsedTags); } catch (e) { parsedTags = []; } }

            let parsedWb = n.wb_data;
            if (typeof parsedWb === 'string') { try { parsedWb = JSON.parse(parsedWb); } catch (e) { parsedWb = null; } }

            return {
                ...n,
                id: Number(n.id),
                updatedAt: n.updated_at || n.updatedAt,
                tags: parsedTags || [],
                checklist: Array.isArray(parsedChecklist) ? parsedChecklist : null,
                isWhiteboard: n.is_whiteboard || false,
                wbData: parsedWb
            };
        });
        if (rSleep.data) STATE.sleepLogs = rSleep.data.map(s => ({ ...s, id: Number(s.id), wake: s.wake_time || s.wake, durationMins: s.duration_mins || s.durationMins }));
        if (rLinks && rLinks.data) STATE.links = rLinks.data.map(l => ({ ...l, id: Number(l.id) }));
        if (rCover && rCover.data) STATE.coverTemplates = rCover.data.map(c => ({ ...c, id: Number(c.id), bgData: c.bg_data || c.bgData }));
        if (rAttRoutines && rAttRoutines.data) STATE.attendanceRoutines = rAttRoutines.data.map(r => ({ ...r, id: Number(r.id), dayOfWeek: r.day_of_week !== undefined ? r.day_of_week : r.dayOfWeek, startTime: r.start_time || r.startTime || r.time, endTime: r.end_time || r.endTime || r.time }));
        if (rAttLogs && rAttLogs.data) STATE.attendanceLogs = rAttLogs.data.map(l => ({ ...l, id: Number(l.id), routineId: Number(l.routine_id || l.routineId) }));

        save();
        renderAll();
        loadVault();
        if (typeof updateGreeting === 'function') updateGreeting();
        if ((STATE.syncQueue || []).length > 0) showSyncBadge(); else hideSyncBadge();
    } catch (err) {
        console.log('Offline mode — using cached data', err);
        renderAll();
        if ((STATE.syncQueue || []).length > 0) showSyncBadge();
    }
}

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    const today = new Date(); const todayStr = fmtDate(today);
    const cachedData = localStorage.getItem('proflow_state');
    if (cachedData) {
        try {
            Object.assign(STATE, JSON.parse(cachedData));
            STATE.selectedDate = todayStr; STATE.attSelectedDate = todayStr;
            if (typeof calCurrentDate !== 'undefined') calCurrentDate = new Date(today);
            if (typeof attCurrentDate !== 'undefined') attCurrentDate = new Date(today);
            renderAll();
        } catch (e) { }
    }

    setTimeout(() => {
        document.getElementById('splash').style.opacity = '0';
        setTimeout(() => { document.getElementById('splash').style.display = 'none'; document.getElementById('app').style.display = 'flex'; }, 500);

        processSyncQueue().then(load).then(rescheduleAllReminders);
        STATE.selectedDate = todayStr; STATE.attSelectedDate = todayStr;
        if (typeof calCurrentDate !== 'undefined') calCurrentDate = new Date(today);
        if (typeof attCurrentDate !== 'undefined') attCurrentDate = new Date(today);

        document.getElementById('planDate').value = STATE.selectedDate;
        document.getElementById('planTime').value = `${String(today.getHours()).padStart(2, '0')}:00`;
        document.getElementById('taskDue').value = todayStr;

        updateGreeting(); renderCalendar(); if (typeof renderAttCalendar === 'function') renderAttCalendar();
        renderAll(); setupAlarmTicks(); rescheduleAllReminders();
    }, 1400);
});

function renderAll() {
    // THIS is the line that was missing! It forces the navbar to draw immediately on boot.
    if (typeof renderNavbar === 'function') renderNavbar();

    renderTasks(); renderPlanner(); renderCounters(); renderMoney(); renderAlarms(); renderRoadmaps();
    renderAttendance(); renderAcademic(); renderDashboard(); renderVault(); renderNotes(); renderSleep();
    if (typeof renderLinks === 'function') renderLinks();
    if (typeof renderDailyReminders === 'function') renderDailyReminders();
    renderAttCalendar(); initColorPickers();
}

// ============================================================
// UI ROUTING & ANDROID BACK GESTURE ENGINE
// ============================================================
function navTo(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById('screen-' + screen);
    if (targetScreen) targetScreen.classList.add('active');

    currentScreen = screen;

    // Call the new render function so the bottom bar highlights correctly
    renderNavbar();

    if (screen === 'roadmap') {
        const rList = document.getElementById('roadmapList-view');
        const rDetail = document.getElementById('roadmapDetail-view');
        if (rList) rList.style.display = 'block';
        if (rDetail) rDetail.style.display = 'none';
        STATE.activeRoadmap = null;
    }
    if (screen !== 'expenses') {
        STATE.activeAccountId = null;
        const dv = document.getElementById('transactionDetailView');
        if (dv) dv.style.display = 'none';
    }

    if (screen === 'dash') renderDashboard();
    if (screen === 'expenses') renderExpenses();
    if (screen === 'notes') renderNotes();
    if (screen === 'sleep') renderSleep();
    if (screen === 'links') renderLinks();
    if (screen.startsWith('settings')) {
        if (typeof renderNavSettings === 'function') renderNavSettings();
        if (typeof renderDashSettings === 'function') renderDashSettings();
        if (typeof renderDailyReminders === 'function') renderDailyReminders();
    }
    if (screen === 'tasks') { setTaskFilter('active'); }
    if (screen === 'attendance') { STATE.attSelectedDate = fmtDate(new Date()); attCurrentDate = new Date(); renderAttCalendar(); renderAttendance(); }

    const fab = document.querySelector('.fab');
    if (fab) fab.style.display = (screen === 'vault' || screen === 'expenses' || screen === 'notes' || screen.startsWith('settings') || screen === 'standby') ? 'none' : 'flex';
    if (screen === 'settings' && typeof renderSettingsSyncQueue === 'function') renderSettingsSyncQueue();
}

function handleAndroidBack() {
    try {
        // 0. Check Side Navigation Drawer
        const sideDrawer = document.getElementById('sideNavDrawer');
        if (sideDrawer && sideDrawer.classList.contains('open')) {
            closeSideNav();
            return 'handled';
        }

        // 1. Check Standby Mode (Zen Clock)
        const standbyEl = document.getElementById('zenStandby');
        if (standbyEl && standbyEl.style.display === 'flex') {
            exitStandby();
            return 'handled';
        }

        // 2. Check open Modals / Overlays
        const openModals = Array.from(document.querySelectorAll('.modal-overlay.open, .modal.open'));
        if (openModals.length > 0) {
            const topModal = openModals[openModals.length - 1];
            if (topModal.id) {
                closeModal(topModal.id);
            } else {
                topModal.classList.remove('open');
            }
            return 'handled';
        }

        // 3. Check Vault sub-folder navigation
        if (typeof currentVaultFolderId !== 'undefined' && currentVaultFolderId !== null) {
            navigateVaultFolder(null);
            return 'handled';
        }

        // 4. Check Money transaction detail view
        const txDetail = document.getElementById('transactionDetailView');
        if (txDetail && txDetail.style.display === 'block') {
            txDetail.style.display = 'none';
            if (typeof STATE !== 'undefined') STATE.activeAccountId = null;
            if (typeof renderExpenses === 'function') renderExpenses();
            return 'handled';
        }

        // 5. Check Roadmap detail view
        const rmDetail = document.getElementById('roadmapDetail-view');
        if (rmDetail && rmDetail.style.display === 'block') {
            const rmList = document.getElementById('roadmapList-view');
            if (rmList) rmList.style.display = 'block';
            rmDetail.style.display = 'none';
            if (typeof STATE !== 'undefined') STATE.activeRoadmap = null;
            return 'handled';
        }

        // 6. Check Active Screen (If on Settings sub-screen, return to main Settings menu)
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && activeScreen.id.startsWith('screen-settings-')) {
            navTo('settings');
            return 'handled';
        }
        if (activeScreen && activeScreen.id !== 'screen-dash') {
            navTo('dash');
            return 'handled';
        }

        // 7. Already at Home Dashboard with no overlays open -> Exit app
        return 'exit';
    } catch (e) {
        console.error('Error in handleAndroidBack:', e);
        return 'exit';
    }
}

function handleFabClick() {
    if (currentScreen === 'tasks') openTaskModal();
    else if (currentScreen === 'planner') openPlannerModal();
    else if (currentScreen === 'counter') openCounterModal();
    else if (currentScreen === 'money') openMoneyModal();
    else if (currentScreen === 'alarms') openAlarmModal();
    else if (currentScreen === 'roadmap') openRoadmapModal();
    else if (currentScreen === 'attendance') openAttRoutineModal();
    else if (currentScreen === 'academic') openAcademicModal();
    else if (currentScreen === 'notes') openNoteModal();
    else if (currentScreen === 'expenses') openTransactionModal();
    else if (currentScreen === 'sleep') openSleepModal();
    else if (currentScreen === 'vault') document.getElementById('fileInput')?.click();
    else if (currentScreen === 'links') openLinkModal();
    else openTaskModal();
}

async function updateAuthButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;

    try {
        const { data } = await supabaseClient.auth.getSession();
        const session = data?.session;
        if (session && session.user) {
            logoutBtn.textContent = 'Log Out';
            logoutBtn.style.background = 'rgba(245, 100, 124, 0.15)';
            logoutBtn.style.color = 'var(--red)';
            logoutBtn.onclick = logoutUser;
        } else {
            logoutBtn.textContent = 'Log In';
            logoutBtn.style.background = 'rgba(93, 232, 193, 0.15)';
            logoutBtn.style.color = 'var(--green)';
            logoutBtn.onclick = openAuthModal;
        }
    } catch (e) {
        logoutBtn.textContent = 'Log In';
        logoutBtn.onclick = openAuthModal;
    }
}

function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'flex';
        if (typeof switchAuthTab === 'function') switchAuthTab('login');
    }
}

function updateGreeting() {
    const now = new Date();
    const h = now.getHours();
    const dayName = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
    const dayOfWeek = now.getDay();

    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateFormatted = `${dayName} - ${dd}-${mm}-${yyyy}`;

    let greetingText = '';
    let subText = '';

    if (h >= 0 && h < 5) {
        greetingText = 'Working Late? 🌙';
        subText = "don't stay up too late, rest is important! 😴";
    } else if (h >= 5 && h < 12) {
        greetingText = 'Good Morning 👋';
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
            subText = 'enjoy holiday, make good use of free time';
        } else {
            subText = 'make today count and stay focused!';
        }
    } else if (h >= 12 && h < 17) {
        greetingText = 'Good Afternoon ☀️';
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
            subText = 'enjoy holiday, make good use of free time';
        } else {
            subText = 'keep up the great momentum!';
        }
    } else if (h >= 17 && h < 21) {
        greetingText = 'Good Evening 🌆';
        subText = 'unwind and reflect on your progress';
    } else {
        greetingText = 'Good Night 🌌';
        subText = 'time to wrap up and prepare for rest';
    }

    const greetingEl = document.getElementById('greeting');
    const dateEl = document.getElementById('greetingDate');
    const subEl = document.getElementById('greetingSub');

    if (greetingEl) greetingEl.textContent = greetingText;
    if (dateEl) dateEl.textContent = dateFormatted;
    if (subEl) subEl.textContent = subText;

    updateAuthButton();
}

// ============================================================
// DASHBOARD WIDGET ENGINE
// ============================================================
function renderDashboard() {
    const today = new Date();
    const todayStr = fmtDate(today);
    const zone = document.getElementById('dashWidgetZone');
    if (!zone) return;

    // FIX 1: Removed the "length === 0" reset. An empty dashboard is now perfectly allowed!
    if (!STATE.dashWidgets) STATE.dashWidgets = ['pending_tasks', 'todays_events', 'net_money', 'active_counters', 'redzone', 'schedule', 'classes', 'tasks'];
    if (!STATE.dashHiddenWidgets) STATE.dashHiddenWidgets = ['alarms', 'sleep', 'roadmap', 'specific_account', 'specific_counter', 'specific_note'];
    if (!STATE.dashConfig) STATE.dashConfig = { accountId: null, counterId: null, noteId: null };

    // FIX 2: Migrate old save data cleanly, preserve exact order, and permanently save it.
    let migrated = false;
    const defaultMini = ['pending_tasks', 'todays_events', 'net_money', 'active_counters'];
    [...defaultMini].reverse().forEach(w => {
        if (!STATE.dashWidgets.includes(w) && !STATE.dashHiddenWidgets.includes(w)) {
            STATE.dashWidgets.unshift(w);
            migrated = true;
        }
    });

    if (!STATE.dashWidgets.includes('sleep_full') && !STATE.dashHiddenWidgets.includes('sleep_full')) {
        STATE.dashWidgets.push('sleep_full');
        migrated = true;
    }

    if (migrated) save();

    let html = '';
    let halfBuffer = [];

    // Helper to group mini widgets side-by-side
    function flushHalf() {
        if (halfBuffer.length > 0) {
            html += `<div class="stats-grid" style="margin-bottom:12px;">${halfBuffer.join('')}</div>`;
            halfBuffer = [];
        }
    }

    STATE.dashWidgets.forEach(widget => {
        const isHalf = ['pending_tasks', 'todays_events', 'net_money', 'active_counters', 'alarms', 'sleep', 'roadmap', 'specific_account', 'specific_counter', 'specific_note'].includes(widget);
        let wHtml = '';

        try {
            switch (widget) {
                /* ------------------ MINI WIDGETS ------------------ */
                case 'pending_tasks': {
                    const activeTasks = STATE.tasks.filter(t => !t.completed).length;
                    wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('tasks')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">✅</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Pending Tasks</span></div><div class="stat-num">${activeTasks}</div></div>`;
                    break;
                }
                case 'todays_events': {
                    wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('planner')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">📅</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Today's Events</span></div><div class="stat-num">${STATE.plans.filter(p => isEventOnDate(p, todayStr)).length}</div></div>`;
                    break;
                }
                case 'net_money': {
                    const lentTotal = STATE.money.filter(m => m.type === 'lent' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0);
                    const owedTotal = STATE.money.filter(m => m.type === 'borrowed' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0);
                    const netMoney = lentTotal - owedTotal;
                    const netColor = netMoney >= 0 ? 'var(--green)' : 'var(--red)';
                    wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('money')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">💰</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Net Money</span></div><div class="stat-num" style="color:${netColor}">${netMoney >= 0 ? '+' : '-'}${Math.abs(netMoney).toFixed(0)}</div></div>`;
                    break;
                }
                case 'active_counters': {
                    wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('counter')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">🔢</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Active Counters</span></div><div class="stat-num">${STATE.counters.length}</div></div>`;
                    break;
                }
                case 'alarms': {
                    const activeAlarms = STATE.alarms.filter(a => a.enabled && a.time).sort((a, b) => a.time > b.time ? 1 : -1);
                    if (activeAlarms.length === 0) wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('alarms')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">⏰</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Next Alarm</span></div><div class="stat-num" style="font-size:20px; padding:4px 0;">Off</div></div>`;
                    else wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('alarms')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">⏰</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(activeAlarms[0].label || 'Next Alarm')}</span></div><div class="stat-num" style="font-size:22px; padding:2px 0;">${formatTime(activeAlarms[0].time)}</div></div>`;
                    break;
                }
                case 'sleep': {
                    if (STATE.sleepLogs.length === 0) wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('sleep')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">😴</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Last Night</span></div><div class="stat-num" style="font-size:20px; padding:4px 0;">No Data</div></div>`;
                    else {
                        const latest = [...STATE.sleepLogs].sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop();
                        wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('sleep')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">😴</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Last Night</span></div><div class="stat-num" style="color:var(--accent2);">${(latest.durationMins / 60).toFixed(1)}h</div></div>`;
                    }
                    break;
                }
                case 'roadmap': {
                    if (STATE.roadmaps.length === 0) wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('roadmap')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">🗺️</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Active Roadmap</span></div><div class="stat-num" style="font-size:20px; padding:4px 0;">None</div></div>`;
                    else {
                        let bestR = STATE.roadmaps[0]; let bestPct = -1;
                        STATE.roadmaps.forEach(r => {
                            const steps = STATE.steps.filter(s => s.roadmapId === r.id);
                            const done = steps.filter(s => s.completed).length;
                            const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                            if (pct > bestPct && pct < 100) { bestPct = pct; bestR = r; }
                        });
                        if (bestPct === -1) { bestR = STATE.roadmaps[0]; bestPct = STATE.steps.filter(s => s.roadmapId === bestR.id && s.completed).length / (STATE.steps.filter(s => s.roadmapId === bestR.id).length || 1) * 100; }
                        wHtml = `<div class="stat-card" style="cursor:pointer;" onclick="navTo('roadmap')"><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">🗺️</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(bestR.title)}</span></div><div class="stat-num" style="font-size:24px; padding:2px 0;">${bestPct.toFixed(0)}%</div></div>`;
                    }
                    break;
                }
                case 'specific_account': {
                    if (!STATE.dashConfig.accountId) wHtml = `<div class="stat-card"><div class="stat-icon">💳</div><select class="input" style="padding:4px; font-size:11px; margin-top:4px;" onchange="STATE.dashConfig.accountId = this.value; save(); renderDashboard();"><option value="">Select Account</option>${STATE.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select></div>`;
                    else {
                        const acc = STATE.accounts.find(a => a.id == STATE.dashConfig.accountId);
                        if (!acc) wHtml = `<div class="stat-card"><div class="stat-icon">💳</div><div class="stat-num" style="font-size:16px; padding:8px 0; color:var(--red);">Deleted</div><div class="stat-label" onclick="STATE.dashConfig.accountId = null; save(); renderDashboard();" style="cursor:pointer; text-decoration:underline;">Reset</div></div>`;
                        else {
                            const bal = typeof getAccountBalance === 'function' ? getAccountBalance(acc.id) : 0;
                            wHtml = `<div class="stat-card" style="position:relative; cursor:pointer;" onclick="navTo('expenses')"><span style="position:absolute; top:8px; right:8px; font-size:10px; opacity:0.5; cursor:pointer;" onclick="event.stopPropagation(); STATE.dashConfig.accountId = null; save(); renderDashboard();">⚙️</span><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px;">💳</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(acc.name)}</span></div><div class="stat-num" style="font-size:20px; padding:4px 0; color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};">${bal.toFixed(0)}</div></div>`;
                        }
                    }
                    break;
                }
                case 'specific_counter': {
                    if (!STATE.dashConfig.counterId) wHtml = `<div class="stat-card"><div class="stat-icon">🔢</div><select class="input" style="padding:4px; font-size:11px; margin-top:4px;" onchange="STATE.dashConfig.counterId = this.value; save(); renderDashboard();"><option value="">Select Counter</option>${STATE.counters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>`;
                    else {
                        const c = STATE.counters.find(x => x.id == STATE.dashConfig.counterId);
                        if (!c) wHtml = `<div class="stat-card"><div class="stat-icon">🔢</div><div class="stat-num" style="font-size:16px; padding:8px 0; color:var(--red);">Deleted</div><div class="stat-label" onclick="STATE.dashConfig.counterId = null; save(); renderDashboard();" style="cursor:pointer; text-decoration:underline;">Reset</div></div>`;
                        else {
                            wHtml = `<div class="stat-card" style="position:relative; cursor:pointer;" onclick="navTo('counter')"><span style="position:absolute; top:8px; right:8px; font-size:10px; opacity:0.5; cursor:pointer;" onclick="event.stopPropagation(); STATE.dashConfig.counterId = null; save(); renderDashboard();">⚙️</span><div style="display:flex; align-items:center; justify-content:flex-start; gap:6px; margin-bottom:4px;"><span style="font-size:16px; color:${c.color};">🔢</span><span style="font-size:11px; font-weight:700; color:var(--text2); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(c.name)}</span></div><div class="stat-num" style="font-size:24px; padding:2px 0;">${c.value}</div><div style="display:flex; justify-content:center; gap:4px; margin-top:4px;"><button class="btn-secondary" style="padding:2px 8px; font-size:12px;" onclick="event.stopPropagation(); adjustCounter(${c.id},-1); setTimeout(renderDashboard, 50)">-</button><button class="btn-secondary" style="padding:2px 8px; font-size:12px;" onclick="event.stopPropagation(); adjustCounter(${c.id},1); setTimeout(renderDashboard, 50)">+</button></div></div>`;
                        }
                    }
                    break;
                }
                case 'specific_note': {
                    if (!STATE.dashConfig.noteId) wHtml = `<div class="stat-card"><div class="stat-icon">📝</div><select class="input" style="padding:4px; font-size:11px; margin-top:4px;" onchange="STATE.dashConfig.noteId = this.value; save(); renderDashboard();"><option value="">Select Note</option>${STATE.notes.map(n => `<option value="${n.id}">${n.title || 'Untitled'}</option>`).join('')}</select></div>`;
                    else {
                        const n = STATE.notes.find(x => x.id == STATE.dashConfig.noteId);
                        if (!n) wHtml = `<div class="stat-card"><div class="stat-icon">📝</div><div class="stat-num" style="font-size:16px; padding:8px 0; color:var(--red);">Deleted</div><div class="stat-label" onclick="STATE.dashConfig.noteId = null; save(); renderDashboard();" style="cursor:pointer; text-decoration:underline;">Reset</div></div>`;
                        else {
                            let rawText = n.body || '';
                            if (n.checklist && Array.isArray(n.checklist)) {
                                rawText = n.checklist.map(c => c.text).join('\n');
                            }
                            const preview = escapeHtml(rawText).substring(0, 40) + (rawText.length > 40 ? '...' : '');
                            wHtml = `<div class="stat-card" style="position:relative; text-align:left; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" onclick="navTo('notes')"><span style="position:absolute; top:8px; right:8px; font-size:10px; opacity:0.5; cursor:pointer;" onclick="event.stopPropagation(); STATE.dashConfig.noteId = null; save(); renderDashboard();">⚙️</span><div style="font-size:11px; color:var(--text2); text-transform:uppercase; margin-bottom:4px; font-weight:700;">📝 ${escapeHtml(n.title || 'Note')}</div><div style="font-size:11px; line-height:1.4; color:var(--text); white-space:pre-wrap;">${preview}</div></div>`;
                        }
                    }
                    break;
                }

                /* ------------------ FULL WIDGETS ------------------ */
                case 'redzone': {
                    let uHtml = `<div class="card" style="margin-bottom:12px; cursor:pointer;" onclick="navTo('tasks')"><div class="section-header" style="margin-bottom:10px;"><div class="section-title" style="color:var(--red);">🚨 Urgent Deadlines</div></div>`;
                    const limitDate = new Date(); limitDate.setDate(limitDate.getDate() + 3);
                    let urgents = [];
                    STATE.tasks.filter(t => !t.completed && t.due).forEach(t => { if (new Date(t.due) <= limitDate) urgents.push({ type: 'Task', title: t.title, date: t.due }); });
                    STATE.plans.filter(p => !p.completed && p.date).forEach(p => { if (new Date(p.date) <= limitDate && new Date(p.date) >= today) urgents.push({ type: 'Event', title: p.title, date: p.date }); });
                    STATE.academic.forEach(a => { if (a.date && new Date(a.date) <= limitDate && new Date(a.date) >= today) urgents.push({ type: 'Academic', title: a.subject + ' ' + (a.type || ''), date: a.date }); });
                    urgents.sort((a, b) => new Date(a.date) - new Date(b.date));
                    if (urgents.length === 0) uHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">No urgent deadlines in the next 3 days.</div>`;
                    else uHtml += urgents.map(u => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px;"><div><b>[${u.type}]</b> ${u.title}</div><div style="color:var(--red); font-size:11px;">${fmtDisplay(u.date)}</div></div>`).join('');
                    uHtml += `</div>`;
                    wHtml = uHtml;
                    break;
                }
                case 'schedule': {
                    let sHtml = `<div class="card" style="margin-bottom:12px; cursor:pointer;" onclick="navTo('planner')"><div class="section-header" style="margin-bottom:10px;"><div class="section-title">📅 Today's Schedule</div></div>`;
                    const todayPlans = STATE.plans.filter(p => isEventOnDate(p, todayStr) && p.time).sort((a, b) => a.time > b.time ? 1 : -1);
                    if (todayPlans.length === 0) sHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">Clear schedule today.</div>`;
                    else sHtml += `<div class="today-list">` + todayPlans.map(p => `<div class="today-item"><div class="today-dot" style="background:${p.color || 'var(--accent)'}"></div><div class="today-time">${formatTime(p.time)}</div><div class="today-text ${p.completed ? 'done' : ''}">${p.title}</div></div>`).join('') + `</div>`;
                    sHtml += `</div>`;
                    wHtml = sHtml;
                    break;
                }
                case 'tasks': {
                    let tHtml = `<div class="card" style="margin-bottom:12px; cursor:pointer;" onclick="navTo('tasks')"><div class="section-header" style="margin-bottom:10px;"><div class="section-title">📋 Upcoming Tasks</div></div>`;
                    const upcoming = STATE.tasks.filter(t => !t.completed).slice(0, 5);
                    if (upcoming.length === 0) tHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">All clear!</div>`;
                    else tHtml += upcoming.map(t => `<div class="task-item" style="margin-bottom:8px; cursor:default;"><div class="priority-dot p${t.priority}" style="margin-top:6px"></div><div class="task-body"><div class="task-title">${t.title}</div><div class="task-due">${t.category} ${t.due ? '· ' + fmtDisplay(t.due) : ''}</div></div></div>`).join('');
                    tHtml += `</div>`;
                    wHtml = tHtml;
                    break;
                }
                case 'classes': {
                    const currentHour = new Date().getHours();
                    const isAfter5PM = currentHour >= 17;
                    const targetDate = new Date();
                    if (isAfter5PM) { targetDate.setDate(targetDate.getDate() + 1); }
                    const dayOfWeek = targetDate.getDay();
                    const sectionTitleStr = isAfter5PM ? "🎓 Tomorrow's Classes" : "🎓 Today's Classes";

                    let cHtml = `<div class="card" style="margin-bottom:12px; cursor:pointer;" onclick="navTo('attendance')"><div class="section-header" style="margin-bottom:10px;"><div class="section-title">${sectionTitleStr}</div></div>`;
                    const targetClasses = STATE.attendanceRoutines.filter(r => parseInt(r.dayOfWeek) === dayOfWeek).sort((a, b) => (a.startTime || a.time) > (b.startTime || b.time) ? 1 : -1);
                    if (targetClasses.length === 0) cHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">${isAfter5PM ? 'No classes scheduled for tomorrow.' : 'No classes scheduled today.'}</div>`;
                    else cHtml += targetClasses.map(c => {
                        const stats = typeof calculateAttendanceStats === 'function' ? calculateAttendanceStats(c.id) : { pct: 0, attended: 0, missed: 0 };
                        const classTime = (c.startTime && c.endTime && c.startTime !== c.endTime)
                            ? `${formatTime(c.startTime)} - ${formatTime(c.endTime)}`
                            : (c.startTime || c.endTime || c.time ? formatTime(c.startTime || c.endTime || c.time) : 'N/A');
                        return `<div style="padding:10px; background:var(--surface2); border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:700; font-size:14px;">${c.subject}</div><div style="font-size:11px; color:var(--text2);">Room: ${c.room || 'N/A'} | ${classTime}</div></div><div style="font-size:16px; font-weight:800; color:${stats.pct >= 75 ? 'var(--green)' : 'var(--red)'}">${stats.pct.toFixed(0)}%</div></div>`;
                    }).join('');
                    cHtml += `</div>`;
                    wHtml = cHtml;
                    break;
                }
                case 'sleep_full': {
                    const sorted = [...STATE.sleepLogs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                    const last7 = sorted.slice(-7).map(e => ({
                        ...e,
                        hours: (e.durationMins || 0) / 60
                    }));

                    const avgHours = last7.length ? (last7.reduce((s, e) => s + e.hours, 0) / last7.length).toFixed(1) : '—';
                    const latest = sorted[sorted.length - 1];

                    const bedtimes = last7.map(e => e.bedtime).filter(Boolean);
                    const waketimes = last7.map(e => e.wake).filter(Boolean);
                    const avgBed = typeof getAvgTime === 'function' ? getAvgTime(bedtimes) : '—';
                    const avgWake = typeof getAvgTime === 'function' ? getAvgTime(waketimes) : '—';

                    let sFullHtml = `<div class="card" style="margin-bottom:12px; cursor:pointer;" onclick="navTo('sleep')">`;
                    sFullHtml += `<div class="section-header" style="margin-bottom:12px;"><div class="section-title" style="display:flex; align-items:center; gap:8px;"><span>😴</span> Sleep Tracker Overview</div><span style="font-size:12px; color:var(--accent); font-weight:700;">View Diary →</span></div>`;
                    sFullHtml += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;

                    sFullHtml += `
                        <div style="background:var(--surface2); padding:12px; border-radius:12px; border:1px solid var(--border);">
                            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; font-weight:700;">Last Night Sleep</div>
                            <div style="font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:var(--text); margin-top:2px;">${latest ? (latest.durationMins / 60).toFixed(1) + 'h' : '—'}</div>
                        </div>

                        <div style="background:var(--surface2); padding:12px; border-radius:12px; border:1px solid var(--border);">
                            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; font-weight:700;">Average Sleep</div>
                            <div style="font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:var(--accent2); margin-top:2px;">${avgHours}${avgHours !== '—' ? 'h' : ''}</div>
                        </div>

                        <div style="background:var(--surface2); padding:12px; border-radius:12px; border:1px solid var(--border);">
                            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; font-weight:700;">Average Bedtime</div>
                            <div style="font-size:14px; font-weight:800; color:var(--text); margin-top:4px;">🛏 ${avgBed}</div>
                        </div>

                        <div style="background:var(--surface2); padding:12px; border-radius:12px; border:1px solid var(--border);">
                            <div style="font-size:10px; color:var(--text3); text-transform:uppercase; font-weight:700;">Average Wakeup Time</div>
                            <div style="font-size:14px; font-weight:800; color:var(--text); margin-top:4px;">⏰ ${avgWake}</div>
                        </div>
                    `;

                    sFullHtml += `</div></div>`;
                    wHtml = sFullHtml;
                    break;
                }
            }
        } catch (e) {
            console.error("Widget crashed:", widget, e);
        }

        if (isHalf) {
            halfBuffer.push(wHtml);
        } else {
            flushHalf();
            html += wHtml;
        }
    });

    flushHalf();

    // FIX 3: Show a friendly message if the dashboard is intentionally empty!
    if (html === '') {
        html = '<div class="empty-state"><div class="empty-icon">✨</div><p>Your dashboard is clear.<br>Add widgets from Settings to customize this space.</p></div>';
    }

    zone.innerHTML = html;
}
// ============================================================
// DASHBOARD SETTINGS MENU GENERATOR
// ============================================================
function renderDashSettings() {
    const el = document.getElementById('dashSettingsList');
    if (!el) return;

    if (!STATE.dashWidgets) STATE.dashWidgets = ['pending_tasks', 'todays_events', 'net_money', 'active_counters', 'redzone', 'schedule', 'classes', 'tasks', 'sleep_full'];
    if (!STATE.dashHiddenWidgets) STATE.dashHiddenWidgets = ['alarms', 'sleep', 'roadmap', 'specific_account', 'specific_counter', 'specific_note'];

    if (!STATE.dashWidgets.includes('sleep_full') && !STATE.dashHiddenWidgets.includes('sleep_full')) {
        STATE.dashWidgets.push('sleep_full');
        save();
    }

    let html = '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--accent); margin-bottom:10px;">Active on Home Screen</div>';
    //... the rest of the function remains the same
    STATE.dashWidgets.forEach((key, index) => {
        const mod = WIDGET_DICT[key];
        if (!mod) return;

        html += `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface2); padding:10px 14px; margin-bottom:8px; border-radius:10px; border:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:20px;">${mod.icon}</span>
                <span style="font-size:14px; font-weight:600;">${mod.label}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-secondary" style="padding:6px 10px; font-size:14px;" onclick="moveDashWidget(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
                <button class="btn-secondary" style="padding:6px 10px; font-size:14px;" onclick="moveDashWidget(${index}, 1)" ${index === STATE.dashWidgets.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
                <button class="btn-secondary" style="padding:6px 12px; font-size:12px; color:var(--red);" onclick="toggleDashWidget('${key}')">Hide</button>
            </div>
        </div>`;
    });

    if (STATE.dashHiddenWidgets.length > 0) {
        html += '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text3); margin:20px 0 10px;">Available Widgets</div>';

        STATE.dashHiddenWidgets.forEach(key => {
            const mod = WIDGET_DICT[key];
            if (!mod) return;

            html += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface); opacity:0.6; padding:10px 14px; margin-bottom:8px; border-radius:10px; border:1px dashed var(--border);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:20px; filter:grayscale(1);">${mod.icon}</span>
                    <span style="font-size:14px; font-weight:600;">${mod.label}</span>
                </div>
                <button class="btn-secondary" style="padding:6px 16px; font-size:12px; color:var(--green); border-color:rgba(93,232,193,0.3);" onclick="toggleDashWidget('${key}')">+ Add</button>
            </div>`;
        });
    }

    el.innerHTML = html;
}

function moveDashWidget(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= STATE.dashWidgets.length) return;
    const temp = STATE.dashWidgets[index];
    STATE.dashWidgets[index] = STATE.dashWidgets[newIndex];
    STATE.dashWidgets[newIndex] = temp;
    save(); renderDashSettings(); renderDashboard();
}

function toggleDashWidget(key) {
    if (STATE.dashWidgets.includes(key)) {
        STATE.dashWidgets = STATE.dashWidgets.filter(k => k !== key);
        STATE.dashHiddenWidgets.push(key);
    } else {
        STATE.dashHiddenWidgets = STATE.dashHiddenWidgets.filter(k => k !== key);
        STATE.dashWidgets.push(key);
    }
    save(); renderDashSettings(); renderDashboard();
}

// ============================================================
// AUTH & THEME
// ============================================================
function switchAuthTab(tab) {
    document.getElementById('loginError').innerText = ''; document.getElementById('regError').innerText = '';
    if (tab === 'login') {
        document.getElementById('loginForm').style.display = 'block'; document.getElementById('registerForm').style.display = 'none';
        document.getElementById('tabLogin').classList.add('active'); document.getElementById('tabRegister').classList.remove('active');
    } else {
        document.getElementById('loginForm').style.display = 'none'; document.getElementById('registerForm').style.display = 'block';
        document.getElementById('tabLogin').classList.remove('active'); document.getElementById('tabRegister').classList.add('active');
    }
}

async function handleAuth(event, endpoint) {
    event.preventDefault(); const isLogin = endpoint === 'login.php';
    const username = document.getElementById(isLogin ? 'loginUsername' : 'regUsername').value;
    const password = document.getElementById(isLogin ? 'loginPassword' : 'regPassword').value;
    const errorId = isLogin ? 'loginError' : 'regError';
    try {
        if (isLogin) { const { data, error } = await supabaseClient.auth.signInWithPassword({ email: username.includes('@') ? username : username + "@lifeeasy.local", password: password }); if (error) throw error; }
        else { const { data, error } = await supabaseClient.auth.signUp({ email: username.includes('@') ? username : username + "@lifeeasy.local", password: password }); if (error) throw error; toast('Account created! Please log in.'); switchAuthTab('login'); return; }
        document.getElementById('authModal').style.display = 'none'; document.getElementById('loginPassword').value = ''; document.getElementById('regPassword').value = ''; load();
    } catch (err) { document.getElementById(errorId).innerText = err.message || 'Authentication failed.'; }
}

async function logoutUser() { try { await supabaseClient.auth.signOut(); document.getElementById('authModal').style.display = 'flex'; switchAuthTab('login'); } catch (e) { console.error('Logout error', e); } }

function toggleTheme(theme) {
    const root = document.documentElement; if (theme === 'auto') { localStorage.removeItem('theme'); root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } else { localStorage.setItem('theme', theme); root.setAttribute('data-theme', theme); }
    root.style.display = 'none'; root.offsetHeight; root.style.display = '';
}

function initTheme() { const t = localStorage.getItem('theme') || 'dark'; document.documentElement.setAttribute('data-theme', t); const sel = document.getElementById('themeSelect'); if (sel) sel.value = t; }

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { if (!localStorage.getItem('theme')) document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light'); });


// ============================================================
// PERSONAL VAULT & FILE PREVIEW ENGINE
// ============================================================
let activeMovingFileId = null;
let currentVaultFolderId = null;

if (!STATE.vaultFolders) STATE.vaultFolders = [];
if (!STATE.vaultFiles) STATE.vaultFiles = [];

async function loadVault() {
    try {
        const [rFolders, rFiles] = await Promise.all([
            supabaseClient.from('vault_folders').select('*'),
            supabaseClient.from('vault').select('*')
        ]);

        if (rFolders.data) STATE.vaultFolders = rFolders.data.map(f => ({ ...f, id: Number(f.id) }));
        if (rFiles.data) STATE.vaultFiles = rFiles.data.map(f => ({
            ...f,
            id: Number(f.id),
            filename: f.filename || f.name || 'File',
            filepath: f.filepath || f.url || '',
            folder_id: f.folder_id ? Number(f.folder_id) : null
        }));

        save();
        renderVault();
    } catch (e) {
        console.warn('Vault load fallback:', e);
        renderVault();
    }
}

function renderVault() {
    const foldersContainer = document.getElementById('vaultFolders');
    const filesContainer = document.getElementById('vaultFiles');
    const breadcrumb = document.getElementById('vaultBreadcrumb');
    if (!filesContainer || !foldersContainer) return;

    // 1. Breadcrumbs Path
    let crumbs = [{ id: null, name: '🏠 Root Directory' }];
    let currId = currentVaultFolderId;
    let pathList = [];
    while (currId) {
        const f = (STATE.vaultFolders || []).find(x => x.id == currId);
        if (f) {
            pathList.unshift(f);
            currId = f.parent_id;
        } else {
            break;
        }
    }
    crumbs = crumbs.concat(pathList);

    breadcrumb.innerHTML = crumbs.map((c, idx) => {
        const isLast = idx === crumbs.length - 1;
        if (isLast) {
            return `<span style="color:var(--text); font-weight:700;">${escapeHtml(c.name)}</span>`;
        }
        return `<span style="cursor:pointer; color:var(--accent);" onclick="navigateVaultFolder(${c.id})">${escapeHtml(c.name)}</span> <span style="color:var(--text3);">/</span> `;
    }).join('');

    // 2. Filter Subfolders
    const currentSubfolders = (STATE.vaultFolders || []).filter(f => {
        if (!currentVaultFolderId) return !f.parent_id || f.parent_id == 0;
        return f.parent_id == currentVaultFolderId;
    });

    if (currentSubfolders.length === 0) {
        foldersContainer.style.display = 'none';
        foldersContainer.innerHTML = '';
    } else {
        foldersContainer.style.display = 'grid';
        foldersContainer.innerHTML = currentSubfolders.map(f => {
            const count = (STATE.vaultFiles || []).filter(file => file.folder_id == f.id).length;
            const subCount = (STATE.vaultFolders || []).filter(sub => sub.parent_id == f.id).length;
            const subStr = subCount > 0 ? ` · ${subCount} folder${subCount !== 1 ? 's' : ''}` : '';
            return `
            <div onclick="navigateVaultFolder(${f.id})" style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px; cursor:pointer; position:relative; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="font-size:24px;">📁</div>
                    <span onclick="deleteVaultFolder(event, ${f.id})" style="color:var(--red); font-size:14px; cursor:pointer; padding:2px;" title="Delete Folder">🗑️</span>
                </div>
                <div style="font-weight:700; font-size:14px; margin-top:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.name)}</div>
                <div style="font-size:11px; color:var(--text3); margin-top:4px;">${count} file${count !== 1 ? 's' : ''}${subStr}</div>
            </div>`;
        }).join('');
    }

    // 3. Filter Files
    const activeFiles = (STATE.vaultFiles || []).filter(f => {
        if (!currentVaultFolderId) return !f.folder_id;
        return f.folder_id == currentVaultFolderId;
    });

    if (activeFiles.length === 0) {
        filesContainer.innerHTML = `<div class="empty-state" style="padding:20px 0;"><p style="font-size:13px; color:var(--text3);">No files in this location.</p></div>`;
        return;
    }

    // 4. Render Files
    filesContainer.innerHTML = activeFiles.map(f => {
        const ext = f.filename.split('.').pop().toLowerCase();
        let icon = '📄';
        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) icon = '🖼️';
        else if (ext === 'pdf') icon = '📕';
        else if (['ppt', 'pptx'].includes(ext)) icon = '📊';
        else if (['js', 'css', 'html', 'c', 'cpp', 'py', 'java', 'json', 'sql', 'ts'].includes(ext)) icon = '💻';
        else if (ext === 'txt' || ext === 'md') icon = '📝';

        return `
        <div class="card-sm" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:var(--surface);">
            <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0; cursor:pointer;" onclick="previewVaultFile('${escapeHtml(f.filename)}', '${f.filepath}')">
                <div style="font-size:22px;">${icon}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.filename)}</div>
                    <div style="font-size:10px; color:var(--text3); margin-top:2px;">${new Date(f.upload_date || Date.now()).toLocaleDateString()}</div>
                </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button onclick="previewVaultFile('${escapeHtml(f.filename)}', '${f.filepath}')" class="btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--accent2);">View</button>
                <button onclick="triggerVaultDownload('${escapeHtml(f.filename)}', '${f.filepath}')" class="btn-secondary" style="padding:4px 8px; font-size:11px;" title="Download File">⬇</button>
                <button onclick="openMoveModal(${f.id})" class="btn-secondary" style="padding:4px 8px; font-size:11px;" title="Move File">📂</button>
                <button onclick="deleteVaultFile(${f.id}, '${f.filepath}')" style="background:none; border:none; color:var(--red); font-size:15px; cursor:pointer; padding:4px;">🗑</button>
            </div>
        </div>`;
    }).join('');
}

function navigateVaultFolder(folderId) {
    currentVaultFolderId = folderId;
    renderVault();
}

function openCreateFolderModal() {
    document.getElementById('vaultFolderName').value = '';
    document.getElementById('vaultFolderModal').classList.add('open');
}

async function saveVaultFolder() {
    const name = document.getElementById('vaultFolderName').value.trim();
    if (!name) return toast('Please enter a folder name');

    const tempId = Date.now();
    const folderPayload = {
        name,
        parent_id: currentVaultFolderId || null
    };

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id || null;
        if (userId) folderPayload.user_id = userId;

        const { data, error } = await supabaseClient.from('vault_folders').insert([folderPayload]).select();
        if (error) throw error;

        if (data && data[0]) {
            STATE.vaultFolders.push(data[0]);
        } else {
            folderPayload.id = tempId;
            STATE.vaultFolders.push(folderPayload);
        }
        save();
        renderVault();
        closeModal('vaultFolderModal');
        toast('Folder created! 📁');
    } catch (err) {
        console.warn('Supabase folder creation fallback, saving locally:', err);
        folderPayload.id = tempId;
        STATE.vaultFolders.push(folderPayload);
        save();
        renderVault();
        closeModal('vaultFolderModal');
        toast('Folder created! 📁');
    }
}

async function deleteVaultFolder(e, folderId) {
    e.stopPropagation();
    if (!confirm('Delete this folder? Files inside will be moved to Root.')) return;

    try {
        await supabaseClient.from('vault').update({ folder_id: null }).eq('folder_id', folderId);
        await supabaseClient.from('vault_folders').delete().eq('id', folderId);

        STATE.vaultFiles.forEach(f => { if (f.folder_id == folderId) f.folder_id = null; });
        STATE.vaultFolders = STATE.vaultFolders.filter(f => f.id !== folderId);

        save();
        renderVault();
        toast('Folder deleted 🗑️');
    } catch (err) {
        console.error(err);
        toast('Failed to delete folder.');
    }
}

function openMoveModal(fileId) {
    activeMovingFileId = fileId;
    const select = document.getElementById('vaultMoveFolderSelect');
    select.innerHTML = '<option value="">🏠 Root (No Folder)</option>' +
        (STATE.vaultFolders || []).map(f => `<option value="${f.id}">📁 ${escapeHtml(f.name)}</option>`).join('');

    const file = STATE.vaultFiles.find(f => f.id == fileId);
    if (file && file.folder_id) select.value = file.folder_id;

    document.getElementById('vaultMoveModal').classList.add('open');
}

async function confirmMoveVaultFile() {
    if (!activeMovingFileId) return;
    const targetFolder = document.getElementById('vaultMoveFolderSelect').value || null;

    try {
        const { error } = await supabaseClient.from('vault').update({ folder_id: targetFolder }).eq('id', activeMovingFileId);
        if (error) throw error;

        const file = STATE.vaultFiles.find(f => f.id == activeMovingFileId);
        if (file) file.folder_id = targetFolder;

        save();
        renderVault();
        closeModal('vaultMoveModal');
        toast('File moved! 📂');
    } catch (err) {
        console.error(err);
        toast('Failed to move file.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    if (!dropZone) return;
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--green)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--accent)');
    dropZone.addEventListener('drop', async e => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
        const files = await getAllFilesFromDataTransfer(e.dataTransfer);
        if (files && files.length) uploadFile(files);
    });
    if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFile(fileInput.files); });
    if (folderInput) folderInput.addEventListener('change', () => { if (folderInput.files.length) uploadFile(folderInput.files); });
});

async function getAllFilesFromDataTransfer(dataTransfer) {
    const files = [];
    if (!dataTransfer) return files;
    const items = dataTransfer.items;
    if (!items || !items.length) {
        return Array.from(dataTransfer.files || []);
    }

    async function traverseEntry(item, path = '') {
        return new Promise((resolve) => {
            if (item.isFile) {
                item.file(file => {
                    files.push(file);
                    resolve();
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                dirReader.readEntries(async (entries) => {
                    for (let entry of entries) {
                        await traverseEntry(entry, path + item.name + '/');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    const promises = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (item) {
            promises.push(traverseEntry(item));
        } else if (items[i].kind === 'file') {
            const f = items[i].getAsFile();
            if (f) files.push(f);
        }
    }
    await Promise.all(promises);
    return files.length ? files : Array.from(dataTransfer.files || []);
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showVaultUploadProgress(fileName, fileIndex, totalFiles, percent, loadedBytes, totalBytes, statusMessage, isError = false) {
    const container = document.getElementById('vaultUploadProgressContainer');
    if (!container) return;

    container.style.display = 'block';

    const iconEl = document.getElementById('vaultUploadIcon');
    const nameEl = document.getElementById('vaultUploadFileName');
    const percentEl = document.getElementById('vaultUploadPercent');
    const barEl = document.getElementById('vaultUploadProgressBar');
    const statusEl = document.getElementById('vaultUploadStatusText');
    const countEl = document.getElementById('vaultUploadFileCount');

    if (nameEl) nameEl.textContent = fileName || 'Uploading file...';
    if (percentEl) percentEl.textContent = `${percent}%`;

    if (barEl) {
        barEl.style.width = `${percent}%`;
        if (isError) {
            barEl.style.background = 'var(--red)';
        } else if (percent === 100) {
            barEl.style.background = 'var(--green)';
        } else {
            barEl.style.background = 'linear-gradient(90deg, var(--accent), var(--accent2))';
        }
    }

    if (iconEl) {
        iconEl.textContent = isError ? '❌' : (percent === 100 ? '✅' : '⏳');
    }

    if (countEl) {
        countEl.textContent = totalFiles > 1 ? `File ${fileIndex} of ${totalFiles}` : (loadedBytes && totalBytes ? `${formatFileSize(loadedBytes)} / ${formatFileSize(totalBytes)}` : '1 file');
    }

    if (statusEl) {
        statusEl.textContent = statusMessage || (percent === 100 ? 'Saving file details...' : `Uploading (${percent}%)...`);
        statusEl.style.color = isError ? 'var(--red)' : 'var(--text3)';
    }
}

function hideVaultUploadProgress(delay = 1500) {
    setTimeout(() => {
        const container = document.getElementById('vaultUploadProgressContainer');
        if (container) {
            container.style.display = 'none';
            const barEl = document.getElementById('vaultUploadProgressBar');
            if (barEl) barEl.style.width = '0%';
        }
    }, delay);
}

async function uploadVaultFileWithProgress(file, generatedName, onProgress) {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token || supabaseAnonKey;
    const url = `${supabaseUrl}/storage/v1/object/vault/${encodeURIComponent(generatedName)}`;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', supabaseAnonKey);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        if (xhr.upload) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent, e.loaded, e.total);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const res = JSON.parse(xhr.responseText);
                    resolve(res);
                } catch (e) {
                    resolve({ Key: generatedName });
                }
            } else {
                reject(new Error(`Storage Upload Failed (${xhr.status}): ${xhr.responseText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));

        xhr.send(file);
    });
}

async function uploadFile(files) {
    if (!files || !files.length) return;
    const dz = document.getElementById('dropZone');
    if (dz) dz.style.borderColor = 'var(--accent2)';

    const totalFiles = files.length;

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id || null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = file.name.split('.').pop();
            const generatedName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            showVaultUploadProgress(
                file.name,
                i + 1,
                totalFiles,
                0,
                0,
                file.size,
                `Uploading ${file.name}...`
            );

            try {
                await uploadVaultFileWithProgress(file, generatedName, (percent, loaded, total) => {
                    showVaultUploadProgress(
                        file.name,
                        i + 1,
                        totalFiles,
                        percent,
                        loaded,
                        total,
                        `Uploading... (${percent}%)`
                    );
                });
            } catch (xhrErr) {
                console.warn('XHR Upload failed, falling back to SDK upload:', xhrErr);
                const { data: sData, error: sErr } = await supabaseClient.storage.from('vault').upload(generatedName, file);
                if (sErr) throw sErr;
            }

            showVaultUploadProgress(
                file.name,
                i + 1,
                totalFiles,
                100,
                file.size,
                file.size,
                'Saving to Vault database...'
            );

            const { data: urlObj } = supabaseClient.storage.from('vault').getPublicUrl(generatedName);

            const payload = {
                user_id: userId,
                filename: file.name,
                filepath: urlObj.publicUrl,
                folder_id: currentVaultFolderId || null
            };

            const { data: tData, error: tErr } = await supabaseClient.from('vault').insert([payload]).select();
            if (tErr) throw tErr;

            if (tData && tData[0]) STATE.vaultFiles.unshift(tData[0]);
        }

        save();
        if (dz) dz.style.borderColor = 'var(--accent)';
        showVaultUploadProgress(
            'Upload Complete!',
            totalFiles,
            totalFiles,
            100,
            0,
            0,
            `Successfully uploaded ${totalFiles} file${totalFiles > 1 ? 's' : ''}! 🎉`
        );
        toast('Uploaded & Saved to Vault! 🔒');
        renderVault();
        hideVaultUploadProgress(2000);
    } catch (err) {
        if (dz) dz.style.borderColor = 'var(--accent)';
        console.error('Upload Error:', err);
        showVaultUploadProgress(
            'Upload Failed',
            1,
            totalFiles,
            0,
            0,
            0,
            `Error: ${err.message || err}`,
            true
        );
        toast('Upload failed ❌');
        hideVaultUploadProgress(4000);
    }
}

async function deleteVaultFile(id, filepath) {
    if (!confirm('Delete this file?')) return;
    try {
        const pathParts = filepath.split('/storage/v1/object/public/vault/');
        if (pathParts.length > 1) {
            await supabaseClient.storage.from('vault').remove([pathParts[1]]);
        }
        await supabaseClient.from('vault').delete().eq('id', id);
        STATE.vaultFiles = (STATE.vaultFiles || []).filter(f => f.id !== id);
        save();
        renderVault();
        toast('File deleted 🗑️');
    } catch (err) {
        console.error(err);
        toast('Failed to delete file.');
    }
}

async function triggerVaultDownload(filename, url) {
    toast(`Preparing download for ${filename}... ⏳`);

    if (window.AndroidInterface && typeof window.AndroidInterface.downloadFile === 'function') {
        try {
            window.AndroidInterface.downloadFile(url, filename);
            return;
        } catch (e) {
            console.warn('Native downloadFile failed, using blob fallback:', e);
        }
    }

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const blob = await res.blob();

        if (window.AndroidInterface && typeof window.AndroidInterface.downloadBase64File === 'function') {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result;
                window.AndroidInterface.downloadBase64File(base64data, filename, blob.type || 'application/octet-stream');
            };
            reader.readAsDataURL(blob);
            return;
        }

        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'downloaded_file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        toast(`Downloaded ${filename}! 📥`);
    } catch (e) {
        console.warn('Blob download failed, opening URL:', e);
        window.open(url, '_blank');
    }
}

async function previewVaultFile(filename, url) {
    const ext = filename.split('.').pop().toLowerCase();
    const titleEl = document.getElementById('vaultViewerTitle');
    const bodyEl = document.getElementById('vaultViewerBody');
    const downloadBtn = document.getElementById('vaultViewerDownloadBtn');

    if (titleEl) titleEl.textContent = filename;
    if (downloadBtn) {
        downloadBtn.onclick = (e) => {
            e.preventDefault();
            triggerVaultDownload(filename, url);
        };
    }

    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'];
    const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
    const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
    const codeExtensions = [
        'txt', 'js', 'css', 'html', 'json', 'c', 'cpp', 'h', 'hpp',
        'py', 'java', 'sql', 'md', 'xml', 'sh', 'bat', 'php', 'ts', 'jsx', 'tsx', 'csv'
    ];

    if (imageExts.includes(ext)) {
        bodyEl.innerHTML = `<img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px;" alt="${escapeHtml(filename)}">`;
    } else if (videoExts.includes(ext)) {
        bodyEl.innerHTML = `<video src="${url}" controls autoplay style="max-width:100%; max-height:100%; border-radius:8px; outline:none;"></video>`;
    } else if (audioExts.includes(ext)) {
        bodyEl.innerHTML = `<div style="text-align:center; padding:30px; background:var(--surface); border-radius:16px; border:1px solid var(--border);"><div style="font-size:52px; margin-bottom:16px;">🎵</div><div style="font-weight:700; font-size:15px; margin-bottom:12px;">${escapeHtml(filename)}</div><audio src="${url}" controls autoplay style="width:100%; min-width:280px;"></audio></div>`;
    } else if (ext === 'pdf') {
        const gDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        bodyEl.innerHTML = `<iframe src="${gDocsUrl}" style="width:100%; height:100%; border:none; background:#fff;" title="${escapeHtml(filename)}"></iframe>`;
    } else if (officeExts.includes(ext)) {
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
        bodyEl.innerHTML = `<iframe src="${officeViewerUrl}" style="width:100%; height:100%; border:none; background:#fff;" title="${escapeHtml(filename)}"></iframe>`;
    } else if (codeExtensions.includes(ext)) {
        bodyEl.innerHTML = `<div style="color:var(--text2); font-size:13px;">Loading text content... ⏳</div>`;
        document.getElementById('vaultViewerModal').classList.add('open');

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Could not read file.');
            const fileContent = await res.text();

            bodyEl.innerHTML = `
                <div style="width:100%; height:100%; overflow:auto; background:#181824; padding:20px; text-align:left;">
                    <pre style="margin:0; font-family:'Courier New', Consolas, monospace; font-size:13px; line-height:1.6; color:#5de8c1; white-space:pre; overflow-x:auto;"><code>${escapeHtml(fileContent)}</code></pre>
                </div>
            `;
        } catch (err) {
            bodyEl.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <p style="font-size:13px; color:var(--red); margin-bottom:12px;">Failed to load file text.</p>
                    <button onclick="triggerVaultDownload('${escapeHtml(filename)}', '${url}')" class="btn-primary" style="padding:8px 16px;">⬇ Download File</button>
                </div>`;
        }
        return;
    } else {
        bodyEl.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <p style="font-size:14px; margin-bottom:12px;">No live preview for <strong>.${ext}</strong> files.</p>
                <button onclick="triggerVaultDownload('${escapeHtml(filename)}', '${url}')" class="btn-primary" style="padding:10px 20px;">⬇ Download File</button>
            </div>`;
    }

    document.getElementById('vaultViewerModal').classList.add('open');
}

// ============================================================
// DATE NAV, CALENDAR & PLANNER
// ============================================================
function goToDate() { const val = document.getElementById('goToDateInput').value; if (!val) return toast('Please select a date'); calCurrentDate = new Date(val + 'T00:00:00'); STATE.selectedDate = val; renderCalendar(); renderPlanner(); toast(`Jumped to ${fmtDisplay(val)}`); }
function goToToday() { const today = new Date(); const str = fmtDate(today); calCurrentDate = today; STATE.selectedDate = str; document.getElementById('goToDateInput').value = ''; renderCalendar(); renderPlanner(); toast('Jumped to today 📅'); }

let calCurrentDate = new Date();
function renderCalendar() {
    const grid = document.getElementById('calendarGrid'); const monthYear = document.getElementById('calendarMonthYear'); grid.innerHTML = '';
    const year = calCurrentDate.getFullYear(); const month = calCurrentDate.getMonth();
    monthYear.textContent = new Date(year, month).toLocaleDateString('en', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) grid.appendChild(createCalDay(year, month - 1, prevMonthDays - i, true));
    for (let i = 1; i <= daysInMonth; i++) grid.appendChild(createCalDay(year, month, i, false));
    const totalCells = firstDay + daysInMonth; const remaining = (Math.ceil(totalCells / 7) * 7) - totalCells;
    for (let i = 1; i <= remaining; i++) grid.appendChild(createCalDay(year, month + 1, i, true));
}
function createCalDay(y, m, d, isOtherMonth) {
    const dateObj = new Date(y, m, d); const dateStr = fmtDate(dateObj);
    const el = document.createElement('div'); el.className = 'cal-day';
    if (isOtherMonth) el.classList.add('other-month'); if (dateStr === fmtDate(new Date())) el.classList.add('today'); if (dateStr === STATE.selectedDate) el.classList.add('selected');
    el.textContent = dateObj.getDate();
    if (STATE.plans.some(p => isEventOnDate(p, dateStr)) || STATE.academic.some(a => a.date === dateStr)) { const dot = document.createElement('div'); dot.className = 'cal-dot'; el.appendChild(dot); }
    el.onclick = () => { STATE.selectedDate = dateStr; calCurrentDate = new Date(y, m, d); document.getElementById('planDate').value = dateStr; renderCalendar(); renderPlanner(); };
    return el;
}
function prevMonth() { calCurrentDate.setMonth(calCurrentDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { calCurrentDate.setMonth(calCurrentDate.getMonth() + 1); renderCalendar(); }

function isEventOnDate(plan, checkDateStr) {
    if (!plan.recurrence || plan.recurrence === 'none') return plan.date === checkDateStr;
    const pDate = new Date(plan.date + 'T00:00:00'); const cDate = new Date(checkDateStr + 'T00:00:00');
    if (cDate < pDate) return false;
    if (plan.recurrence === 'weekly') return pDate.getDay() === cDate.getDay();
    if (plan.recurrence === 'monthly') return pDate.getDate() === cDate.getDate();
    if (plan.recurrence === 'yearly') return pDate.getDate() === cDate.getDate() && pDate.getMonth() === cDate.getMonth();
    return false;
}
function openPlannerModal(id = null) {
    const titleEl = document.querySelector('#plannerModal .modal-title');
    const titleInput = document.getElementById('planTitle');
    const descInput = document.getElementById('planDesc');
    const dateInput = document.getElementById('planDate');
    const timeInput = document.getElementById('planTime');
    const recSelect = document.getElementById('planRecurrence');
    const remOptEl = document.getElementById('planReminderOpt');

    if (id) {
        const p = STATE.plans.find(x => x.id === id);
        if (p) {
            if (titleEl) titleEl.textContent = 'Edit Event';
            if (titleInput) titleInput.value = p.title || '';
            if (descInput) descInput.value = p.desc || '';
            if (dateInput) dateInput.value = p.date || STATE.selectedDate;
            if (timeInput) timeInput.value = p.time || '09:00';
            if (recSelect) recSelect.value = p.recurrence || 'none';
            if (remOptEl) remOptEl.value = p.reminder || 'none';
            document.getElementById('plannerModal').dataset.editId = p.id;
        }
    } else {
        if (titleEl) titleEl.textContent = 'Add Event';
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (dateInput) dateInput.value = STATE.selectedDate;
        if (timeInput) timeInput.value = '09:00';
        if (recSelect) recSelect.value = 'none';
        if (remOptEl) remOptEl.value = 'none';
        delete document.getElementById('plannerModal').dataset.editId;
    }

    document.getElementById('plannerModal').classList.add('open');
}

function savePlan() {
    const title = document.getElementById('planTitle').value.trim();
    if (!title) return toast('Please enter a title');

    const editId = document.getElementById('plannerModal').dataset.editId;
    const planData = {
        title,
        desc: document.getElementById('planDesc').value,
        date: document.getElementById('planDate').value,
        time: document.getElementById('planTime').value || '09:00',
        color: selectedColors.plan,
        recurrence: document.getElementById('planRecurrence').value,
        reminder: document.getElementById('planReminderOpt')?.value || 'none'
    };

    const remOpt = document.getElementById('planReminderOpt')?.value || 'none';
    const customVal = document.getElementById('planCustomPicker')?.value || '';
    const triggerAtMillis = calculateReminderTimestamp(remOpt, planData.date, planData.time, customVal);

    if (editId) {
        planData.id = parseInt(editId);
        const idx = STATE.plans.findIndex(x => x.id === planData.id);
        if (idx >= 0) {
            planData.completed = STATE.plans[idx].completed;
            STATE.plans[idx] = planData;
        }
        scheduleItemNotification(planData.id, "Event Reminder 📅", planData.title, triggerAtMillis);
        renderCalendar(); renderPlanner(); renderDashboard(); closeModal('plannerModal'); save(); toast('Event updated! ✏️');
        ofetch('update_plan.php', planData);
    } else {
        const tempId = Date.now();
        planData.id = tempId;
        planData.completed = false;
        STATE.plans.push(planData);
        scheduleItemNotification(tempId, "Event Reminder 📅", planData.title, triggerAtMillis);
        renderCalendar(); renderPlanner(); renderDashboard(); closeModal('plannerModal'); save(); toast('Event added 📅');
        ofetch('add_plan.php', planData, d => {
            const p = STATE.plans.find(x => x.id === tempId);
            if (p) p.id = d.id;
            renderCalendar(); renderPlanner(); renderDashboard(); save();
        });
    }
}
function togglePlan(e, id) { if (e) e.stopPropagation(); const p = STATE.plans.find(x => x.id === id); if (!p) return; p.completed = !p.completed; renderPlanner(); renderDashboard(); save(); ofetch('update_plan.php', { id, completed: p.completed }); }
function deletePlan(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this event series?')) return; STATE.plans = STATE.plans.filter(x => x.id !== id); renderCalendar(); renderPlanner(); renderDashboard(); save(); toast('Deleted 🗑️'); ofetch('delete_plan.php', { id }); }
function renderPlanner() {
    const el = document.getElementById('plannerEvents'); const selDateObj = new Date(STATE.selectedDate + 'T00:00:00'); const selDisplay = selDateObj.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
    let html = `<div class="section-header"><div class="section-title">Events on ${selDisplay}</div></div>`;
    const selPlans = STATE.plans.filter(p => isEventOnDate(p, STATE.selectedDate)).sort((a, b) => a.time > b.time ? 1 : -1);
    if (selPlans.length === 0) { html += `<div style="text-align:center; color:var(--text3); font-size:13px; margin-bottom:24px;">No events scheduled for this day.</div>`; } else {
        html += selPlans.map(p => `<div class="time-slot"><div class="time-label">${formatTime(p.time)}</div><div class="time-line" style="background:${p.color}"></div><div class="time-events" style="flex:1"><div class="event-block ${p.completed ? 'done' : ''}" style="border-color:${p.color}" onclick="togglePlan(event, ${p.id})"><div class="event-title">${p.title}</div>${p.desc ? `<div class="event-desc">${p.desc}</div>` : ''}<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font-size:10px;color:var(--text3)">${p.completed ? '✓ Done' : (p.recurrence && p.recurrence !== 'none' ? '🔁 ' + p.recurrence : '⏰ ' + p.time)}</span><div style="display:flex;gap:6px;align-items:center;"><span onclick="event.stopPropagation(); openPlannerModal(${p.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px;" title="Edit Event">✏️</span><span onclick="deletePlan(event, ${p.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px" title="Delete Event">🗑</span></div></div></div></div></div>`).join('');
    }
    html += `<div class="section-header" style="margin-top:24px; border-top:1px solid var(--border); padding-top:16px;"><div class="section-title">Upcoming (Next 2 Months)</div></div>`;
    const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0); const twoMonths = new Date(todayObj); twoMonths.setDate(todayObj.getDate() + 60);
    let allUpcoming = [];
    for (let d = new Date(todayObj); d <= twoMonths; d.setDate(d.getDate() + 1)) {
        const checkDateStr = fmtDate(d);
        STATE.plans.forEach(p => { if (isEventOnDate(p, checkDateStr)) allUpcoming.push({ ...p, virtualDate: checkDateStr, isAcad: false }); });
        STATE.academic.forEach(a => { if (a.date === checkDateStr) allUpcoming.push({ ...a, virtualDate: checkDateStr, title: a.subject, isAcad: true }); });
    }
    allUpcoming.sort((a, b) => { const da = new Date(a.virtualDate + 'T' + (a.time || '00:00')); const db = new Date(b.virtualDate + 'T' + (b.time || '00:00')); return da - db; });
    if (allUpcoming.length === 0) { html += `<div style="text-align:center; color:var(--text3); font-size:13px; padding-bottom:20px;">No upcoming events.</div>`; } else {
        let lastDate = '';
        allUpcoming.forEach(e => {
            if (e.virtualDate !== lastDate) { const disp = new Date(e.virtualDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' }); html += `<div style="font-size:11px; font-weight:700; color:var(--accent); margin:16px 0 8px 0; text-transform:uppercase; letter-spacing:1px;">${disp}</div>`; lastDate = e.virtualDate; }
            if (e.isAcad) { html += `<div class="event-block" style="border-color:var(--accent3); margin-bottom:8px; cursor:pointer;" onclick="navTo('academic'); openAcademicModalById(${e.id})"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="font-size:10px; color:var(--accent3); font-weight:600; text-transform:uppercase;">🎓 ${e.type}</div><span onclick="delAcademic(event, ${e.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px;">🗑</span></div><div class="event-title">${e.subject}</div>${e.topic ? `<div class="event-desc">${e.topic}</div>` : ''}</div>`; }
            else { html += `<div class="event-block ${e.completed ? 'done' : ''}" style="border-color:${e.color}; margin-bottom:8px;" onclick="togglePlan(event, ${e.id})"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="event-title">${e.title}</div><div style="display:flex; gap:8px; align-items:center;"><div style="font-size:10px; color:var(--text3)">${e.recurrence && e.recurrence !== 'none' ? '🔁' : '⏰'} ${formatTime(e.time)}</div><span onclick="deletePlan(event, ${e.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px;">🗑</span></div></div></div>`; }
        });
    }
    el.innerHTML = html;
}
function formatTime(t) { const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr === 0 ? 12 : hr}:${m}${hr >= 12 ? 'pm' : 'am'}`; }

// ============================================================
// TASKS
// ============================================================
function renderTaskCategories() {
    if (!STATE.taskCategories || !Array.isArray(STATE.taskCategories) || STATE.taskCategories.length === 0) {
        STATE.taskCategories = ['Work', 'Personal'];
    }

    const catSelect = document.getElementById('taskCategory');
    if (catSelect) {
        const curVal = catSelect.value;
        catSelect.innerHTML = STATE.taskCategories.map(c => `<option value="${c}">${c}</option>`).join('');
        if (STATE.taskCategories.includes(curVal)) {
            catSelect.value = curVal;
        }
    }

    const container = document.getElementById('taskFilters');
    if (!container) return;

    let html = `
        <div class="filter-tab ${STATE.taskFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="setTaskFilter('all',this)">All</div>
        <div class="filter-tab ${STATE.taskFilter === 'active' ? 'active' : ''}" data-filter="active" onclick="setTaskFilter('active',this)">Active</div>
        <div class="filter-tab ${STATE.taskFilter === 'done' ? 'active' : ''}" data-filter="done" onclick="setTaskFilter('done',this)">Done</div>
        <div class="filter-tab ${STATE.taskFilter === 'high' ? 'active' : ''}" data-filter="high" onclick="setTaskFilter('high',this)">🔴 High</div>
    `;

    STATE.taskCategories.forEach(cat => {
        const isActive = (STATE.taskFilter || '').toLowerCase() === cat.toLowerCase() ? 'active' : '';
        const isCustom = cat !== 'Work' && cat !== 'Personal';
        html += `<div class="filter-tab ${isActive}" data-filter="${cat}" onclick="setTaskFilter('${cat}',this)">${cat}${isCustom ? `<span onclick="event.stopPropagation(); removeTaskCategory('${cat}')" style="margin-left:6px; opacity:0.6; font-size:12px; cursor:pointer;" title="Remove Category">✕</span>` : ''}</div>`;
    });

    html += `<div class="filter-tab add-cat-btn" onclick="addNewTaskCategory()" style="padding: 4px 10px; cursor: pointer; font-weight: 800; background: var(--accent); color: #000; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px;" title="Add Category">+</div>`;

    container.innerHTML = html;
}

function addNewTaskCategory() {
    const newCat = prompt('Enter new task category name:');
    if (!newCat || !newCat.trim()) return;
    const cleanCat = newCat.trim();
    if (!STATE.taskCategories || !Array.isArray(STATE.taskCategories)) {
        STATE.taskCategories = ['Work', 'Personal'];
    }
    if (STATE.taskCategories.some(c => c.toLowerCase() === cleanCat.toLowerCase())) {
        return toast('Category already exists!');
    }
    STATE.taskCategories.push(cleanCat);
    save();
    renderTaskCategories();
    setTaskFilter(cleanCat);
    toast(`Category "${cleanCat}" added! 🎉`);
}

function removeTaskCategory(cat) {
    if (!confirm(`Delete category "${cat}"?`)) return;
    STATE.taskCategories = (STATE.taskCategories || []).filter(c => c !== cat);
    if ((STATE.taskFilter || '').toLowerCase() === cat.toLowerCase()) {
        STATE.taskFilter = 'active';
    }
    save();
    renderTaskCategories();
    renderTasks();
    toast(`Category "${cat}" removed`);
}

function openTaskModal() {
    renderTaskCategories();
    document.getElementById('taskModalTitle').textContent = 'New Task';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDue').value = fmtDate(new Date());

    const remOptEl = document.getElementById('taskReminderOpt');
    if (remOptEl) remOptEl.value = 'none';
    const customPickerEl = document.getElementById('taskCustomPicker');
    if (customPickerEl) customPickerEl.value = '';
    const customRowEl = document.getElementById('taskCustomPickerRow');
    if (customRowEl) customRowEl.style.display = 'none';

    delete document.getElementById('taskModal').dataset.editId;
    document.getElementById('taskModal').classList.add('open');
}

function openTaskModalById(id) {
    renderTaskCategories();
    const t = STATE.tasks.find(x => x.id === id);
    if (!t) return;
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    document.getElementById('taskTitle').value = t.title || '';
    document.getElementById('taskDesc').value = t.description || '';
    document.getElementById('taskCategory').value = t.category || 'Work';
    document.getElementById('taskPriority').value = t.priority || 0;
    document.getElementById('taskDue').value = t.due || '';

    const remOptEl = document.getElementById('taskReminderOpt');
    if (remOptEl) remOptEl.value = t.reminder || 'none';
    const customRowEl = document.getElementById('taskCustomPickerRow');
    if (customRowEl) customRowEl.style.display = (t.reminder === 'custom') ? 'block' : 'none';

    document.getElementById('taskModal').dataset.editId = t.id;
    document.getElementById('taskModal').classList.add('open');
}

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
        reminder: document.getElementById('taskReminderOpt')?.value || 'none'
    };

    const remOpt = document.getElementById('taskReminderOpt')?.value || 'none';
    const customVal = document.getElementById('taskCustomPicker')?.value || '';
    const triggerAtMillis = calculateReminderTimestamp(remOpt, taskData.due, '09:00', customVal);

    if (editId) {
        taskData.id = parseInt(editId);
        const idx = STATE.tasks.findIndex(x => x.id === taskData.id);
        if (idx >= 0) {
            taskData.completed = STATE.tasks[idx].completed;
            STATE.tasks[idx] = taskData;
        }
        scheduleItemNotification(taskData.id, "Task Reminder 📋", taskData.title, triggerAtMillis);
        renderTasks(); renderDashboard(); closeModal('taskModal'); save(); ofetch('update_task_details.php', taskData, () => toast('Task updated! ✅'));
    } else {
        const tempId = Date.now();
        taskData.id = tempId;
        taskData.completed = false;
        STATE.tasks.unshift(taskData);
        scheduleItemNotification(tempId, "Task Reminder 📋", taskData.title, triggerAtMillis);
        renderTasks(); renderDashboard(); closeModal('taskModal'); save(); toast('Saved! ✅');
        ofetch('add_task.php', taskData, d => { const t = STATE.tasks.find(x => x.id === tempId); if (t) t.id = Number(d.id); renderTasks(); save(); });
    }
    if (taskData.reminder) scheduleReminderToast(taskData);
}

function toggleTask(e, id) {
    if (e) e.stopPropagation();
    const t = STATE.tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    renderTasks(); renderDashboard(); save(); toast(t.completed ? 'Task done! 🎉' : 'Task reopened');
    ofetch('update_task.php', { id, completed: t.completed });
}

function deleteTask(e, id) {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task?')) return;
    STATE.tasks = STATE.tasks.filter(t => t.id !== id);
    renderTasks(); renderDashboard(); save(); toast('Task deleted 🗑️');
    ofetch('delete_task.php', { id });
}

function setTaskFilter(f, el) {
    STATE.taskFilter = f || 'active';
    renderTaskCategories();
    renderTasks();
}

function renderTasks() {
    renderTaskCategories();
    let tasks = [...STATE.tasks];
    const tf = (STATE.taskFilter || 'active').toLowerCase();
    if (tf === 'active') {
        tasks = tasks.filter(t => !t.completed);
    } else if (tf === 'done') {
        tasks = tasks.filter(t => t.completed);
    } else if (tf === 'high') {
        tasks = tasks.filter(t => t.priority === 2 && !t.completed);
    } else if (tf !== 'all') {
        tasks = tasks.filter(t => (t.category || '').toLowerCase() === tf);
    }
    const el = document.getElementById('taskList');
    if (tasks.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No tasks here</p></div>';
    el.innerHTML = tasks.map(t => `<div class="task-item ${t.completed ? 'done' : ''}" onclick="openTaskModalById(${t.id})" style="cursor:pointer;"><div class="task-check ${t.completed ? 'checked' : ''}" onclick="toggleTask(event, ${t.id})"></div><div class="task-body"><div class="task-title">${t.title}</div><div class="task-meta"><span class="priority-dot p${t.priority}"></span><span class="pill pill-accent" style="font-size:10px;padding:2px 7px">${t.category}</span>${t.due ? `<span class="task-due">📅 ${fmtDisplay(t.due)}</span>` : ''} ${t.priority === 2 ? '<span style="font-size:11px;color:var(--red)">🔴 High</span>' : ''}</div></div><div class="task-delete" onclick="deleteTask(event, ${t.id})">🗑</div></div>`).join('');
}

// ============================================================
// COUNTERS
// ============================================================
function saveCounter() {
    const name = document.getElementById('counterName').value.trim();
    if (!name) return toast('Enter a name');
    const nowIso = new Date().toISOString();
    const cData = {
        name,
        value: parseInt(document.getElementById('counterStart').value) || 0,
        step: parseInt(document.getElementById('counterStep').value) || 1,
        color: selectedColors.counter,
        lastUpdated: nowIso,
        createdAt: nowIso
    };
    const tempId = Date.now();
    cData.id = tempId;
    STATE.counters.push(cData);
    renderCounters();
    closeModal('counterModal');
    save();
    toast('Counter created 🔢');
    ofetch('add_counter.php', cData, d => {
        const c = STATE.counters.find(x => x.id === tempId);
        if (c) c.id = d.id;
        if (STATE.dashConfig.counterId == tempId) STATE.dashConfig.counterId = String(d.id);
        renderCounters(); renderDashboard(); save();
    });
}

function adjustCounter(id, dir) { const c = STATE.counters.find(x => x.id === id); if (!c) return; c.value += dir * c.step; c.lastUpdated = new Date().toISOString(); renderCounters(); save(); ofetch('update_counter.php', { id, value: c.value, lastUpdated: c.lastUpdated }); }
function resetCounter(id) { const c = STATE.counters.find(x => x.id === id); if (!c) return; c.value = 0; c.lastUpdated = new Date().toISOString(); renderCounters(); save(); ofetch('update_counter.php', { id, value: 0, lastUpdated: c.lastUpdated }); }
function deleteCounter(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this counter?')) return; STATE.counters = STATE.counters.filter(x => x.id !== id); renderCounters(); save(); toast('Counter deleted 🗑️'); ofetch('delete_counter.php', { id }); }
function openCounterModal() { document.getElementById('counterName').value = ''; document.getElementById('counterStep').value = '1'; document.getElementById('counterStart').value = '0'; document.getElementById('counterModal').classList.add('open'); }

function parseCounterDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
        if (val < 10000000000) val = val * 1000;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        let str = val.trim();
        if (/^\d+$/.test(str)) {
            let num = parseInt(str, 10);
            if (num < 10000000000) num = num * 1000;
            const d = new Date(num);
            return isNaN(d.getTime()) ? null : d;
        }
        if (str.includes(' ') && !str.includes('T') && !str.includes(',')) {
            str = str.replace(' ', 'T');
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}

function timeSince(dateInput) {
    if (!dateInput) return 'Just now';
    const date = dateInput instanceof Date ? dateInput : parseCounterDate(dateInput);
    if (!date || isNaN(date.getTime())) return 'Just now';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs <= 0 || diffMs < 60000) return 'Just now';

    const diffMins = diffMs / (1000 * 60);
    if (diffMins < 60) return Math.floor(diffMins) + ' mins ago';

    const diffHours = diffMins / 60;
    if (diffHours < 24) return Math.floor(diffHours) + ' hours ago';

    const diffDays = diffHours / 24;
    let daysStr = diffDays.toFixed(1);
    if (daysStr.endsWith('.0')) daysStr = daysStr.slice(0, -2);

    return daysStr + ' days ago';
}

function renderCounters() {
    const el = document.getElementById('counterGrid');
    if (STATE.counters.length === 0) return el.innerHTML = '<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">🔢</div><p>Create your first counter</p></div>';

    el.innerHTML = STATE.counters.map(c => {
        let editInfo = 'Created recently';
        const dateVal = c.lastUpdated || c.createdAt;
        const d = parseCounterDate(dateVal);
        if (d) {
            const exactDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
            const exactTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const relativeTime = timeSince(d);
            editInfo = `Last edited on ${exactDate} at ${exactTime}<br><span style="opacity: 0.7;">${relativeTime}</span>`;
        }

        return `
        <div class="counter-card">
            <div class="counter-name">${c.name}</div>
            <div class="counter-val" style="color:${c.color}">${c.value}</div>
            <div class="counter-controls">
                <button class="c-btn c-btn-minus" onclick="adjustCounter(${c.id},-1)">−</button>
                <button class="c-btn c-btn-reset" onclick="resetCounter(${c.id})">↺</button>
                <button class="c-btn c-btn-plus" onclick="adjustCounter(${c.id},1)">+</button>
            </div>
            <div class="counter-step">step: ${c.step}</div>
            <div style="font-size:11px; color:var(--text2); margin-top:8px; line-height:1.4;">${editInfo}</div>
            <div style="text-align:right;margin-top:8px">
                <span onclick="deleteCounter(event, ${c.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px;">🗑</span>
            </div>
        </div>`;
    }).join('');
}
// ============================================================
// MONEY
// ============================================================
function saveMoney() {
    const person = document.getElementById('moneyPerson').value.trim();
    const amount = parseFloat(document.getElementById('moneyAmount').value);
    if (!person || !amount) return toast('Fill required fields');
    const mData = { person, amount, type: document.getElementById('moneyType').value, note: document.getElementById('moneyNote').value, due: document.getElementById('moneyDue').value };
    const tempId = Date.now(); mData.id = tempId; mData.settled = false; STATE.money.push(mData);

    const remOpt = document.getElementById('moneyReminderOpt')?.value || 'none';
    const customVal = document.getElementById('moneyCustomPicker')?.value || '';
    const triggerAtMillis = calculateReminderTimestamp(remOpt, mData.due, '09:00', customVal);
    scheduleItemNotification(tempId, "Money Record Reminder 💰", `${person} - ${mData.note || 'Money Record'}`, triggerAtMillis);

    renderMoney(); renderDashboard(); closeModal('moneyModal'); save(); toast('Saved 💰');
    ofetch('add_money.php', mData, d => { const m = STATE.money.find(x => x.id === tempId); if (m) m.id = d.id; renderMoney(); renderDashboard(); save(); });
}
function settleMoney(e, id) { if (e) e.stopPropagation(); const m = STATE.money.find(x => x.id === id); if (!m) return; m.settled = true; renderMoney(); save(); toast('Settled ✓'); ofetch('update_money.php', { id }); }
function deleteMoney(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this money record?')) return; STATE.money = STATE.money.filter(x => x.id !== id); renderMoney(); save(); toast('Deleted 🗑️'); ofetch('delete_money.php', { id }); }
function openMoneyModal() { document.getElementById('moneyPerson').value = ''; document.getElementById('moneyAmount').value = ''; document.getElementById('moneyNote').value = ''; document.getElementById('moneyDue').value = ''; document.getElementById('moneyModal').classList.add('open'); }
function setMoneyFilter(f, el) { STATE.moneyFilter = f; document.querySelectorAll('#screen-money .filter-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderMoney(); }
function renderMoney() { let records = [...STATE.money]; if (STATE.moneyFilter === 'lent') records = records.filter(m => m.type === 'lent'); else if (STATE.moneyFilter === 'borrowed') records = records.filter(m => m.type === 'borrowed'); else if (STATE.moneyFilter === 'pending') records = records.filter(m => !m.settled); else if (STATE.moneyFilter === 'settled') records = records.filter(m => m.settled); const lentTotal = STATE.money.filter(m => m.type === 'lent' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0); const owedTotal = STATE.money.filter(m => m.type === 'borrowed' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0); document.getElementById('totalLent').textContent = Math.round(lentTotal); document.getElementById('totalOwed').textContent = Math.round(owedTotal); const el = document.getElementById('moneyList'); if (records.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No records found</p></div>'; el.innerHTML = records.map(m => { const amtVal = Math.round(parseFloat(m.amount) || 0); return `<div class="money-item ${m.settled ? 'money-settled' : ''}"><div class="money-avatar ${m.type}">${m.person[0].toUpperCase()}</div><div class="money-info"><div class="money-name">${m.person} ${m.settled ? '<span class="pill pill-green" style="font-size:9px">Settled</span>' : ''}</div><div class="money-note">${m.note || (m.type === 'lent' ? 'You lent' : 'You borrowed')} ${m.due ? '· Due ' + fmtDisplay(m.due) : ''}</div></div><div style="text-align:right; min-width:85px; width:85px; flex-shrink:0;"><div class="money-amount ${m.type}">${m.type === 'lent' ? '+' : '-'}${amtVal}</div>${!m.settled ? `<button class="settle-btn" onclick="settleMoney(event, ${m.id})">Settle</button>` : ''}<div onclick="deleteMoney(event, ${m.id})" style="font-size:16px;color:var(--text3);cursor:pointer;margin-top:4px;padding:4px;">🗑️</div></div></div>`; }).join(''); }

// ============================================================
// ALARMS
// ============================================================
function saveAlarm() { const time = document.getElementById('alarmTime').value; if (!time) return toast('Please set a time'); const days = [...document.querySelectorAll('.day-btn.selected')].map(b => b.dataset.day).join(''); const [h, m] = time.split(':').map(Number); const aData = { time, hour: h, minute: m, label: document.getElementById('alarmLabel').value || 'Alarm', days }; const tempId = Date.now(); aData.id = tempId; aData.enabled = true; STATE.alarms.push(aData); renderAlarms(); closeModal('alarmModal'); save(); toast('Alarm set ⏰'); ofetch('add_alarm.php', aData, d => { const a = STATE.alarms.find(x => x.id === tempId); if (a) a.id = d.id; renderAlarms(); renderDashboard(); save(); }); }
function toggleAlarm(e, id) { if (e) e.stopPropagation(); const a = STATE.alarms.find(x => x.id === id); if (!a) return; a.enabled = !a.enabled; renderAlarms(); renderDashboard(); save(); toast(a.enabled ? 'Alarm enabled' : 'Alarm disabled'); ofetch('update_alarm.php', { id, enabled: a.enabled }); }
function deleteAlarm(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this alarm?')) return; STATE.alarms = STATE.alarms.filter(x => x.id !== id); renderAlarms(); renderDashboard(); save(); toast('Alarm deleted 🗑️'); ofetch('delete_alarm.php', { id }); }
function openAlarmModal() { document.getElementById('alarmTime').value = ''; document.getElementById('alarmLabel').value = ''; document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected')); document.getElementById('alarmModal').classList.add('open'); }
function toggleDay(el) { el.classList.toggle('selected'); }
function renderAlarms() { const el = document.getElementById('alarmList'); if (STATE.alarms.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">⏰</div><p>No alarms set</p></div>'; el.innerHTML = STATE.alarms.map(a => { const [h, m] = a.time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h; const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']; const daysStr = a.days ? a.days.split('').map(d => dayNames[parseInt(d)]).join(' ') : 'Once'; return `<div class="alarm-item ${!a.enabled ? 'money-settled' : ''}"><div style="flex:1"><div class="alarm-time">${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')}<span class="alarm-time-ampm">${ampm}</span></div><div class="alarm-label">${a.label}</div><div class="alarm-days">${daysStr}</div></div><label class="alarm-toggle"><input type="checkbox" ${a.enabled ? 'checked' : ''} onchange="toggleAlarm(event, ${a.id})"><span class="toggle-slider"></span></label><div class="alarm-delete" onclick="deleteAlarm(event, ${a.id})">🗑</div></div>`; }).join(''); }
function setupAlarmTicks() { setInterval(() => { const now = new Date(); const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(); if (s === 0) { STATE.alarms.filter(a => a.enabled && a.time).forEach(a => { const [ah, am] = a.time.split(':').map(Number); if (ah !== h || am !== m) return; const dayOfWeek = now.getDay().toString(); if (!a.days || a.days === '' || a.days.includes(dayOfWeek)) { sendSystemNotification("Alarm: " + a.label, formatTime(a.time)); try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==').play(); } catch (e) { } } }); } if (typeof checkDailyReminders === 'function') checkDailyReminders(); }, 1000); }

// ============================================================
// ROADMAPS
// ============================================================
function saveRoadmap() { const title = document.getElementById('roadmapTitle').value.trim(); if (!title) return toast('Please enter a title'); const rData = { title, desc: document.getElementById('roadmapDesc').value, category: document.getElementById('roadmapCategory').value, target: document.getElementById('roadmapTarget').value, color: selectedColors.roadmap }; const tempId = Date.now(); rData.id = tempId; rData.pendingSync = true; STATE.roadmaps.push(rData); renderRoadmaps(); closeModal('roadmapModal'); save(); toast('Roadmap created 🗺️'); ofetch('add_roadmap.php', rData, d => { const r = STATE.roadmaps.find(x => x.id === tempId); if (r) { r.id = d.id; r.pendingSync = false; } renderRoadmaps(); renderDashboard(); save(); }); }
function deleteRoadmap(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this entire roadmap? All steps will be lost.')) return; STATE.roadmaps = STATE.roadmaps.filter(r => r.id !== id); STATE.steps = STATE.steps.filter(s => s.roadmapId !== id); document.getElementById('roadmapDetail-view').style.display = 'none'; document.getElementById('roadmapList-view').style.display = 'block'; renderRoadmaps(); save(); toast('Roadmap Deleted! 🗑️'); ofetch('delete_roadmap.php', { id }); }
function saveStep() { const title = document.getElementById('stepTitle').value.trim(); if (!title) return toast('Please enter a title'); const rid = parseInt(document.getElementById('stepModal').dataset.roadmapId); const order = STATE.steps.filter(s => s.roadmapId === rid).length; const sData = { roadmapId: rid, title, desc: document.getElementById('stepDesc').value, date: document.getElementById('stepDate').value, order }; const tempId = Date.now(); sData.id = tempId; sData.completed = false; STATE.steps.push(sData); closeModal('stepModal'); renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid)); renderRoadmaps(); save(); toast('Step added 🏁'); ofetch('add_step.php', sData, d => { const s = STATE.steps.find(x => x.id === tempId); if (s) s.id = d.id; renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid)); save(); }); }
function toggleStep(e, id, rid) { if (e) e.stopPropagation(); const s = STATE.steps.find(x => x.id === id); if (!s) return; s.completed = !s.completed; renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid)); renderRoadmaps(); save(); ofetch('update_step.php', { id, completed: s.completed }); }
function deleteStep(e, id, rid) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this milestone?')) return; STATE.steps = STATE.steps.filter(s => s.id !== id); renderRoadmapDetail(STATE.roadmaps.find(r => r.id === rid)); renderRoadmaps(); save(); toast('Step deleted! 🗑️'); ofetch('delete_step.php', { id }); }
function openRoadmapModal() { document.getElementById('roadmapTitle').value = ''; document.getElementById('roadmapDesc').value = ''; document.getElementById('roadmapTarget').value = ''; document.getElementById('roadmapModal').classList.add('open'); }
function renderRoadmaps() { const el = document.getElementById('roadmapList'); if (STATE.roadmaps.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗺️</div><p>Create your first roadmap</p></div>'; el.innerHTML = STATE.roadmaps.map(r => { const steps = STATE.steps.filter(s => s.roadmapId === r.id); const done = steps.filter(s => s.completed).length; const pct = steps.length ? Math.round(done / steps.length * 100) : 0; return `<div class="roadmap-item" onclick="openRoadmapDetail(${r.id})"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="roadmap-title">${r.title}</div><div class="roadmap-desc">${r.desc || r.category}</div></div><span class="pill pill-accent">${r.category}</span></div><div class="roadmap-progress"><div class="roadmap-progress-fill" style="width:${pct}%;background:${r.color}"></div></div><div class="roadmap-meta"><span class="roadmap-steps-count">${done}/${steps.length} steps ${pct}%</span>${r.target ? `<span style="font-size:11px;color:var(--text3)">🎯 ${fmtDisplay(r.target)}</span>` : ''}</div></div>`; }).join(''); }
function openRoadmapDetail(id) { STATE.activeRoadmap = id; const r = STATE.roadmaps.find(r => r.id === id); document.getElementById('roadmapList-view').style.display = 'none'; const detail = document.getElementById('roadmapDetail-view'); detail.style.display = 'block'; renderRoadmapDetail(r); }
function renderRoadmapDetail(r) { const steps = STATE.steps.filter(s => s.roadmapId === r.id).sort((a, b) => a.order - b.order); const done = steps.filter(s => s.completed).length; const pct = steps.length ? Math.round(done / steps.length * 100) : 0; document.getElementById('roadmapDetail-view').innerHTML = `<div class="back-btn" onclick="navTo('roadmap')">← Back to Roadmaps</div><div class="card" style="border-color:${r.color}20;background:${r.color}0a"><div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px"><div><div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800">${r.title}</div><div style="font-size:13px;color:var(--text2);margin-top:2px">${r.desc || ''}</div></div><span class="pill pill-accent">${pct}%</span></div><div class="roadmap-progress" style="height:6px"><div class="roadmap-progress-fill" style="width:${pct}%;background:${r.color}"></div></div><div style="display:flex;justify-content:space-between;margin-top:8px"><span style="font-size:11px;color:var(--text2)">${done}/${steps.length} milestones</span>${r.target ? `<span style="font-size:11px;color:var(--text3)">Target: ${fmtDisplay(r.target)}</span>` : ''}</div></div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div class="section-title">Milestones</div><button class="btn-add" onclick="openStepModal(${r.id})">+ Step</button></div>${steps.length === 0 ? '<div class="empty-state"><div class="empty-icon">🏁</div><p>Add your first milestone</p></div>' : `<div class="step-timeline"><div class="step-line"></div>${steps.map((s, i) => `<div class="step-item"><div class="step-dot ${s.completed ? 'done' : i === done ? 'active' : ''}" onclick="toggleStep(event, ${s.id},${r.id})"></div><div class="step-content ${s.completed ? 'done' : ''}"><div style="display:flex;justify-content:space-between"><div class="step-content-title">${s.title}</div><span onclick="deleteStep(event, ${s.id},${r.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px;">🗑</span></div>${s.desc ? `<div class="step-content-desc">${s.desc}</div>` : ''}${s.date ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">📅 ${fmtDisplay(s.date)}</div>` : ''}</div></div>`).join('')}</div>`}<div style="margin-top:16px"><button onclick="deleteRoadmap(event, ${r.id})" style="width:100%;padding:12px;border-radius:var(--radius-sm);border:1px solid rgba(245,100,124,.3);background:rgba(245,100,124,.08);color:var(--red);font-size:13px;cursor:pointer">Delete Roadmap</button></div>`; }
function openStepModal(roadmapId) { const r = STATE.roadmaps.find(r => r.id === roadmapId); if (navigator.onLine && r && r.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!'); document.getElementById('stepTitle').value = ''; document.getElementById('stepDesc').value = ''; document.getElementById('stepDate').value = ''; document.getElementById('stepModal').dataset.roadmapId = roadmapId; document.getElementById('stepModal').classList.add('open'); }

// ============================================================
// ATTENDANCE
// ============================================================
let attCurrentDate = new Date();
function openAttRoutineModal() { document.getElementById('attRoutineModalTitle').textContent = 'Add Weekly Class Routine'; document.getElementById('attRoutineSubject').value = ''; document.getElementById('attRoutineRoom').value = ''; document.getElementById('attRoutineStartTime').value = '09:00'; document.getElementById('attRoutineEndTime').value = '10:30'; document.getElementById('attRoutineDay').value = new Date(STATE.attSelectedDate + 'T00:00:00').getDay() || '0'; delete document.getElementById('attRoutineModal').dataset.editId; document.getElementById('attRoutineModal').classList.add('open'); }
function openAttRoutineModalById(id) { const r = STATE.attendanceRoutines.find(x => x.id === id); if (!r) return; document.getElementById('attRoutineModalTitle').textContent = 'Edit Class Routine'; document.getElementById('attRoutineSubject').value = r.subject; document.getElementById('attRoutineRoom').value = r.room || ''; document.getElementById('attRoutineStartTime').value = r.startTime || r.time || '09:00'; document.getElementById('attRoutineEndTime').value = r.endTime || r.time || '10:30'; document.getElementById('attRoutineDay').value = r.dayOfWeek; document.getElementById('attRoutineModal').dataset.editId = r.id; document.getElementById('attRoutineModal').classList.add('open'); }
function deleteAttRoutine(e, id) { if (e) e.stopPropagation(); if (!confirm('Delete this class routine entirely? This removes it from your schedule forever.')) return; STATE.attendanceRoutines = STATE.attendanceRoutines.filter(r => r.id !== id); STATE.attendanceLogs = STATE.attendanceLogs.filter(l => l.routineId !== id); renderAttCalendar(); renderAttendance(); save(); toast('Class Deleted! 🗑️'); ofetch('delete_att_routine.php', { id }); }
function saveAttRoutine() { const subject = document.getElementById('attRoutineSubject').value.trim(); if (!subject) return toast('Need a class name!'); const rData = { subject, room: document.getElementById('attRoutineRoom').value.trim(), startTime: document.getElementById('attRoutineStartTime').value || '09:00', endTime: document.getElementById('attRoutineEndTime').value || '10:30', dayOfWeek: parseInt(document.getElementById('attRoutineDay').value) }; const editId = document.getElementById('attRoutineModal').dataset.editId; if (editId) { rData.id = parseInt(editId); const idx = STATE.attendanceRoutines.findIndex(x => x.id === rData.id); if (idx >= 0) STATE.attendanceRoutines[idx] = rData; closeModal('attRoutineModal'); save(); renderAttCalendar(); renderAttendance(); toast('Routine Updated! ✏️'); ofetch('update_att_routine.php', rData); } else { const tempId = Date.now(); rData.id = tempId; STATE.attendanceRoutines.push(rData); closeModal('attRoutineModal'); save(); renderAttCalendar(); renderAttendance(); toast('Routine Added! 📅'); ofetch('add_att_routine.php', rData, d => { const r = STATE.attendanceRoutines.find(x => x.id === tempId); if (r) r.id = d.id; save(); }); } }
function renderAttCalendar() { if (!STATE.attSelectedDate) STATE.attSelectedDate = fmtDate(new Date()); const grid = document.getElementById('attCalendarGrid'); const monthYear = document.getElementById('attCalendarMonthYear'); if (!grid) return; grid.innerHTML = ''; const year = attCurrentDate.getFullYear(); const month = attCurrentDate.getMonth(); monthYear.textContent = new Date(year, month).toLocaleDateString('en', { month: 'long', year: 'numeric' }); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const prevMonthDays = new Date(year, month, 0).getDate(); for (let i = firstDay - 1; i >= 0; i--) grid.appendChild(createAttCalDay(year, month - 1, prevMonthDays - i, true)); for (let i = 1; i <= daysInMonth; i++) grid.appendChild(createAttCalDay(year, month, i, false)); const totalCells = firstDay + daysInMonth; const remaining = (Math.ceil(totalCells / 7) * 7) - totalCells; for (let i = 1; i <= remaining; i++) grid.appendChild(createAttCalDay(year, month + 1, i, true)); }
function createAttCalDay(y, m, d, isOtherMonth) { const dateObj = new Date(y, m, d); const dateStr = fmtDate(dateObj); const dayOfWeek = dateObj.getDay(); const el = document.createElement('div'); el.className = 'cal-day'; if (isOtherMonth) el.classList.add('other-month'); if (dateStr === fmtDate(new Date())) el.classList.add('today'); if (dateStr === STATE.attSelectedDate) el.classList.add('selected'); el.textContent = dateObj.getDate(); const hasRoutine = STATE.attendanceRoutines.some(r => parseInt(r.dayOfWeek) === dayOfWeek); if (hasRoutine) { const dot = document.createElement('div'); dot.className = 'cal-dot'; dot.style.backgroundColor = 'var(--accent4)'; el.appendChild(dot); } el.onclick = () => { STATE.attSelectedDate = dateStr; attCurrentDate = new Date(y, m, d); renderAttCalendar(); renderAttendance(); }; return el; }
function prevAttMonth() { attCurrentDate.setMonth(attCurrentDate.getMonth() - 1); renderAttCalendar(); }
function nextAttMonth() { attCurrentDate.setMonth(attCurrentDate.getMonth() + 1); renderAttCalendar(); }
function goToAttDate() { const val = document.getElementById('attGoToDateInput').value; if (!val) return toast('Please select a date'); attCurrentDate = new Date(val + 'T00:00:00'); STATE.attSelectedDate = val; renderAttCalendar(); renderAttendance(); toast(`Jumped to ${fmtDisplay(val)}`); }
function goToAttToday() { const today = new Date(); attCurrentDate = today; STATE.attSelectedDate = fmtDate(today); document.getElementById('attGoToDateInput').value = ''; renderAttCalendar(); renderAttendance(); toast('Jumped to today 📅'); }
function calculateAttendanceStats(routineId) { const logs = STATE.attendanceLogs.filter(l => l.routineId === routineId); const attended = logs.filter(l => l.status === 'attended').length; const missed = logs.filter(l => l.status === 'missed').length; const total = attended + missed; const pct = total === 0 ? 0 : (attended / total) * 100; let statsMsg = ""; if (total === 0) { statsMsg = "No classes recorded yet."; } else if (pct < 75) { const needed = (3 * total) - (4 * attended); statsMsg = `You need to attend **${needed}** consecutive classes to reach 75%.`; } else { const canMiss = Math.floor((4 / 3 * attended) - total); statsMsg = `You are safe! You can miss **${canMiss}** classes and stay above 75%.`; } return { pct, statsMsg, total, attended, missed }; }
function updateAttLog(routineId, status) { const date = STATE.attSelectedDate; let log = STATE.attendanceLogs.find(l => l.routineId === routineId && l.date === date); if (log) { log.status = status; save(); renderAttendance(); ofetch('update_att_log.php', { id: log.id, status }); } else { const tempId = Date.now(); const lData = { id: tempId, routineId, date, status }; STATE.attendanceLogs.push(lData); save(); renderAttendance(); ofetch('add_att_log.php', lData, d => { const l = STATE.attendanceLogs.find(x => x.id === tempId); if (l) l.id = d.id; save(); }); } }
function renderAttendance() { const el = document.getElementById('attendanceList'); if (!el) return; if (!STATE.attSelectedDate) STATE.attSelectedDate = fmtDate(new Date()); const selDateObj = new Date(STATE.attSelectedDate + 'T00:00:00'); const dayOfWeek = selDateObj.getDay(); const todaysRoutines = STATE.attendanceRoutines.filter(r => parseInt(r.dayOfWeek) === dayOfWeek).sort((a, b) => (a.startTime || a.time) > (b.startTime || b.time) ? 1 : -1); let html = `<div class="section-header" style="margin-top:20px;"><div class="section-title">Classes for ${selDateObj.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>`; if (todaysRoutines.length === 0) { html += '<div class="empty-state"><div class="empty-icon">🏖️</div><p>No classes scheduled for today.</p></div>'; } else { html += todaysRoutines.map(r => { const log = STATE.attendanceLogs.find(l => l.routineId === r.id && l.date === STATE.attSelectedDate); const currentStatus = log ? log.status : null; const stats = calculateAttendanceStats(r.id); const timeStr = (r.startTime && r.endTime && r.startTime !== r.endTime) ? `${formatTime(r.startTime)} - ${formatTime(r.endTime)}` : (r.startTime || r.endTime || r.time ? formatTime(r.startTime || r.endTime || r.time) : '00:00'); return `<div class="att-card" style="border-left: 4px solid var(--accent); position: relative;"><div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 8px;"><span onclick="openAttRoutineModalById(${r.id})" style="font-size:16px; color:var(--text3); cursor:pointer;" title="Edit Class">✏️</span><span onclick="deleteAttRoutine(event, ${r.id})" style="font-size:16px; color:var(--text3); cursor:pointer;" title="Delete Class">🗑</span></div><div class="att-header" style="padding-right: 50px;"><div class="att-title">${r.subject}</div></div><div style="font-size:12px; color:var(--text2); margin-top:4px;">⏰ ${timeStr} &nbsp;|&nbsp; 🏫 Room: ${r.room || 'N/A'}</div><div style="display:flex; justify-content:space-between; margin-top:12px; margin-bottom:8px; font-size:11px; color:var(--text2); font-family: 'Syne', sans-serif;"><span><b>Total Classes:</b> <span style="color:var(--text); font-size: 13px;">${stats.total}</span></span><span><b>Attended:</b> <span style="color:var(--green); font-size: 13px;">${stats.attended}</span></span><span><b>Missed:</b> <span style="color:var(--red); font-size: 13px;">${stats.missed}</span></span></div><div class="att-bar-bg" style="height: 4px;"><div class="att-bar-fill" style="width:${stats.pct}%; background: ${stats.pct >= 75 ? 'var(--green)' : 'var(--red)'}"></div></div><div style="display: flex; justify-content: space-between; font-size:11px; color:var(--text3); margin-bottom:12px;"><span>${stats.statsMsg}</span><span style="font-weight: 700; color: ${stats.pct >= 75 ? 'var(--green)' : 'var(--red)'};">${stats.pct.toFixed(1)}%</span></div><div class="att-controls" style="display:flex; gap:8px;"><button class="btn-secondary" style="flex:1; padding:8px; font-size:12px; background: ${currentStatus === 'attended' ? 'var(--green)' : 'var(--surface2)'}; color: ${currentStatus === 'attended' ? '#000' : 'var(--text)'};" onclick="updateAttLog(${r.id}, 'attended')">✅ Attended</button><button class="btn-secondary" style="flex:1; padding:8px; font-size:12px; background: ${currentStatus === 'missed' ? 'var(--red)' : 'var(--surface2)'}; color: ${currentStatus === 'missed' ? '#fff' : 'var(--text)'};" onclick="updateAttLog(${r.id}, 'missed')">❌ Missed</button><button class="btn-secondary" style="flex:1; padding:8px; font-size:12px; background: ${currentStatus === 'cancelled' ? 'var(--accent3)' : 'var(--surface2)'}; color: ${currentStatus === 'cancelled' ? '#000' : 'var(--text)'};" onclick="updateAttLog(${r.id}, 'cancelled')">⏸️ Cancel</button></div></div>`; }).join(''); } el.innerHTML = html; }

// ============================================================
// ACADEMIC
// ============================================================
function saveAcademic() { const subject = document.getElementById('acadSubject').value.trim(); if (!subject) return toast('Need a subject!'); const editId = document.getElementById('academicModal').dataset.editId; const aData = { subject, type: document.getElementById('acadType').value, date: document.getElementById('acadDate').value, topic: document.getElementById('acadTopic').value, desc: document.getElementById('acadDesc').value, note: document.getElementById('acadNote').value }; if (editId) { aData.id = parseInt(editId); const idx = STATE.academic.findIndex(x => x.id === aData.id); if (idx >= 0) STATE.academic[idx] = aData; renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner(); closeModal('academicModal'); save(); toast('Updated! 🎓'); ofetch('update_academic.php', aData); } else { const tempId = Date.now(); aData.id = tempId; STATE.academic.push(aData); renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner(); closeModal('academicModal'); save(); toast('Saved! 🎓'); ofetch('add_academic.php', aData, d => { const a = STATE.academic.find(x => x.id === tempId); if (a) a.id = d.id; renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner(); save(); }); } }
function delAcademic(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this academic event?')) return; STATE.academic = STATE.academic.filter(a => a.id !== id); renderCalendar(); renderAcademic(); renderDashboard(); renderPlanner(); save(); toast('Deleted!'); ofetch('delete_academic.php', { id }); }
function openAcademicModal() { document.getElementById('academicModalTitle').textContent = 'New Academic Event'; document.getElementById('acadSubject').value = ''; document.getElementById('acadTopic').value = ''; document.getElementById('acadDesc').value = ''; document.getElementById('acadNote').value = ''; delete document.getElementById('academicModal').dataset.editId; document.getElementById('academicModal').classList.add('open'); }
function openAcademicModalById(id) { const a = STATE.academic.find(x => x.id === id); if (!a) return; document.getElementById('academicModalTitle').textContent = 'Edit Academic Event'; document.getElementById('acadSubject').value = a.subject; document.getElementById('acadType').value = a.type; document.getElementById('acadDate').value = a.date || ''; document.getElementById('acadTopic').value = a.topic || ''; document.getElementById('acadDesc').value = a.desc || ''; document.getElementById('acadNote').value = a.note || ''; document.getElementById('academicModal').dataset.editId = a.id; document.getElementById('academicModal').classList.add('open'); }
function renderAcademic() { const el = document.getElementById('academicList'); if (!STATE.academic.length) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎓</div><p>No upcoming exams or projects</p></div>'; const sorted = [...STATE.academic].sort((a, b) => new Date(a.date || '9999') - new Date(b.date || '9999')); el.innerHTML = sorted.map(a => `<div class="acad-card" onclick="openAcademicModalById(${a.id})"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="acad-type">${a.type}</div><span onclick="delAcademic(event, ${a.id})" style="color:var(--text3); font-size:16px; cursor:pointer; padding:4px;">🗑</span></div><div class="acad-title">${a.subject}</div>${a.date ? `<div class="acad-detail">📅 <b>Date:</b> ${new Date(a.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div>` : ''}${a.topic ? `<div class="acad-detail">🎯 <b>Topic:</b> ${a.topic}</div>` : ''}${a.desc ? `<div class="acad-detail">📝 <b>Desc:</b> ${a.desc}</div>` : ''}${a.note ? `<div class="acad-detail" style="margin-top:6px; font-style:italic; border-top:1px solid var(--border); padding-top:6px">Note: ${a.note}</div>` : ''}</div>`).join(''); }

// ============================================================
// EXPENSES
// ============================================================
function getAccountBalance(accountId) { const acc = STATE.accounts.find(a => a.id == accountId); const opening = parseFloat(acc ? acc.balance : 0) || 0; const txSum = STATE.expenses.filter(e => e.accountId == accountId).reduce((s, e) => s - (parseFloat(e.amount) || 0), 0); return opening + txSum; }
function renderExpenses() { if (!STATE.activeAccountId) { const mv = document.getElementById('expensesMainView'); const dv = document.getElementById('transactionDetailView'); if (mv) mv.style.display = 'block'; if (dv) dv.style.display = 'none'; } const el = document.getElementById('accountDisplay'); if (!el) return; if (!STATE.accounts || STATE.accounts.length === 0) { el.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">💳</div><p>No accounts yet.<br>Tap <strong>+ Account</strong> to create one.</p></div>`; return; } el.innerHTML = STATE.accounts.map(acc => { const txCount = STATE.expenses.filter(e => e.accountId == acc.id).length; const bal = getAccountBalance(acc.id); return `<div onclick="openAccountDetail(${acc.id})" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;cursor:pointer;transition:all 0.2s;min-width:0;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Account</div><div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(acc.name)}</div><div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};">${bal >= 0 ? '' : '-'}${Math.abs(Math.round(bal))}</div><div style="font-size:10px;color:var(--text3);margin-top:8px;">${txCount} transaction${txCount !== 1 ? 's' : ''}</div></div>`; }).join(''); }
function openAccountModal() { const m = document.getElementById('accountModal'); if (!m) return; document.getElementById('accountName').value = ''; document.getElementById('accountInitial').value = '0'; m.classList.add('open'); }
function saveAccount() {
    const name = document.getElementById('accountName').value.trim();
    const balance = parseFloat(document.getElementById('accountInitial').value) || 0;
    if (!name) return toast('Please enter an account name');
    const tempId = Date.now();
    const accData = { id: tempId, name, balance, pendingSync: true };
    STATE.accounts.push(accData);
    renderExpenses();
    closeModal('accountModal');
    save();
    toast('Account created! 💳');
    ofetch('add_account.php', { id: tempId, name, balance }, d => {
        const a = STATE.accounts.find(x => x.id === tempId);
        if (a) { a.id = d.id; a.pendingSync = false; }
        if (STATE.dashConfig.accountId == tempId) STATE.dashConfig.accountId = String(d.id); // Reconcile Pin
        renderExpenses(); closeModal('accountModal'); renderDashboard(); save();
    });
} // <--- THIS WAS THE FATAL MISSING BRACKET

function openAccountDetail(id) { STATE.activeAccountId = id; const acc = STATE.accounts.find(a => a.id == id); if (!acc) return; document.getElementById('expensesMainView').style.display = 'none'; document.getElementById('transactionDetailView').style.display = 'block'; document.getElementById('accountNameTitle').innerHTML = `${escapeHtml(acc.name)} <span onclick="deleteAccount(${acc.id})" style="font-size:16px;cursor:pointer;color:var(--red);margin-left:12px;padding:4px;" title="Delete Account">🗑️</span>`; renderTransactions(id); }
function hideTransactionDetail() { STATE.activeAccountId = null; document.getElementById('transactionDetailView').style.display = 'none'; document.getElementById('expensesMainView').style.display = 'block'; renderExpenses(); } function openTransactionModal() { const acc = STATE.accounts.find(a => a.id == STATE.activeAccountId); if (navigator.onLine && acc && acc.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!'); const m = document.getElementById('transactionModal'); if (!m) return toast('Modal not found!'); document.getElementById('transAmount').value = ''; document.getElementById('transNote').value = ''; document.getElementById('transCategory').value = 'Food'; m.classList.add('open'); }
function openAddFundModal() { const acc = STATE.accounts.find(a => a.id == STATE.activeAccountId); if (navigator.onLine && acc && acc.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!'); const m = document.getElementById('addFundModal'); if (!m) return toast('Fund modal not found!'); document.getElementById('fundAmount').value = ''; document.getElementById('fundNote').value = ''; m.classList.add('open'); }
function saveAddFund() { const amount = parseFloat(document.getElementById('fundAmount').value); const note = document.getElementById('fundNote').value.trim(); const accountId = STATE.activeAccountId; if (!amount || amount <= 0) return toast('Enter a valid amount'); if (!accountId) return toast('No account selected'); const now = new Date(); const dateStr = now.toISOString().split('T')[0]; const timeStr = now.toTimeString().slice(0, 8); const storedAmount = -Math.abs(amount); const tempId = Date.now(); const expenseData = { id: tempId, accountId, amount: storedAmount, category: 'Deposit', note: note || 'Added Funds', date: dateStr, time: timeStr }; STATE.expenses.push(expenseData); save(); renderTransactions(accountId); renderExpenses(); renderDashboard(); closeModal('addFundModal'); toast('Funds added! 💰'); ofetch('add_expense.php', expenseData, d => { const exp = STATE.expenses.find(e => e.id === tempId); if (exp) { exp.id = Number(d.id); save(); renderTransactions(accountId); } }); }
function saveTransaction() { const amount = parseFloat(document.getElementById('transAmount').value); const category = document.getElementById('transCategory').value; const note = document.getElementById('transNote').value.trim(); const accountId = STATE.activeAccountId; if (!amount || amount <= 0) return toast('Enter a valid amount'); if (!accountId) return toast('No account selected'); const now = new Date(); const dateStr = now.toISOString().split('T')[0]; const timeStr = now.toTimeString().slice(0, 8); const tempId = Date.now(); const expenseData = { id: tempId, accountId, amount, category, note, date: dateStr, time: timeStr }; STATE.expenses.push(expenseData); save(); renderTransactions(accountId); renderExpenses(); renderDashboard(); closeModal('transactionModal'); toast('Saved! ✅'); ofetch('add_expense.php', expenseData, d => { const exp = STATE.expenses.find(e => e.id === tempId); if (exp) { exp.id = Number(d.id); save(); renderTransactions(accountId); } }); }
function deleteExpense(btn) { const expenseId = btn.getAttribute('data-expense-id'); const accountId = btn.getAttribute('data-account-id'); if (!expenseId || expenseId === 'undefined') return toast('Cannot delete: missing ID.'); if (!confirm('Delete this transaction?')) return; STATE.expenses = STATE.expenses.filter(ex => ex.id != expenseId); renderTransactions(accountId); renderExpenses(); renderDashboard(); save(); toast('Transaction deleted 🗑️'); ofetch('delete_expense.php', { id: expenseId }); }
function deleteAccount(id) { if (!confirm('Delete this account and all its transactions? This cannot be undone.')) return; STATE.accounts = STATE.accounts.filter(a => a.id != id); STATE.expenses = STATE.expenses.filter(e => e.accountId != id); renderExpenses(); hideTransactionDetail(); renderDashboard(); save(); toast('Account deleted 🗑️'); ofetch('delete_account.php', { id }); }
function renderTransactions(accountId) { const list = document.getElementById('transactionList'); if (!list) return; const acc = STATE.accounts.find(a => a.id == accountId); const trans = STATE.expenses.filter(e => e.accountId == accountId).sort((a, b) => { const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00:00')); const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00:00')); const diff = db - da; if (diff !== 0) return diff; const idxA = STATE.expenses.indexOf(a); const idxB = STATE.expenses.indexOf(b); if (idxA !== -1 && idxB !== -1 && idxA !== idxB) { return idxB - idxA; } return (Number(b.id) || 0) - (Number(a.id) || 0); }); const expensesOnly = trans.filter(t => parseFloat(t.amount) > 0); const totalSpent = expensesOnly.reduce((s, t) => s + parseFloat(t.amount || 0), 0); const bal = getAccountBalance(accountId); const categoryIcons = { 'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Shopping': '🛍️', 'Health': '💊', 'Entertainment': '🎮', 'Education': '📚', 'Utilities': '💡', 'Other': '📌', 'Deposit': '💰' }; const catColors = ['#7c6ef5', '#5de8c1', '#f5a623', '#f5647c', '#64c8f5', '#c87cf5', '#f57c64']; const catTotals = {}; expensesOnly.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount || 0); }); const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]); let html = `<div style="background:linear-gradient(135deg,rgba(124,110,245,0.12),rgba(93,232,193,0.06));border:1px solid rgba(124,110,245,0.25);border-radius:var(--radius);padding:20px;margin-bottom:16px;"><div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Current Balance</div><div style="font-family:'Syne',sans-serif;font-size:38px;font-weight:800;color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};line-height:1;">${bal.toFixed(2)}</div><div style="display:flex;gap:24px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Total Spent</div><div style="font-size:18px;font-weight:700;color:var(--red);margin-top:2px;">-${totalSpent.toFixed(2)}</div></div><div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Transactions</div><div style="font-size:18px;font-weight:700;color:var(--text);margin-top:2px;">${trans.length}</div></div></div></div>`; if (catEntries.length > 0) { html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;"><div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:14px;">Spending by Category</div>`; catEntries.forEach(([cat, amt], i) => { const pct = totalSpent > 0 ? (amt / totalSpent * 100) : 0; const color = catColors[i % catColors.length]; const icon = categoryIcons[cat] || '📌'; html += `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><div style="display:flex;align-items:center;gap:6px;font-size:13px;"><span>${icon}</span><span style="font-weight:500;">${escapeHtml(cat)}</span></div><div><span style="font-size:13px;font-weight:700;color:var(--red);">-${parseFloat(amt).toFixed(2)}</span><span style="font-size:10px;color:var(--text3);margin-left:6px;">${pct.toFixed(0)}%</span></div></div><div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.5s;"></div></div></div>`; }); html += `</div>`; } if (trans.length === 0) { html += `<div class="empty-state"><div class="empty-icon">💸</div><p>No expenses yet.<br>Tap + Expense to add one.</p></div>`; } else { const groups = {}; trans.forEach(t => { const d = t.date || 'Unknown'; if (!groups[d]) groups[d] = []; groups[d].push(t); }); const todayStr = new Date().toISOString().split('T')[0]; Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => { const dayTotal = groups[date].filter(t => t.amount > 0).reduce((s, t) => s + parseFloat(t.amount || 0), 0); let displayDate; try { displayDate = date === todayStr ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { displayDate = date; } html += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;padding:0 4px;"><span>${displayDate}</span><span style="color:var(--red);">-${dayTotal.toFixed(2)}</span></div>`; groups[date].forEach(t => { const isIncome = parseFloat(t.amount) < 0; const displayAmt = Math.abs(parseFloat(t.amount)).toFixed(2); const amtSign = isIncome ? '+' : '-'; const amtColor = isIncome ? 'var(--green)' : 'var(--red)'; const icon = isIncome ? '💰' : (categoryIcons[t.category] || '📌'); let timeDisplay = ''; if (t.time) { const [h, m] = t.time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const dh = h > 12 ? h - 12 : h === 0 ? 12 : h; timeDisplay = `${dh}:${String(m).padStart(2, '0')} ${ampm}`; } html += `<div style="display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;"><div style="width:44px;height:44px;border-radius:12px;background:${isIncome ? 'rgba(93,232,193,0.1)' : 'rgba(245,100,124,0.1)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;">${icon}</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;">${escapeHtml(t.category)}</div><div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.note || 'No note')}</div>${timeDisplay ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;">🕐 ${timeDisplay}</div>` : ''}</div><div style="text-align:right;flex-shrink:0;"><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:${amtColor};">${amtSign}${displayAmt}</div><button data-expense-id="${t.id}" data-account-id="${accountId}" onclick="deleteExpense(this)" style="background:none;border:none;font-size:18px;color:var(--text3);cursor:pointer;margin-top:6px;padding:2px;">🗑</button></div></div>`; }); }); } list.innerHTML = html; }

function handleSharedLink(sharedText) {
    if (!sharedText || !sharedText.trim()) return;

    const text = sharedText.trim();

    // Extract URL if present
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[0] : null;

    // Determine Title
    let title = 'Shared Link';
    if (url) {
        let cleanText = text.replace(url, '').replace(/Check out this video on YouTube/i, '').replace(/[-–—:]+$/, '').trim();
        if (cleanText) {
            title = cleanText;
        } else if (url.includes('youtu.be') || url.includes('youtube.com')) {
            title = 'YouTube Video';
        } else {
            try {
                const domain = new URL(url).hostname.replace(/^www\./, '');
                title = `Link: ${domain}`;
            } catch (e) {
                title = 'Shared Link';
            }
        }
    } else {
        title = text.length > 30 ? text.substring(0, 30) + '...' : text;
    }

    // Ensure 'links' tag exists in customTags
    if (!STATE.customTags) STATE.customTags = [];
    if (!STATE.customTags.includes('links')) {
        STATE.customTags.push('links');
    }

    const now = new Date().toISOString();
    const tempId = Date.now();
    const noteData = {
        id: tempId,
        title: title,
        body: text,
        tags: ['links'],
        pinned: false,
        archived: false,
        trashed: false,
        updatedAt: now
    };

    STATE.notes.unshift(noteData);
    save();

    // Sync to Supabase cloud
    ofetch('add_note.php', noteData, d => {
        const n = STATE.notes.find(x => x.id === tempId);
        if (n) n.id = d.id;
        save();
        if (currentScreen === 'notes') renderNotes();
    });

    // Navigate to Notes screen and activate 'links' tag filter
    navTo('notes');
    setNoteTagFilter('links');
    toast('Link saved to Notes under #links! 🔗');
}

// ===================== NOTES (Google Keep style) =====================
const NOTE_COLORS = ['', '#7c6ef5', '#10b981', '#f59e0b', '#f5647c', '#06b6d4', '#c87cf5', '#f57c64', '#3b82f6'];
let noteChecklistMode = false;
let noteChecklistItems = [];
let noteColor = '';
let notesView = 'active';
let activeNoteTag = 'all';

// Ensure customTags exists in STATE
if (!STATE.customTags) STATE.customTags = [];

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function promptAddNewTag() {
    const t = prompt("Enter a new custom tag:");
    if (t && t.trim()) {
        const tag = t.trim().toLowerCase().replace(/^#+/, '');
        if (!STATE.customTags) STATE.customTags = [];
        if (!STATE.customTags.includes(tag)) {
            STATE.customTags.push(tag);
            save();
            renderNotes();
            toast(`Tag #${tag} added!`);
        }
    }
}

// NEW: Function to delete a tag globally
function deleteNoteTag(e, tagToDelete) {
    e.stopPropagation();
    if (!confirm(`Delete the tag #${tagToDelete}? This will remove it from all your notes.`)) return;

    // 1. Remove from saved custom tags list
    if (STATE.customTags) {
        STATE.customTags = STATE.customTags.filter(t => t !== tagToDelete);
    }

    // 2. Strip it from any existing notes
    STATE.notes.forEach(n => {
        if (n.tags && n.tags.includes(tagToDelete)) {
            n.tags = n.tags.filter(t => t !== tagToDelete);
            // Sync the updated note to the cloud
            ofetch('update_note.php', { id: n.id, tags: n.tags });
        }
    });

    // 3. Reset view if we were currently looking at the deleted tag
    if (activeNoteTag === tagToDelete) activeNoteTag = 'all';

    save();
    renderNotes();
    toast(`Tag #${tagToDelete} deleted.`);
}

function setNoteTagFilter(tag) {
    activeNoteTag = tag;
    renderNotes();
}

function renderNoteModalTags(selectedTags = []) {
    const container = document.getElementById('noteModalTagSelector');
    if (!container) return;

    const allTags = new Set(STATE.customTags || []);
    STATE.notes.forEach(n => { if (n.tags) n.tags.forEach(t => allTags.add(t)); });

    container.innerHTML = Array.from(allTags).map(tag => {
        const isSelected = selectedTags.includes(tag);
        return `<label class="pill ${isSelected ? 'pill-accent' : ''}" style="border:1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; cursor:pointer; font-size:11px; user-select:none; transition: 0.2s;">
                    <input type="checkbox" value="${escapeHtml(tag)}" ${isSelected ? 'checked' : ''} style="display:none;"
                           onchange="this.parentElement.classList.toggle('pill-accent', this.checked); this.parentElement.style.borderColor = this.checked ? 'var(--accent)' : 'var(--border)';">
                    #${escapeHtml(tag)}
                </label>`;
    }).join('');
}

function openNoteModal(id) {
    const modal = document.getElementById('noteModal');
    let currentTags = [];

    if (id) {
        const n = STATE.notes.find(x => x.id === id);
        if (!n) return;
        modal.dataset.editId = n.id;
        document.getElementById('noteTitle').value = n.title || '';
        document.getElementById('noteBody').value = n.body || '';

        currentTags = n.tags || [];
        noteChecklistMode = !!n.checklist;
        noteChecklistItems = n.checklist ? JSON.parse(JSON.stringify(n.checklist)) : [];
        noteColor = n.color || '';
    } else {
        delete modal.dataset.editId;
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteBody').value = '';

        currentTags = [];
        noteChecklistMode = false;
        noteChecklistItems = [];
        noteColor = '';
    }

    renderNoteModalTags(currentTags);
    renderNoteChecklistEditor();
    renderNoteColorPicker();
    if (typeof updateNoteStats === 'function') updateNoteStats();
    modal.classList.add('open');
}

function toggleNoteMode() { noteChecklistMode = !noteChecklistMode; renderNoteChecklistEditor(); }

function addNoteChecklistItem() {
    const input = document.getElementById('noteChecklistInput');
    const text = input.value.trim();
    if (!text) return;
    noteChecklistItems.push({ text, done: false });
    input.value = '';
    renderNoteChecklistEditor();
}
function updateNoteChecklistItemText(idx, newText) {
    if (noteChecklistItems[idx]) {
        noteChecklistItems[idx].text = newText;
    }
}
function removeNoteChecklistItem(idx) { noteChecklistItems.splice(idx, 1); renderNoteChecklistEditor(); }
function toggleNoteChecklistItemEditor(idx) { noteChecklistItems[idx].done = !noteChecklistItems[idx].done; renderNoteChecklistEditor(); }

function renderNoteChecklistEditor() {
    const bodyEl = document.getElementById('noteBody');
    const editorEl = document.getElementById('noteChecklistEditor');
    if (bodyEl) bodyEl.style.display = noteChecklistMode ? 'none' : 'block';
    if (editorEl) editorEl.style.display = noteChecklistMode ? 'block' : 'none';

    const listEl = document.getElementById('noteChecklistItemsList');
    if (listEl) {
        listEl.innerHTML = noteChecklistItems.map((it, i) => `
                <div class="checklist-row">
                    <input type="checkbox" ${it.done ? 'checked' : ''} onchange="toggleNoteChecklistItemEditor(${i})">
                    <input type="text" class="checklist-text-input ${it.done ? 'done' : ''}" value="${escapeHtml(it.text)}" oninput="updateNoteChecklistItemText(${i}, this.value)" placeholder="Checklist item...">
                    <span class="remove-x" onclick="removeNoteChecklistItem(${i})">✕</span>
                </div>`).join('');
    }
    const modeBtn = document.getElementById('noteModeBtn');
    if (modeBtn) modeBtn.textContent = noteChecklistMode ? '📝 Switch to Text' : '☑️ Switch to Checklist';
}

function renderNoteColorPicker() {
    const picker = document.getElementById('noteColorPicker');
    if (picker) {
        picker.innerHTML = NOTE_COLORS.map(c => `
                <div class="color-swatch ${c === noteColor ? 'selected' : ''}"
                     style="background:${c || 'var(--surface2)'}"
                     onclick="pickNoteColor('${c}')"></div>`).join('');
    }
}
function pickNoteColor(c) { noteColor = c; renderNoteColorPicker(); }

function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const body = document.getElementById('noteBody').value.trim();

    const tagsNodeList = document.querySelectorAll('#noteModalTagSelector input[type="checkbox"]:checked');
    const tags = Array.from(tagsNodeList).map(cb => cb.value);

    if (!title && !body && !noteChecklistItems.length && !tags.length) return toast('Note is empty!');

    const modal = document.getElementById('noteModal');
    const editId = modal.dataset.editId ? Number(modal.dataset.editId) : null;
    const now = new Date().toISOString();
    const checklist = noteChecklistMode ? JSON.parse(JSON.stringify(noteChecklistItems)) : null;

    if (editId) {
        const n = STATE.notes.find(x => x.id === editId);
        if (!n) return;
        n.title = title; n.body = noteChecklistMode ? '' : body;
        n.checklist = checklist; n.color = noteColor; n.tags = tags; n.updatedAt = now;
        renderNotes(); closeModal('noteModal'); save();
        ofetch('update_note.php', { id: editId, title: n.title, body: n.body, checklist: n.checklist, tags: n.tags, color: n.color, pinned: n.pinned, archived: n.archived, trashed: n.trashed, updatedAt: now });
    } else {
        const tempId = Date.now();
        const nData = { id: tempId, title, body: noteChecklistMode ? '' : body, checklist, tags, color: noteColor || null, pinned: false, archived: false, trashed: false, updatedAt: now };
        STATE.notes.unshift(nData);
        renderNotes(); closeModal('noteModal'); save();
        toast('Note saved 📝');
        ofetch('add_note.php', nData, d => {
            const n = STATE.notes.find(x => x.id === tempId);
            if (n) n.id = d.id;
            if (STATE.dashConfig.noteId == tempId) STATE.dashConfig.noteId = String(d.id); // Reconcile Pin
            renderNotes(); renderDashboard(); save();
        });
    }
}

function toggleNotePin(e, id) { e.stopPropagation(); const n = STATE.notes.find(x => x.id === id); if (!n) return; n.pinned = !n.pinned; renderNotes(); save(); ofetch('update_note.php', { id, pinned: n.pinned }); }
function toggleNoteArchive(e, id) { e.stopPropagation(); const n = STATE.notes.find(x => x.id === id); if (!n) return; n.archived = !n.archived; n.pinned = false; renderNotes(); save(); toast(n.archived ? 'Note archived 🗄' : 'Note unarchived'); ofetch('update_note.php', { id, archived: n.archived, pinned: n.pinned }); }
function toggleNoteTrash(e, id) { e.stopPropagation(); const n = STATE.notes.find(x => x.id === id); if (!n) return; n.trashed = !n.trashed; n.pinned = false; n.archived = false; renderNotes(); save(); toast(n.trashed ? 'Moved to trash 🗑' : 'Note restored ♻️'); ofetch('update_note.php', { id, trashed: n.trashed, pinned: n.pinned, archived: n.archived }); }
function deleteNoteForever(e, id) { e.stopPropagation(); if (!confirm('Delete this note permanently? This cannot be undone.')) return; STATE.notes = STATE.notes.filter(x => x.id !== id); renderNotes(); save(); toast('Note deleted'); ofetch('delete_note.php', { id }); }
function toggleChecklistItemInline(e, noteId, idx) { e.stopPropagation(); const n = STATE.notes.find(x => x.id === noteId); if (!n || !n.checklist) return; n.checklist[idx].done = !n.checklist[idx].done; renderNotes(); save(); ofetch('update_note.php', { id: noteId, checklist: n.checklist }); }

function setNotesView(v) {
    notesView = v;
    document.querySelectorAll('.notes-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('notesTab-' + v).classList.add('active');
    renderNotes();
}

function renderNotes() {
    const el = document.getElementById('notesGrid');
    const tagsFilterEl = document.getElementById('noteTagsFilter');
    if (!el) return;

    // 1. Build Tag Filter Bar Dynamically with Delete Buttons
    const allTags = new Set(STATE.customTags || []);
    STATE.notes.forEach(n => {
        if (!n.trashed && n.tags) {
            n.tags.forEach(t => allTags.add(t));
        }
    });

    if (tagsFilterEl) {
        let tagsHtml = `<div class="filter-tab ${activeNoteTag === 'all' ? 'active' : ''}" onclick="setNoteTagFilter('all')">All</div>`;
        Array.from(allTags).sort().forEach(tag => {
            tagsHtml += `<div class="filter-tab ${activeNoteTag === tag ? 'active' : ''}" onclick="setNoteTagFilter('${tag}')" style="display:flex; align-items:center; gap:6px;">
                        #${escapeHtml(tag)}
                        <span style="opacity:0.5; font-size:14px; line-height:1;" onclick="deleteNoteTag(event, '${tag}')">✕</span>
                    </div>`;
        });
        tagsFilterEl.innerHTML = tagsHtml;
    }

    // 2. Filter Notes List
    const q = (document.getElementById('noteSearch')?.value || '').toLowerCase();
    let list = STATE.notes.filter(n => {
        if (notesView === 'active') { if (n.archived || n.trashed) return false; }
        else if (notesView === 'archived') { if (!n.archived || n.trashed) return false; }
        else if (notesView === 'trashed') { if (!n.trashed) return false; }

        // LOGIC: Hide 'guitar' tags from 'All' view
        if (activeNoteTag === 'all') {
            if (n.tags && n.tags.includes('guitar')) return false;
        } else {
            // Normal tag filtering
            if (!n.tags || !n.tags.includes(activeNoteTag)) return false;
        }

        return true;
    });

    if (q) list = list.filter(n => (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q) || (n.tags || []).join(' ').includes(q) || (n.checklist || []).some(c => c.text.toLowerCase().includes(q)));
    list = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    if (!list.length) {
        const msg = notesView === 'trashed' ? 'Trash is empty' : notesView === 'archived' ? 'No archived notes' : 'No notes found';
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>${msg}</p></div>`;
        return;
    }

    // 3. Render Cards
    el.innerHTML = list.map(n => {
        if (n.isWhiteboard) {
            const actions = n.trashed ? `<span onclick="toggleNoteTrash(event,${n.id})" title="Restore">♻️</span><span onclick="deleteNoteForever(event,${n.id})" title="Delete forever">🗑</span>` : `<span onclick="toggleNotePin(event,${n.id})" title="Pin">${n.pinned ? '📌' : '📍'}</span><span onclick="toggleNoteArchive(event,${n.id})" title="Archive">🗄</span><span onclick="toggleNoteTrash(event,${n.id})" title="Trash">🗑</span>`;
            return `<div class="note-card" style="border-left:4px solid var(--accent); background:var(--surface2);" onclick="${n.trashed ? '' : `if(typeof openWhiteboardModal === 'function') openWhiteboardModal(${n.id})`}">
                        ${n.pinned ? '<div class="note-pin-badge">📌</div>' : ''}
                        <div class="note-content">
                            <div class="note-title" style="color:var(--accent2);">🎨 ${escapeHtml(n.title)}</div>
                            <div class="note-body">Canvas Note</div>
                        </div>
                        <div class="note-actions">${actions}</div>
                    </div>`;
        }

        // Check if it's a guitar tab so we can apply monospace font
        const isGuitar = n.tags && n.tags.includes('guitar');

        const checklistHtml = n.checklist ? `<div class="note-checklist">${n.checklist.map((c, i) => `<div class="checklist-row" onclick="toggleChecklistItemInline(event,${n.id},${i})"><input type="checkbox" ${c.done ? 'checked' : ''} readonly><span class="${c.done ? 'done' : ''}">${escapeHtml(c.text)}</span></div>`).join('')}</div>` : '';

        // Note body: Applies monospace styling if the tag includes 'guitar'
        const bodyHtml = n.body ? `<div class="note-body" style="${isGuitar ? "font-family: monospace, 'Courier New'; white-space: pre; overflow-x: auto;" : ""}">${escapeHtml(n.body)}</div>` : '';

        const tagsHtml = n.tags && n.tags.length ? `<div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">${n.tags.map(t => `<span class="pill" style="font-size:9px; background:rgba(255,255,255,0.05); color:var(--accent2); border: 1px solid rgba(255,255,255,0.1);">#${t}</span>`).join('')}</div>` : '';
        const actions = n.trashed ? `<span onclick="toggleNoteTrash(event,${n.id})" title="Restore">♻️</span><span onclick="deleteNoteForever(event,${n.id})" title="Delete forever">🗑</span>` : `<span onclick="toggleNotePin(event,${n.id})" title="Pin">${n.pinned ? '📌' : '📍'}</span><span onclick="toggleNoteArchive(event,${n.id})" title="Archive">🗄</span><span onclick="toggleNoteTrash(event,${n.id})" title="Trash">🗑</span>`;

        return `<div class="note-card" style="${n.color ? `background:${n.color}40; border:1px solid ${n.color}bb; box-shadow:0 4px 12px ${n.color}20;` : ''}" onclick="${n.trashed ? '' : `openNoteModal(${n.id})`}">
                ${n.pinned ? '<div class="note-pin-badge">📌</div>' : ''}
                <div class="note-content">
                    ${n.title ? `<div class="note-title">${escapeHtml(n.title)}</div>` : ''}
                    ${bodyHtml}${checklistHtml}${tagsHtml}
                </div>
                <div class="note-actions">${actions}</div>
            </div>`;
    }).join('');
}

// ============================================================
// RICH INFINITE WHITEBOARD ENGINE
// ============================================================
let wbCanvas, wbCtx;
let wbTool = 'pen';
let wbColor = '#000000';
let wbSize = 4;
let wbSizeName = 'M';
let wbLineStyle = 'solid';
let wbFillStyle = 'none';
let isDrawing = false;
let isPanning = false;
let startX = 0, startY = 0;
let drawStartX = 0, drawStartY = 0;
let scale = 1;
let panX = 0, panY = 0;
let activeWbNoteId = null;

let wbActivePage = 0;
let wbPages = [
    { paths: [], shapes: [], texts: [], stickies: [], images: [] }
];

let wbUndoStack = [];
let wbRedoStack = [];

let wbSelectedObjs = [];
let isDraggingGroup = false;
let groupLastDragPos = { x: 0, y: 0 };
let isMarqueeSelecting = false;
let marqueeStartPos = { x: 0, y: 0 };
let marqueeCurrentPos = { x: 0, y: 0 };
let isResizingObj = false;
let resizeLastPos = { x: 0, y: 0 };
let pinchStartDist = 0;

let wbStylePanelCollapsed = false;

const WB_SWATCHES = [
    '#000000', '#6b7280', '#a855f7', '#3b82f6',
    '#06b6d4', '#10b981', '#22c55e', '#f59e0b',
    '#ff6b6b', '#ef4444', '#ffffff'
];

function toggleWbStylePanel() {
    wbStylePanelCollapsed = !wbStylePanelCollapsed;
    const panel = document.getElementById('wbRightPanel');
    const icon = document.getElementById('wbPanelToggleIcon');
    if (panel) {
        if (wbStylePanelCollapsed) panel.classList.add('collapsed');
        else panel.classList.remove('collapsed');
    }
    if (icon) icon.textContent = wbStylePanelCollapsed ? '▲' : '▼';
}

function getCurrentWbPage() {
    if (!wbPages[wbActivePage]) {
        wbPages[wbActivePage] = { paths: [], shapes: [], texts: [], stickies: [], images: [] };
    }
    return wbPages[wbActivePage];
}

function saveWbUndoState() {
    wbUndoStack.push(JSON.parse(JSON.stringify(wbPages)));
    wbRedoStack = [];
}

function undoWb() {
    if (wbUndoStack.length === 0) return toast('Nothing to undo');
    wbRedoStack.push(JSON.parse(JSON.stringify(wbPages)));
    wbPages = wbUndoStack.pop();
    if (wbActivePage >= wbPages.length) wbActivePage = wbPages.length - 1;
    renderWbPageSelect();
    redrawWb();
}

function redoWb() {
    if (wbRedoStack.length === 0) return toast('Nothing to redo');
    wbUndoStack.push(JSON.parse(JSON.stringify(wbPages)));
    wbPages = wbRedoStack.pop();
    if (wbActivePage >= wbPages.length) wbActivePage = wbPages.length - 1;
    renderWbPageSelect();
    redrawWb();
}

function addWbPage() {
    saveWbUndoState();
    wbPages.push({ paths: [], shapes: [], texts: [], stickies: [], images: [] });
    wbActivePage = wbPages.length - 1;
    renderWbPageSelect();
    redrawWb();
    toast(`Page ${wbActivePage + 1} added! 📄`);
}

function changeWbPage(idx) {
    wbActivePage = Math.max(0, Math.min(idx, wbPages.length - 1));
    renderWbPageSelect();
    redrawWb();
}

function renderWbPageSelect() {
    const sel = document.getElementById('wbPageSelect');
    if (!sel) return;
    sel.innerHTML = wbPages.map((_, i) => `<option value="${i}" ${i === wbActivePage ? 'selected' : ''}>Page ${i + 1}</option>`).join('');
}

function renderWbSwatches() {
    const el = document.getElementById('wbColorSwatches');
    if (!el) return;
    el.innerHTML = WB_SWATCHES.map(c => `
        <div class="wb-color-swatch ${c === wbColor ? 'active' : ''}" style="background:${c}; ${c === '#ffffff' ? 'border:1px solid #ccc;' : ''}" onclick="setWbColor('${c}')"></div>
    `).join('');
}

function setWbColor(c) {
    wbColor = c;
    renderWbSwatches();

    if (wbSelectedObjs && wbSelectedObjs.length > 0) {
        saveWbUndoState();
        wbSelectedObjs.forEach(item => {
            const obj = item.obj;
            if (item.type === 'path' || item.type === 'shape' || item.type === 'text') {
                obj.color = c;
            } else if (item.type === 'sticky') {
                obj.bgColor = c;
            }
        });
        redrawWb();
    }
}

function setWbSize(sizeName) {
    wbSizeName = sizeName;
    const sizeMap = { 'S': 2, 'M': 4, 'L': 8, 'XL': 16 };
    wbSize = sizeMap[sizeName] || 4;
    ['S', 'M', 'L', 'XL'].forEach(s => {
        const btn = document.getElementById('wbSize' + s);
        if (btn) btn.className = `wb-size-btn ${s === sizeName ? 'active' : ''}`;
    });
}

function setWbLineStyle(style) {
    wbLineStyle = style;
    ['solid', 'dashed', 'dotted'].forEach(s => {
        const name = s.charAt(0).toUpperCase() + s.slice(1);
        const btn = document.getElementById('wbStyle' + name);
        if (btn) btn.className = `wb-size-btn ${s === style ? 'active' : ''}`;
    });
}

function setWbFillStyle(style) {
    wbFillStyle = style;
    ['none', 'semi', 'solid'].forEach(s => {
        const name = s.charAt(0).toUpperCase() + s.slice(1);
        const btn = document.getElementById('wbFill' + name);
        if (btn) btn.className = `wb-size-btn ${s === style ? 'active' : ''}`;
    });
}

function setWbTool(tool) {
    wbTool = tool;
    wbSelectedObjs = [];

    const tools = ['select', 'pan', 'pen', 'eraser', 'arrow', 'text', 'sticky', 'rect', 'circle'];
    tools.forEach(t => {
        const name = t.charAt(0).toUpperCase() + t.slice(1);
        const btn = document.getElementById('wbTool' + name);
        if (btn) btn.className = `wb-tool-btn ${t === tool ? 'active' : ''}`;
    });

    const container = document.getElementById('wbContainer');
    if (container) {
        if (tool === 'pan') container.style.cursor = 'grab';
        else if (tool === 'select') container.style.cursor = 'default';
        else if (tool === 'text') container.style.cursor = 'text';
        else container.style.cursor = 'crosshair';
    }
    redrawWb();
}

function handleWbImageSelect(files) {
    if (!files || !files.length) return;
    for (let f of files) {
        addWbImageBlob(f);
    }
}

function addWbImageBlob(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            saveWbUndoState();
            const curPage = getCurrentWbPage();
            if (!curPage.images) curPage.images = [];
            let maxDim = 320;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
                else { w = Math.round(w * (maxDim / h)); h = maxDim; }
            }
            const centerX = (-panX + (wbCanvas ? wbCanvas.width / 2 : 300)) / scale - w / 2;
            const centerY = (-panY + (wbCanvas ? wbCanvas.height / 2 : 300)) / scale - h / 2;

            curPage.images.push({
                id: Date.now() + Math.random(),
                src: e.target.result,
                imgObj: img,
                x: centerX,
                y: centerY,
                w: w,
                h: h
            });
            redrawWb();
            toast('Image added! 🖼️');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

window.addEventListener('paste', (e) => {
    const modal = document.getElementById('whiteboardModal');
    if (!modal || !modal.classList.contains('open')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) addWbImageBlob(blob);
        }
    }
});

function openWhiteboardModal(noteId = null) {
    const modal = document.getElementById('whiteboardModal');
    wbCanvas = document.getElementById('wbCanvas');
    wbCtx = wbCanvas.getContext('2d');
    activeWbNoteId = noteId;
    scale = 1; panX = 0; panY = 0;
    wbUndoStack = [];
    wbRedoStack = [];
    wbSelectedObjs = [];

    if (noteId) {
        const n = STATE.notes.find(x => x.id === noteId);
        document.getElementById('wbTitle').value = n.title || 'Untitled Board';
        if (n.wbData) {
            wbActivePage = n.wbData.activePage || 0;
            if (Array.isArray(n.wbData.pages) && n.wbData.pages.length) {
                wbPages = JSON.parse(JSON.stringify(n.wbData.pages));
            } else if (n.wbData.paths || n.wbData.texts) {
                wbPages = [{
                    paths: n.wbData.paths || [],
                    shapes: n.wbData.shapes || [],
                    texts: n.wbData.texts || [],
                    stickies: n.wbData.stickies || [],
                    images: []
                }];
            } else {
                wbPages = [{ paths: [], shapes: [], texts: [], stickies: [], images: [] }];
            }
        } else {
            wbActivePage = 0;
            wbPages = [{ paths: [], shapes: [], texts: [], stickies: [], images: [] }];
        }
    } else {
        document.getElementById('wbTitle').value = 'New Whiteboard';
        wbActivePage = 0;
        wbPages = [{ paths: [], shapes: [], texts: [], stickies: [], images: [] }];
    }

    wbPages.forEach(p => {
        (p.images || []).forEach(imgData => {
            if (imgData.src && !imgData.imgObj) {
                const img = new Image();
                img.onload = () => redrawWb();
                img.src = imgData.src;
                imgData.imgObj = img;
            }
        });
    });

    renderWbSwatches();
    setWbTool('pen');
    setWbSize('M');
    setWbLineStyle('solid');
    setWbFillStyle('none');
    renderWbPageSelect();

    modal.classList.add('open');
    setTimeout(() => {
        const container = document.getElementById('wbContainer');
        wbCanvas.width = container.clientWidth;
        wbCanvas.height = container.clientHeight;
        initWbEvents();
        redrawWb();
    }, 350);
}

function zoomWb(factor) {
    scale *= factor;
    scale = Math.max(0.2, Math.min(scale, 5));
    const zoomEl = document.getElementById('wbZoomLevel');
    if (zoomEl) zoomEl.textContent = `${Math.round(scale * 100)}%`;
    redrawWb();
}

function resetWbView() {
    scale = 1;
    panX = 0;
    panY = 0;
    const zoomEl = document.getElementById('wbZoomLevel');
    if (zoomEl) zoomEl.textContent = '100%';
    redrawWb();
}

function clearWbCanvas() {
    if (!confirm('Clear canvas on this page?')) return;
    saveWbUndoState();
    const cur = getCurrentWbPage();
    cur.paths = [];
    cur.shapes = [];
    cur.texts = [];
    cur.stickies = [];
    cur.images = [];
    wbSelectedObjs = [];
    redrawWb();
}

function exportWbImage() {
    if (!wbCanvas) return;
    const off = document.createElement('canvas');
    off.width = wbCanvas.width;
    off.height = wbCanvas.height;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);

    ctx.drawImage(wbCanvas, 0, 0);

    const title = document.getElementById('wbTitle').value.trim() || 'whiteboard';
    const filename = `${title.toLowerCase().replace(/\s+/g, '_')}_page${wbActivePage + 1}.png`;
    const dataUrl = off.toDataURL('image/png');

    if (window.AndroidInterface && typeof window.AndroidInterface.downloadBase64File === 'function') {
        window.AndroidInterface.downloadBase64File(dataUrl, filename, 'image/png');
        toast('Saved whiteboard to Downloads! 📥');
        return;
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Exported PNG! 📷');
}

function findWbObjectAt(pos) {
    const curPage = getCurrentWbPage();

    if (curPage.images) {
        for (let i = curPage.images.length - 1; i >= 0; i--) {
            const img = curPage.images[i];
            if (pos.x >= img.x && pos.x <= img.x + img.w && pos.y >= img.y && pos.y <= img.y + img.h) {
                return { obj: img, type: 'image' };
            }
        }
    }

    if (curPage.stickies) {
        for (let i = curPage.stickies.length - 1; i >= 0; i--) {
            const st = curPage.stickies[i];
            const w = st.w || 140; const h = st.h || 140;
            if (pos.x >= st.x && pos.x <= st.x + w && pos.y >= st.y && pos.y <= st.y + h) {
                return { obj: st, type: 'sticky' };
            }
        }
    }

    if (curPage.texts) {
        for (let i = curPage.texts.length - 1; i >= 0; i--) {
            const t = curPage.texts[i];
            const size = t.size || 18;
            if (Math.hypot(t.x - pos.x, t.y - pos.y) < size * 2) {
                return { obj: t, type: 'text' };
            }
        }
    }

    if (curPage.shapes) {
        for (let i = curPage.shapes.length - 1; i >= 0; i--) {
            const s = curPage.shapes[i];
            if (s.type === 'arrow') {
                if (Math.hypot(s.x1 - pos.x, s.y1 - pos.y) < 25 || Math.hypot(s.x2 - pos.x, s.y2 - pos.y) < 25) {
                    return { obj: s, type: 'shape' };
                }
            } else {
                const minX = Math.min(s.x, s.x + s.w); const maxX = Math.max(s.x, s.x + s.w);
                const minY = Math.min(s.y, s.y + s.h); const maxY = Math.max(s.y, s.y + s.h);
                if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
                    return { obj: s, type: 'shape' };
                }
            }
        }
    }

    if (curPage.paths) {
        for (let i = curPage.paths.length - 1; i >= 0; i--) {
            const p = curPage.paths[i];
            if (p.points && p.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < 15)) {
                return { obj: p, type: 'path' };
            }
        }
    }

    return null;
}

function findWbObjectsInBox(p1, p2) {
    const curPage = getCurrentWbPage();
    const result = [];
    const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);

    function intersects(x, y, w, h) {
        return (x + w >= minX && x <= maxX && y + h >= minY && y <= maxY);
    }

    (curPage.images || []).forEach(img => {
        if (intersects(img.x, img.y, img.w, img.h)) result.push({ obj: img, type: 'image' });
    });

    (curPage.stickies || []).forEach(st => {
        if (intersects(st.x, st.y, st.w || 140, st.h || 140)) result.push({ obj: st, type: 'sticky' });
    });

    (curPage.texts || []).forEach(t => {
        const size = t.size || 18;
        if (intersects(t.x, t.y - size, size * 5, size)) result.push({ obj: t, type: 'text' });
    });

    (curPage.shapes || []).forEach(s => {
        if (s.type === 'arrow') {
            const sx = Math.min(s.x1, s.x2); const sw = Math.abs(s.x2 - s.x1);
            const sy = Math.min(s.y1, s.y2); const sh = Math.abs(s.y2 - s.y1);
            if (intersects(sx, sy, sw, sh)) result.push({ obj: s, type: 'shape' });
        } else {
            const sx = Math.min(s.x, s.x + s.w); const sw = Math.abs(s.w);
            const sy = Math.min(s.y, s.y + s.h); const sh = Math.abs(s.h);
            if (intersects(sx, sy, sw, sh)) result.push({ obj: s, type: 'shape' });
        }
    });

    (curPage.paths || []).forEach(p => {
        if (p.points && p.points.some(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY)) {
            result.push({ obj: p, type: 'path' });
        }
    });

    return result;
}

function drawWbItemBoundingBox(ctx, item) {
    const obj = item.obj;
    if (item.type === 'image') {
        ctx.strokeRect(obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4);
    } else if (item.type === 'sticky') {
        ctx.strokeRect(obj.x - 2, obj.y - 2, (obj.w || 140) + 4, (obj.h || 140) + 4);
    } else if (item.type === 'text') {
        const fontH = obj.size || 18;
        const metrics = ctx.measureText(obj.text || '');
        ctx.strokeRect(obj.x - 2, obj.y - fontH, metrics.width + 4, fontH + 6);
    } else if (item.type === 'shape') {
        if (obj.type === 'arrow') {
            ctx.strokeRect(Math.min(obj.x1, obj.x2) - 4, Math.min(obj.y1, obj.y2) - 4, Math.abs(obj.x2 - obj.x1) + 8, Math.abs(obj.y2 - obj.y1) + 8);
        } else {
            ctx.strokeRect(Math.min(obj.x, obj.x + obj.w) - 4, Math.min(obj.y, obj.y + obj.h) - 4, Math.abs(obj.w) + 8, Math.abs(obj.h) + 8);
        }
    } else if (item.type === 'path') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        (obj.points || []).forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });
        if (minX !== Infinity) {
            ctx.strokeRect(minX - 4, minY - 4, (maxX - minX) + 8, (maxY - minY) + 8);
        }
    }
}

function getWbGroupBounds(items) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(item => {
        const obj = item.obj;
        if (item.type === 'image' || item.type === 'sticky') {
            const w = obj.w || 140; const h = obj.h || 140;
            minX = Math.min(minX, obj.x); maxX = Math.max(maxX, obj.x + w);
            minY = Math.min(minY, obj.y); maxY = Math.max(maxY, obj.y + h);
        } else if (item.type === 'text') {
            const size = obj.size || 18;
            minX = Math.min(minX, obj.x); maxX = Math.max(maxX, obj.x + size * 4);
            minY = Math.min(minY, obj.y - size); maxY = Math.max(maxY, obj.y);
        } else if (item.type === 'shape') {
            if (obj.type === 'arrow') {
                minX = Math.min(minX, obj.x1, obj.x2); maxX = Math.max(maxX, obj.x1, obj.x2);
                minY = Math.min(minY, obj.y1, obj.y2); maxY = Math.max(maxY, obj.y1, obj.y2);
            } else {
                minX = Math.min(minX, obj.x, obj.x + obj.w); maxX = Math.max(maxX, obj.x, obj.x + obj.w);
                minY = Math.min(minY, obj.y, obj.y + obj.h); maxY = Math.max(maxY, obj.y, obj.y + obj.h);
            }
        } else if (item.type === 'path') {
            (obj.points || []).forEach(pt => {
                minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
                minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
            });
        }
    });
    if (minX === Infinity) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function initWbEvents() {
    const container = document.getElementById('wbContainer');
    const getPos = (e) => {
        const rect = wbCanvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return {
            x: (clientX - rect.left - panX) / scale,
            y: (clientY - rect.top - panY) / scale
        };
    };

    const startAction = (e) => {
        if (e.target.closest('.wb-dock-bottom, .wb-dock-right, button, select, input')) {
            return;
        }

        if (e.touches && e.touches.length === 2) {
            isDrawing = false;
            isPanning = false;
            pinchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            return;
        }

        if (e.button === 1 || wbTool === 'pan' || (e.touches && e.touches.length > 2)) {
            isPanning = true;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX - panX;
            startY = clientY - panY;
            container.style.cursor = 'grabbing';
            return;
        }

        const pos = getPos(e);
        const curPage = getCurrentWbPage();

        if (wbTool === 'select') {
            // Check if user clicked on corner resize handle of single selection
            if (wbSelectedObjs && wbSelectedObjs.length === 1) {
                const bounds = getWbGroupBounds(wbSelectedObjs);
                if (bounds) {
                    const handleX = bounds.x + bounds.w + 4;
                    const handleY = bounds.y + bounds.h + 4;
                    if (Math.hypot(pos.x - handleX, pos.y - handleY) < 18 / scale) {
                        isResizingObj = true;
                        resizeLastPos = pos;
                        return;
                    }
                }
            }

            const found = findWbObjectAt(pos);
            if (found) {
                const isAlreadySelected = wbSelectedObjs.some(item => item.obj === found.obj);
                if (e.shiftKey) {
                    if (isAlreadySelected) {
                        wbSelectedObjs = wbSelectedObjs.filter(item => item.obj !== found.obj);
                    } else {
                        wbSelectedObjs.push(found);
                    }
                } else if (!isAlreadySelected) {
                    wbSelectedObjs = [found];
                }
                isDraggingGroup = true;
                groupLastDragPos = pos;
            } else {
                if (!e.shiftKey) {
                    wbSelectedObjs = [];
                }
                isMarqueeSelecting = true;
                marqueeStartPos = pos;
                marqueeCurrentPos = pos;
            }
            redrawWb();
            return;
        }

        if (wbTool === 'text') {
            const txt = prompt('Enter text:');
            if (txt && txt.trim()) {
                saveWbUndoState();
                if (!curPage.texts) curPage.texts = [];
                curPage.texts.push({
                    text: txt.trim(),
                    x: pos.x,
                    y: pos.y,
                    color: wbColor,
                    size: wbSize * 4.5
                });
                redrawWb();
            }
            setWbTool('select');
            return;
        }

        if (wbTool === 'sticky') {
            const txt = prompt('Enter sticky note text:');
            if (txt && txt.trim()) {
                saveWbUndoState();
                if (!curPage.stickies) curPage.stickies = [];
                const stickyColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];
                const randomBg = stickyColors[Math.floor(Math.random() * stickyColors.length)];
                curPage.stickies.push({
                    text: txt.trim(),
                    x: pos.x - 70,
                    y: pos.y - 70,
                    w: 140,
                    h: 140,
                    color: '#1e293b',
                    bgColor: randomBg
                });
                redrawWb();
            }
            setWbTool('select');
            return;
        }

        if (wbTool === 'eraser') {
            saveWbUndoState();
            eraseWbAtPos(pos.x, pos.y);
            isDrawing = true;
            return;
        }

        saveWbUndoState();
        isDrawing = true;
        drawStartX = pos.x;
        drawStartY = pos.y;

        if (wbTool === 'pen') {
            if (!curPage.paths) curPage.paths = [];
            curPage.paths.push({
                color: wbColor,
                size: wbSize,
                lineStyle: wbLineStyle,
                points: [{ x: pos.x, y: pos.y }]
            });
        } else if (['rect', 'circle', 'arrow'].includes(wbTool)) {
            if (!curPage.shapes) curPage.shapes = [];
            curPage.shapes.push({
                type: wbTool,
                x: pos.x,
                y: pos.y,
                w: 0,
                h: 0,
                x1: pos.x,
                y1: pos.y,
                x2: pos.x,
                y2: pos.y,
                color: wbColor,
                size: wbSize,
                lineStyle: wbLineStyle,
                fillStyle: wbFillStyle
            });
        }
    };

    const moveAction = (e) => {
        if (e.touches && e.touches.length === 2 && pinchStartDist > 0) {
            e.preventDefault();
            const newDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = newDist / pinchStartDist;
            pinchStartDist = newDist;
            zoomWb(factor);
            return;
        }

        if (isPanning) {
            e.preventDefault();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            panX = clientX - startX;
            panY = clientY - startY;
            redrawWb();
            return;
        }

        if (isResizingObj && wbSelectedObjs && wbSelectedObjs.length === 1) {
            e.preventDefault();
            const pos = getPos(e);
            const dx = pos.x - resizeLastPos.x;
            const dy = pos.y - resizeLastPos.y;
            resizeLastPos = pos;

            const item = wbSelectedObjs[0];
            const obj = item.obj;

            if (item.type === 'image') {
                obj.w = Math.max(30, obj.w + dx);
                obj.h = Math.max(30, obj.h + dy);
            } else if (item.type === 'sticky') {
                obj.w = Math.max(60, (obj.w || 140) + dx);
                obj.h = Math.max(60, (obj.h || 140) + dy);
            } else if (item.type === 'text') {
                obj.size = Math.max(10, (obj.size || 18) + dx * 0.3);
            } else if (item.type === 'shape') {
                if (obj.type === 'arrow') {
                    obj.x2 += dx; obj.y2 += dy;
                } else {
                    obj.w += dx; obj.h += dy;
                }
            } else if (item.type === 'path') {
                let minX = Infinity, maxX = -Infinity;
                (obj.points || []).forEach(pt => {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.x > maxX) maxX = pt.x;
                });
                const currentWidth = Math.max(10, maxX - minX);
                const scaleX = (currentWidth + dx) / currentWidth;
                (obj.points || []).forEach(pt => {
                    pt.x = minX + (pt.x - minX) * scaleX;
                });
            }
            redrawWb();
            return;
        }

        if (isDraggingGroup && wbSelectedObjs.length > 0) {
            e.preventDefault();
            const pos = getPos(e);
            const dx = pos.x - groupLastDragPos.x;
            const dy = pos.y - groupLastDragPos.y;
            groupLastDragPos = pos;

            wbSelectedObjs.forEach(item => {
                const obj = item.obj;
                if (item.type === 'path') {
                    (obj.points || []).forEach(pt => { pt.x += dx; pt.y += dy; });
                } else if (item.type === 'shape' && obj.type === 'arrow') {
                    obj.x1 += dx; obj.y1 += dy;
                    obj.x2 += dx; obj.y2 += dy;
                } else {
                    obj.x = (obj.x || 0) + dx;
                    obj.y = (obj.y || 0) + dy;
                }
            });
            redrawWb();
            return;
        }

        if (isMarqueeSelecting) {
            e.preventDefault();
            const pos = getPos(e);
            marqueeCurrentPos = pos;
            wbSelectedObjs = findWbObjectsInBox(marqueeStartPos, marqueeCurrentPos);
            redrawWb();
            return;
        }

        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        const curPage = getCurrentWbPage();

        if (wbTool === 'eraser') {
            eraseWbAtPos(pos.x, pos.y);
            redrawWb();
            return;
        }

        if (wbTool === 'pen') {
            const currentPath = curPage.paths[curPage.paths.length - 1];
            if (currentPath) {
                currentPath.points.push({ x: pos.x, y: pos.y });
                redrawWb();
            }
        } else if (['rect', 'circle', 'arrow'].includes(wbTool)) {
            const currentShape = curPage.shapes[curPage.shapes.length - 1];
            if (currentShape) {
                if (wbTool === 'arrow') {
                    currentShape.x2 = pos.x;
                    currentShape.y2 = pos.y;
                } else {
                    currentShape.w = pos.x - drawStartX;
                    currentShape.h = pos.y - drawStartY;
                }
                redrawWb();
            }
        }
    };

    const endAction = () => {
        isDrawing = false;
        isPanning = false;
        isDraggingGroup = false;
        isMarqueeSelecting = false;
        isResizingObj = false;
        pinchStartDist = 0;
        container.style.cursor = wbTool === 'pan' ? 'grab' : wbTool === 'select' ? 'default' : wbTool === 'text' ? 'text' : 'crosshair';
    };

    container.onmousedown = startAction;
    container.onmousemove = moveAction;
    container.onmouseup = container.onmouseleave = endAction;
    container.ontouchstart = startAction;
    container.ontouchmove = moveAction;
    container.ontouchend = container.ontouchcancel = endAction;
    container.onwheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        zoomWb(zoomFactor);
    };
}

function eraseWbAtPos(x, y) {
    const curPage = getCurrentWbPage();
    const threshold = 20 / scale;

    if (curPage.paths) {
        curPage.paths = curPage.paths.filter(p => {
            return !p.points.some(pt => Math.hypot(pt.x - x, pt.y - y) < threshold);
        });
    }

    if (curPage.shapes) {
        curPage.shapes = curPage.shapes.filter(s => {
            if (s.type === 'arrow') {
                const d1 = Math.hypot(s.x1 - x, s.y1 - y);
                const d2 = Math.hypot(s.x2 - x, s.y2 - y);
                return d1 > threshold && d2 > threshold;
            }
            return !(x >= Math.min(s.x, s.x + s.w) && x <= Math.max(s.x, s.x + s.w) &&
                     y >= Math.min(s.y, s.y + s.h) && y <= Math.max(s.y, s.y + s.h));
        });
    }

    if (curPage.texts) {
        curPage.texts = curPage.texts.filter(t => Math.hypot(t.x - x, t.y - y) > threshold * 1.5);
    }

    if (curPage.stickies) {
        curPage.stickies = curPage.stickies.filter(st => {
            return !(x >= st.x && x <= st.x + (st.w || 140) && y >= st.y && y <= st.y + (st.h || 140));
        });
    }

    if (curPage.images) {
        curPage.images = curPage.images.filter(img => {
            return !(x >= img.x && x <= img.x + img.w && y >= img.y && y <= img.y + img.h);
        });
    }
}

function drawWbArrow(ctx, x1, y1, x2, y2, color, size) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(12, size * 2.5);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function wrapWbText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = (text || '').split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

function redrawWb() {
    if (!wbCtx) return;
    wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
    wbCtx.save();

    wbCtx.translate(panX, panY);
    wbCtx.scale(scale, scale);

    const currentPage = getCurrentWbPage();

    // 1. Render Images
    (currentPage.images || []).forEach(imgData => {
        if (imgData.imgObj && imgData.imgObj.complete) {
            wbCtx.drawImage(imgData.imgObj, imgData.x, imgData.y, imgData.w, imgData.h);
        }
    });

    // 2. Render Shapes (rect, circle, arrow)
    (currentPage.shapes || []).forEach(shape => {
        wbCtx.save();
        wbCtx.strokeStyle = shape.color;
        wbCtx.lineWidth = shape.size;

        if (shape.lineStyle === 'dashed') wbCtx.setLineDash([10, 8]);
        else if (shape.lineStyle === 'dotted') wbCtx.setLineDash([3, 6]);
        else wbCtx.setLineDash([]);

        if (shape.type === 'rect') {
            if (shape.fillStyle === 'solid') {
                wbCtx.fillStyle = shape.color;
                wbCtx.fillRect(shape.x, shape.y, shape.w, shape.h);
            } else if (shape.fillStyle === 'semi') {
                wbCtx.fillStyle = shape.color + '44';
                wbCtx.fillRect(shape.x, shape.y, shape.w, shape.h);
            }
            wbCtx.strokeRect(shape.x, shape.y, shape.w, shape.h);
        } else if (shape.type === 'circle') {
            const rx = shape.w / 2;
            const ry = shape.h / 2;
            const cx = shape.x + rx;
            const cy = shape.y + ry;
            wbCtx.beginPath();
            wbCtx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
            if (shape.fillStyle === 'solid') {
                wbCtx.fillStyle = shape.color;
                wbCtx.fill();
            } else if (shape.fillStyle === 'semi') {
                wbCtx.fillStyle = shape.color + '44';
                wbCtx.fill();
            }
            wbCtx.stroke();
        } else if (shape.type === 'arrow') {
            drawWbArrow(wbCtx, shape.x1, shape.y1, shape.x2, shape.y2, shape.color, shape.size);
        }
        wbCtx.restore();
    });

    // 3. Render Stickies
    (currentPage.stickies || []).forEach(st => {
        wbCtx.save();
        wbCtx.shadowColor = 'rgba(0,0,0,0.15)';
        wbCtx.shadowBlur = 8;
        wbCtx.shadowOffsetY = 4;

        wbCtx.fillStyle = st.bgColor || '#fef08a';
        wbCtx.fillRect(st.x, st.y, st.w || 140, st.h || 140);
        wbCtx.shadowColor = 'transparent';

        wbCtx.fillStyle = st.color || '#1e293b';
        wbCtx.font = "14px 'Syne', sans-serif";
        wrapWbText(wbCtx, st.text, st.x + 12, st.y + 24, (st.w || 140) - 24, 18);
        wbCtx.restore();
    });

    // 4. Render Freehand Paths
    (currentPage.paths || []).forEach(path => {
        if (!path.points || path.points.length < 1) return;
        wbCtx.save();
        wbCtx.beginPath();
        wbCtx.strokeStyle = path.color;
        wbCtx.lineWidth = path.size;
        wbCtx.lineCap = 'round';
        wbCtx.lineJoin = 'round';

        if (path.lineStyle === 'dashed') wbCtx.setLineDash([10, 8]);
        else if (path.lineStyle === 'dotted') wbCtx.setLineDash([3, 6]);

        wbCtx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
            wbCtx.lineTo(path.points[i].x, path.points[i].y);
        }
        wbCtx.stroke();
        wbCtx.restore();
    });

    // 5. Render Texts
    (currentPage.texts || []).forEach(t => {
        wbCtx.save();
        wbCtx.font = `${t.size || 18}px 'Syne', sans-serif`;
        wbCtx.fillStyle = t.color;
        wbCtx.fillText(t.text, t.x, t.y);
        wbCtx.restore();
    });

    // 6. Render Marquee Drag Selection Box
    if (isMarqueeSelecting && marqueeStartPos && marqueeCurrentPos) {
        wbCtx.save();
        wbCtx.strokeStyle = '#3b82f6';
        wbCtx.fillStyle = 'rgba(59, 130, 246, 0.12)';
        wbCtx.lineWidth = 1.5 / scale;
        const mx = Math.min(marqueeStartPos.x, marqueeCurrentPos.x);
        const my = Math.min(marqueeStartPos.y, marqueeCurrentPos.y);
        const mw = Math.abs(marqueeCurrentPos.x - marqueeStartPos.x);
        const mh = Math.abs(marqueeCurrentPos.y - marqueeStartPos.y);
        wbCtx.fillRect(mx, my, mw, mh);
        wbCtx.strokeRect(mx, my, mw, mh);
        wbCtx.restore();
    }

    // 7. Render Group Selection Bounding Boxes & Resize Corner Handle
    if (wbSelectedObjs && wbSelectedObjs.length > 0) {
        wbCtx.save();
        wbCtx.strokeStyle = '#3b82f6';
        wbCtx.lineWidth = 2 / scale;
        wbCtx.setLineDash([6, 4]);

        wbSelectedObjs.forEach(item => {
            drawWbItemBoundingBox(wbCtx, item);
        });

        const bounds = getWbGroupBounds(wbSelectedObjs);
        if (bounds) {
            if (wbSelectedObjs.length > 1) {
                wbCtx.strokeStyle = '#2563eb';
                wbCtx.lineWidth = 2 / scale;
                wbCtx.setLineDash([]);
                wbCtx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
            }

            // Draw Resize Handle at bottom-right corner for selection
            wbCtx.fillStyle = '#2563eb';
            wbCtx.strokeStyle = '#ffffff';
            wbCtx.lineWidth = 2 / scale;
            wbCtx.setLineDash([]);
            wbCtx.beginPath();
            wbCtx.arc(bounds.x + bounds.w + 4, bounds.y + bounds.h + 4, 7 / scale, 0, Math.PI * 2);
            wbCtx.fill();
            wbCtx.stroke();
        }
        wbCtx.restore();
    }

    wbCtx.restore();
}

function saveWhiteboardNote() {
    const title = document.getElementById('wbTitle').value.trim() || 'Untitled Board';
    const now = new Date().toISOString();

    const serializablePages = wbPages.map(p => ({
        paths: p.paths || [],
        shapes: p.shapes || [],
        texts: p.texts || [],
        stickies: p.stickies || [],
        images: (p.images || []).map(img => ({
            id: img.id,
            src: img.src,
            x: img.x,
            y: img.y,
            w: img.w,
            h: img.h
        }))
    }));

    const wbData = {
        activePage: wbActivePage,
        pages: serializablePages
    };

    if (activeWbNoteId) {
        const n = STATE.notes.find(x => x.id === activeWbNoteId);
        if (n) {
            n.title = title;
            n.wbData = wbData;
            n.updatedAt = now;
            save();
            renderNotes();
            ofetch('update_note.php', { id: n.id, title: n.title, isWhiteboard: true, wbData: n.wbData, updatedAt: now });
        }
    } else {
        const tempId = Date.now();
        const nData = {
            id: tempId,
            title: title,
            body: '[Whiteboard Note]',
            isWhiteboard: true,
            wbData: wbData,
            pinned: false,
            archived: false,
            trashed: false,
            updatedAt: now
        };
        STATE.notes.unshift(nData);
        save();
        renderNotes();
        ofetch('add_note.php', nData, d => {
            const n = STATE.notes.find(x => x.id === tempId);
            if (n) n.id = d.id;
            save();
            renderNotes();
        });
    }
    closeModal('whiteboardModal');
    toast('Whiteboard saved! 🎨');
}

// ============================================================
// SLEEP TRACKER
// ============================================================
function computeSleepDuration(bed, wake) { const [bh, bm] = bed.split(':').map(Number); const [wh, wm] = wake.split(':').map(Number); let diff = (wh * 60 + wm) - (bh * 60 + bm); if (diff <= 0) diff += 24 * 60; return diff; }
function sleepQuality(mins, bedtime) { const hours = mins / 60; const bh = Number(bedtime.split(':')[0]); const isLate = bh >= 0 && bh < 4; let label, tag; if (hours < 6) { label = 'Too little sleep'; tag = 'low'; } else if (hours > 9.5) { label = 'Too much sleep'; tag = 'high'; } else { label = 'Good sleep'; tag = 'good'; } if (isLate) label += ' • Late bedtime'; return { label, tag, isLate, hours }; }
function openSleepModal() { document.getElementById('sleepDate').value = fmtDate(new Date()); document.getElementById('sleepBed').value = '23:00'; document.getElementById('sleepWake').value = '07:00'; document.getElementById('sleepModal').classList.add('open'); }
function saveSleepLog() { const date = document.getElementById('sleepDate').value; const bedtime = document.getElementById('sleepBed').value; const wake = document.getElementById('sleepWake').value; if (!date || !bedtime || !wake) return toast('Fill in all fields!'); const durationMins = computeSleepDuration(bedtime, wake); const tempId = Date.now(); const sData = { id: tempId, date, bedtime, wake, durationMins }; STATE.sleepLogs.push(sData); renderSleep(); closeModal('sleepModal'); save(); toast('Sleep logged 😴'); ofetch('add_sleep.php', sData, d => { const s = STATE.sleepLogs.find(x => x.id === tempId); if (s) s.id = d.id; renderSleep(); save(); }); }
function deleteSleepLog(id) { if (!confirm("Delete this diary entry?")) return; STATE.sleepLogs = STATE.sleepLogs.filter(x => x.id !== id); renderSleep(); save(); toast('Entry deleted'); ofetch('delete_sleep.php', { id }); }
function renderSleepChart(containerId, entries, maxHours) { maxHours = maxHours || 12; const el = document.getElementById(containerId); if (!el) return; if (!entries.length) { el.innerHTML = '<div class="empty-state" style="padding:16px 0"><p style="font-size:13px">No data yet</p></div>'; return; } const barW = entries.length > 14 ? '3px' : '10%'; el.innerHTML = `<div class="sleep-chart"><div class="sleep-ideal-line" style="bottom:${Math.min(95, (8 / maxHours) * 100)}%"></div>${entries.map(e => { const pct = Math.min(100, (e.hours / maxHours) * 100); const color = e.tag === 'good' ? 'var(--accent2)' : e.tag === 'low' ? 'var(--accent4)' : 'var(--accent3)'; return `<div class="sleep-bar-col" title="${e.date}: ${e.hours.toFixed(1)}h — ${e.label}"><div class="sleep-bar" style="height:${pct}%; background:${color}; width:${barW}"></div>${entries.length <= 14 ? `<div class="sleep-bar-label">${e.dateLabel}</div>` : ''}</div>`; }).join('')}</div>`; }
function getAvgTime(timeArray) { if (!timeArray.length) return '—'; let totalMins = 0; timeArray.forEach(t => { const [h, m] = t.split(':').map(Number); let shiftedH = h < 12 ? h + 24 : h; totalMins += (shiftedH * 60) + m; }); let avgMins = Math.round(totalMins / timeArray.length) % 1440; const h = Math.floor(avgMins / 60) % 24; const m = avgMins % 60; const ampm = h >= 12 ? 'PM' : 'AM'; const dispH = h % 12 === 0 ? 12 : h % 12; return `${dispH}:${String(m).padStart(2, '0')} ${ampm}`; }
function renderSleep() { if (!document.getElementById('sleepMeterCard')) return; const sorted = [...STATE.sleepLogs].sort((a, b) => a.date.localeCompare(b.date)); const withQuality = sorted.map(e => ({ ...e, ...sleepQuality(e.durationMins, e.bedtime), dateLabel: fmtDisplay(e.date) })); const last7 = withQuality.slice(-7); const last30 = withQuality.slice(-30); const avg = arr => arr.length ? (arr.reduce((s, e) => s + e.hours, 0) / arr.length) : 0; const latest = withQuality[withQuality.length - 1]; const meterEl = document.getElementById('sleepMeterCard'); if (!latest) { meterEl.innerHTML = '<div class="empty-state"><div class="empty-icon">😴</div><p>Log your first night to see your sleep meter</p></div>'; } else { const color = latest.tag === 'good' ? 'var(--accent2)' : latest.tag === 'low' ? 'var(--accent4)' : 'var(--accent3)'; meterEl.innerHTML = `<div class="stat-card"><div style="font-size:13px;color:var(--text2)">Last logged night (${fmtDisplay(latest.date)})</div><div style="font-size:30px;font-weight:800;margin:6px 0;">${latest.hours.toFixed(1)}h</div><div style="color:${color};font-weight:700">${latest.label}</div><div style="font-size:12px;color:var(--text2);margin-top:6px">🛏 ${latest.bedtime} → ⏰ ${latest.wake}</div></div>`; } document.getElementById('sleepAvgWeek').textContent = last7.length ? avg(last7).toFixed(1) + 'h' : '—'; document.getElementById('sleepAvgMonth').textContent = last30.length ? avg(last30).toFixed(1) + 'h' : '—'; const bedtimes = last7.map(e => e.bedtime); const waketimes = last7.map(e => e.wake); if (document.getElementById('sleepAvgBed')) document.getElementById('sleepAvgBed').textContent = getAvgTime(bedtimes); if (document.getElementById('sleepAvgWake')) document.getElementById('sleepAvgWake').textContent = getAvgTime(waketimes); renderSleepChart('sleepWeekChart', last7, 12); renderSleepChart('sleepMonthChart', last30, 12); const listEl = document.getElementById('sleepList'); if (listEl) { if (!withQuality.length) { listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">😴</div><p>No sleep logs yet</p></div>'; } else { const color = e => e.tag === 'good' ? 'var(--accent2)' : e.tag === 'low' ? 'var(--accent4)' : 'var(--accent3)'; listEl.innerHTML = [...withQuality].reverse().map(e => `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700">${fmtDisplay(e.date)}</div><div style="font-size:12px;color:var(--text2)">🛏 ${e.bedtime} → ⏰ ${e.wake} · ${e.hours.toFixed(1)}h</div><div style="font-size:12px;color:${color(e)}">${e.label}</div></div><span onclick="deleteSleepLog(${e.id})" style="color:var(--text3);cursor:pointer;font-size:16px">🗑</span></div>`).join(''); } } }

// ============================================================
// EXPORT / IMPORT
// ============================================================
function exportData() { const localData = { ...STATE }; delete localData.syncQueue; const uri = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localData)); const a = document.createElement('a'); a.href = uri; a.download = 'lifeeasy_supabase_backup.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Backup Exported Locally! 💾'); }
function importData(event) { const file = event.target.files[0]; if (!file) return; toast('Reading backup file...'); const reader = new FileReader(); reader.onload = async e => { try { const jsonData = JSON.parse(e.target.result); Object.assign(STATE, jsonData); save(); toast('Local cache restored! Uploading modifications...'); setTimeout(() => location.reload(), 1500); } catch { toast('Invalid backup file! ❌'); } }; reader.readAsText(file); event.target.value = ''; }

// ============================================================
// COLOR PICKERS & NOTIFICATIONS
// ============================================================
document.querySelectorAll('.modal-overlay').forEach(m => { m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }); });
function initColorPickers() { const pickers = { plan: 'planColorPicker', counter: 'counterColorPicker', roadmap: 'roadmapColorPicker' }; Object.entries(pickers).forEach(([key, id]) => { const el = document.getElementById(id); if (!el) return; el.innerHTML = COLORS.map(c => `<div class="color-opt ${c === selectedColors[key] ? 'selected' : ''}" style="background:${c}" onclick="selectColor('${key}','${c}',this)"></div>`).join(''); }); }
function selectColor(key, color, el) { selectedColors[key] = color; el.parentElement.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected')); el.classList.add('selected'); }
const reminderTimers = {};
function scheduleReminderToast(task) { if (reminderTimers[task.id]) clearTimeout(reminderTimers[task.id]); if (!task.reminder) return; const diff = new Date(task.reminder) - new Date(); if (diff > 0 && diff < 86400000) { reminderTimers[task.id] = setTimeout(() => sendSystemNotification("Task Reminder", task.title), diff); } }
function rescheduleAllReminders() {
    STATE.tasks.forEach(t => { if (t.reminder && !t.completed) scheduleReminderToast(t); });
    if (typeof rescheduleAllDailyReminders === 'function') rescheduleAllDailyReminders();
}
function requestNotificationPermission() { if ("Notification" in window) { if (Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); } } }
function sendSystemNotification(title, bodyText) { if (window.AndroidInterface && typeof window.AndroidInterface.sendNotification === 'function') { try { window.AndroidInterface.sendNotification(title, bodyText || ""); return; } catch(e) { console.error("Native notification failed:", e); } } toast(`🔔 ${title} ${bodyText ? '- ' + bodyText : ''}`); if ("Notification" in window && Notification.permission === "granted") { try { if (navigator.serviceWorker) { navigator.serviceWorker.ready.then(function (registration) { registration.showNotification(title, { body: bodyText, vibrate: [200, 100, 200] }); }).catch(function () { new Notification(title, { body: bodyText }); }); } else { new Notification(title, { body: bodyText }); } } catch (e) { console.log("Notification failed", e); } } }

// ============================================================
// ITEM NOTIFICATION REMINDER ENGINE
// ============================================================
function toggleCustomReminderPicker(prefix) {
    const optEl = document.getElementById(prefix + 'ReminderOpt');
    const rowEl = document.getElementById(prefix + 'CustomPickerRow');
    if (optEl && rowEl) {
        rowEl.style.display = (optEl.value === 'custom') ? 'block' : 'none';
    }
}

function calculateReminderTimestamp(option, baseDateStr, baseTimeStr, customDateTimeValue) {
    if (!option || option === 'none') return null;

    if (option === 'custom') {
        if (!customDateTimeValue) return null;
        const dt = new Date(customDateTimeValue);
        return isNaN(dt.getTime()) ? null : dt.getTime();
    }

    if (!baseDateStr) return null;

    const [year, month, day] = baseDateStr.split('-').map(Number);
    const [hour, minute] = (baseTimeStr || '09:00').split(':').map(Number);
    const baseDt = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);

    switch (option) {
        case '10m_before':
            return baseDt.getTime() - (10 * 60 * 1000);
        case '30m_before':
            return baseDt.getTime() - (30 * 60 * 1000);
        case '1h_before':
            return baseDt.getTime() - (60 * 60 * 1000);

        case 'date_9am':
            return new Date(year, month - 1, day, 9, 0, 0, 0).getTime();
        case 'date_8am':
            return new Date(year, month - 1, day, 8, 0, 0, 0).getTime();

        case '1day_before_9am':
            return new Date(year, month - 1, day - 1, 9, 0, 0, 0).getTime();
        case '1day_before_9pm':
            return new Date(year, month - 1, day - 1, 21, 0, 0, 0).getTime();
        case '1day_before_8am':
            return new Date(year, month - 1, day - 1, 8, 0, 0, 0).getTime();
        case '1day_before_8pm':
            return new Date(year, month - 1, day - 1, 20, 0, 0, 0).getTime();

        case '1week_before_9am':
            return new Date(year, month - 1, day - 7, 9, 0, 0, 0).getTime();

        default:
            return null;
    }
}

function scheduleItemNotification(id, title, message, triggerAtMillis) {
    if (!triggerAtMillis) {
        if (window.AndroidInterface && typeof window.AndroidInterface.cancelAlarm === 'function') {
            try { window.AndroidInterface.cancelAlarm(id); } catch(e) {}
        }
        return;
    }

    if (triggerAtMillis > Date.now()) {
        if (window.AndroidInterface && typeof window.AndroidInterface.scheduleAlarm === 'function') {
            try {
                window.AndroidInterface.scheduleAlarm(id, triggerAtMillis, title, message, false);
            } catch(e) { console.warn('scheduleAlarm error:', e); }
        }
    }
}

// ============================================================
// STANDBY MODE LOGIC
// ============================================================
let standbyClockInterval, standbyPomoInterval; let pomoTimeLeft = 25 * 60; let isPomoRunning = false;
function openStandby() {
    document.getElementById('zenStandby').style.display = 'flex';
    if (window.AndroidInterface) {
        if (typeof window.AndroidInterface.lockLandscape === 'function') {
            window.AndroidInterface.lockLandscape();
        }
        if (typeof window.AndroidInterface.hideSystemBars === 'function') {
            window.AndroidInterface.hideSystemBars();
        }
    }
    try {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { });
    } catch (e) { }
    switchStandbyMode('clock');
}

function exitStandby() {
    document.getElementById('zenStandby').style.display = 'none';
    clearInterval(standbyClockInterval);
    clearInterval(standbyPomoInterval);

    if (window.AndroidInterface) {
        if (typeof window.AndroidInterface.unlockOrientation === 'function') {
            window.AndroidInterface.unlockOrientation();
        }
    }
    try {
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    } catch (e) { }

    setTimeout(() => {
        if (window.AndroidInterface && typeof window.AndroidInterface.showSystemBars === 'function') {
            window.AndroidInterface.showSystemBars();
        }
    }, 100);
}

function setStandbyTheme(themeClass, el) { document.getElementById('zenStandby').className = themeClass; document.querySelectorAll('.zen-theme-dot').forEach(d => { d.classList.remove('active'); d.style.borderColor = 'transparent'; }); el.classList.add('active'); el.style.borderColor = '#fff'; }

function switchStandbyMode(mode) {
    document.getElementById('nav-clock').classList.remove('active');
    document.getElementById('nav-pomo').classList.remove('active');
    document.getElementById('nav-' + mode).classList.add('active');
    if (mode === 'clock') {
        document.getElementById('zenClock').style.display = 'flex';
        document.getElementById('zenPomo').style.display = 'none';
        clearInterval(standbyClockInterval);
        standbyClockInterval = setInterval(updateStandbyClock, 1000);
        updateStandbyClock();
    } else {
        document.getElementById('zenClock').style.display = 'none';
        document.getElementById('zenPomo').style.display = 'flex';
        clearInterval(standbyClockInterval);
        updatePomoDisplay();
    }
}

function setPomoPreset(mins) {
    pomoTimeLeft = mins * 60;
    isPomoRunning = false;
    clearInterval(standbyPomoInterval);
    const btn = document.getElementById('zenPomoBtn');
    const presetsEl = document.getElementById('zenPomoPresets');
    if (btn) btn.textContent = 'Start';
    if (presetsEl) presetsEl.style.display = 'flex';
    updatePomoDisplay();
    toast(`Pomodoro set to ${mins} minutes ⏱️`);
}

function updateStandbyClock() {
    const d = new Date();
    const timeEl = document.getElementById('zenTimeDisplay');
    const secEl = document.getElementById('zenSecDisplay');
    const dateEl = document.getElementById('zenDateDisplay');

    if (timeEl) timeEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (secEl) secEl.textContent = String(d.getSeconds()).padStart(2, '0');
    if (dateEl) dateEl.textContent = d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function togglePomodoro() {
    isPomoRunning = !isPomoRunning;
    const btn = document.getElementById('zenPomoBtn');
    const presetsEl = document.getElementById('zenPomoPresets');

    if (btn) btn.textContent = isPomoRunning ? 'Pause' : 'Start';
    if (presetsEl) presetsEl.style.display = isPomoRunning ? 'none' : 'flex';

    if (isPomoRunning) {
        standbyPomoInterval = setInterval(() => {
            if (pomoTimeLeft > 0) {
                pomoTimeLeft--;
                updatePomoDisplay();
            } else {
                resetPomodoro();
                toast('Focus Session Complete! 🍅');
            }
        }, 1000);
    } else {
        clearInterval(standbyPomoInterval);
    }
}

function resetPomodoro() {
    isPomoRunning = false;
    clearInterval(standbyPomoInterval);
    const btn = document.getElementById('zenPomoBtn');
    const presetsEl = document.getElementById('zenPomoPresets');
    if (btn) btn.textContent = 'Start';
    if (presetsEl) presetsEl.style.display = 'flex';
    pomoTimeLeft = 25 * 60;
    updatePomoDisplay();
}
function updatePomoDisplay() { const m = Math.floor(pomoTimeLeft / 60); const s = pomoTimeLeft % 60; document.getElementById('zenPomoDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; const C = 282.74; const offset = C - (pomoTimeLeft / (25 * 60)) * C; document.getElementById('zenPomoRing').style.strokeDasharray = C; document.getElementById('zenPomoRing').style.strokeDashoffset = offset; }

// ============================================================
// DYNAMIC NAVIGATION & SIDE DRAWER ENGINE
// ============================================================
function setNavLayoutMode(mode) {
    STATE.navLayoutMode = mode;
    save();
    applyNavLayoutMode();
    renderNavbar();
    renderNavSettings();
    toast(`Navigation set to ${mode === 'side' ? 'Side Panel' : mode === 'bottom' ? 'Bottom Bar' : 'Both (Bottom + Side)'}! 🧭`);
}

function applyNavLayoutMode() {
    const mode = STATE.navLayoutMode || 'both';
    const nav = document.getElementById('mainBottomNav');
    const dotBtns = document.querySelectorAll('.menu-dots-btn');
    const bottomNavCard = document.getElementById('bottomNavSelectionCard');

    if (nav) {
        if (mode === 'side') {
            nav.classList.add('nav-hidden');
            nav.classList.remove('nav-mode-both');
        } else if (mode === 'bottom') {
            nav.classList.remove('nav-hidden');
            nav.classList.remove('nav-mode-both');
        } else if (mode === 'both') {
            nav.classList.remove('nav-hidden');
            nav.classList.add('nav-mode-both');
        }
    }

    dotBtns.forEach(btn => {
        if (mode === 'bottom') {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'inline-flex';
        }
    });

    if (bottomNavCard) {
        bottomNavCard.style.display = (mode === 'both') ? 'block' : 'none';
    }

    const sel = document.getElementById('navLayoutSelect');
    if (sel) sel.value = mode;
}

function openSideNav() {
    const drawer = document.getElementById('sideNavDrawer');
    const overlay = document.getElementById('sideNavOverlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    renderSideNavItems();
}

function closeSideNav() {
    const drawer = document.getElementById('sideNavDrawer');
    const overlay = document.getElementById('sideNavOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function toggleSideNav() {
    const drawer = document.getElementById('sideNavDrawer');
    if (drawer && drawer.classList.contains('open')) {
        closeSideNav();
    } else {
        openSideNav();
    }
}

function renderSideNavItems() {
    const body = document.getElementById('sideNavBody');
    if (!body) return;

    if (!STATE.navPreferences || STATE.navPreferences.length === 0) {
        STATE.navPreferences = Object.keys(NAV_MODULES);
        STATE.hiddenNavModules = [];
        save();
    }

    if (!STATE.hiddenNavModules) STATE.hiddenNavModules = [];

    if (!STATE.navPreferences.includes('links') && !STATE.hiddenNavModules.includes('links')) {
        const idx = STATE.navPreferences.indexOf('academic');
        if (idx !== -1) STATE.navPreferences.splice(idx + 1, 0, 'links');
        else STATE.navPreferences.push('links');
        save();
    }

    const mode = STATE.navLayoutMode || 'both';
    const safeNavs = STATE.navPreferences.filter(key => NAV_MODULES[key]);

    const defaultBottomItems = ['dash', 'planner', 'tasks', 'money', 'links'];
    const currentBottomItems = STATE.bottomNavItems || defaultBottomItems;

    const sideDrawerKeys = mode === 'both'
        ? safeNavs.filter(k => !currentBottomItems.includes(k))
        : safeNavs;

    if (sideDrawerKeys.length === 0) {
        body.innerHTML = '<div style="font-size:12px; color:var(--text3); text-align:center; padding:16px;">All items are in the bottom bar!</div>';
        return;
    }

    body.innerHTML = sideDrawerKeys.map(key => {
        const mod = NAV_MODULES[key];
        const isActive = currentScreen === key ? 'active' : '';
        return `
            <div class="drawer-item ${isActive}" onclick="navTo('${key}'); closeSideNav();">
                <span class="drawer-icon">${mod.icon}</span>
                <span>${mod.label}</span>
            </div>
        `;
    }).join('');
}

function renderNavbar() {
    applyNavLayoutMode();

    const mode = STATE.navLayoutMode || 'both';
    const nav = document.getElementById('mainBottomNav');
    if (!nav) return;

    if (!STATE.navPreferences || STATE.navPreferences.length === 0) {
        STATE.navPreferences = Object.keys(NAV_MODULES);
        STATE.hiddenNavModules = [];
        save();
    }

    if (!STATE.hiddenNavModules) STATE.hiddenNavModules = [];

    if (!STATE.bottomNavItems || STATE.bottomNavItems.length === 0) {
        STATE.bottomNavItems = ['dash', 'planner', 'tasks', 'money', 'links'];
    }

    const safeNavs = STATE.navPreferences.filter(key => NAV_MODULES[key]);

    if (mode === 'bottom' || mode === 'both') {
        const bottomNavKeys = mode === 'both'
            ? safeNavs.filter(k => STATE.bottomNavItems.includes(k))
            : safeNavs;

        nav.innerHTML = bottomNavKeys.map(key => {
            const mod = NAV_MODULES[key];
            const isActive = currentScreen === key ? 'active' : '';
            return `
                <div class="nav-item ${isActive}" onclick="navTo('${key}')">
                    <div class="nav-icon">${mod.icon}</div>
                    <div class="nav-label">${mod.label}</div>
                </div>
            `;
        }).join('');
    }

    renderSideNavItems();
}

function renderBottomNavSelectionSettings() {
    const el = document.getElementById('bottomNavSelectionList');
    if (!el) return;

    if (!STATE.bottomNavItems || !STATE.bottomNavItems.length) {
        STATE.bottomNavItems = ['dash', 'planner', 'tasks', 'money', 'links'];
    }

    const enabledNavs = (STATE.navPreferences || []).filter(key => NAV_MODULES[key]);

    el.innerHTML = enabledNavs.map(key => {
        const mod = NAV_MODULES[key];
        const isChecked = STATE.bottomNavItems.includes(key);
        return `
            <label style="display:flex; align-items:center; justify-content:space-between; background:var(--surface2); padding:10px 14px; border-radius:10px; border:1px solid var(--border); cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:18px;">${mod.icon}</span>
                    <span style="font-size:13px; font-weight:600;">${mod.label}</span>
                </div>
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleBottomNavItem('${key}')" style="width:18px; height:18px; cursor:pointer;">
            </label>
        `;
    }).join('');
}

function toggleBottomNavItem(key) {
    if (!STATE.bottomNavItems) STATE.bottomNavItems = ['dash', 'planner', 'tasks', 'money', 'links'];

    if (STATE.bottomNavItems.includes(key)) {
        if (STATE.bottomNavItems.length <= 1) return toast('Bottom bar must have at least 1 item');
        STATE.bottomNavItems = STATE.bottomNavItems.filter(k => k !== key);
    } else {
        if (STATE.bottomNavItems.length >= 6) return toast('Maximum 6 items allowed in bottom bar');
        STATE.bottomNavItems.push(key);
    }

    save();
    renderNavbar();
    renderBottomNavSelectionSettings();
}

function renderNavSettings() {
    if (typeof renderBottomNavSelectionSettings === 'function') renderBottomNavSelectionSettings();
    const el = document.getElementById('navSettingsList');
    if (!el) return;

    // Safety check arrays
    if (!STATE.navPreferences) STATE.navPreferences = Object.keys(NAV_MODULES);
    if (!STATE.hiddenNavModules) STATE.hiddenNavModules = [];

    let html = '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--accent); margin-bottom:10px;">Visible in Menu</div>';

    STATE.navPreferences.forEach((key, index) => {
        const mod = NAV_MODULES[key];
        if (!mod) return;

        // Lock Home and Settings so they can never be hidden
        const isLocked = (key === 'dash' || key === 'settings');

        html += `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface2); padding:10px 14px; margin-bottom:8px; border-radius:10px; border:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:20px;">${mod.icon}</span>
                <span style="font-size:14px; font-weight:600;">${mod.label}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn-secondary" style="padding:6px 10px; font-size:14px;" onclick="moveNavModule(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
                <button class="btn-secondary" style="padding:6px 10px; font-size:14px;" onclick="moveNavModule(${index}, 1)" ${index === STATE.navPreferences.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
                ${!isLocked ? `<button class="btn-secondary" style="padding:6px 12px; font-size:12px; color:var(--red);" onclick="toggleNavModuleVisibility('${key}')">Hide</button>` : `<div style="padding:6px 12px; width:54px;"></div>`}
            </div>
        </div>`;
    });

    if (STATE.hiddenNavModules.length > 0) {
        html += '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text3); margin:20px 0 10px;">Hidden Modules</div>';

        STATE.hiddenNavModules.forEach(key => {
            const mod = NAV_MODULES[key];
            if (!mod) return;

            html += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface); opacity:0.6; padding:10px 14px; margin-bottom:8px; border-radius:10px; border:1px dashed var(--border);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:20px; filter:grayscale(1);">${mod.icon}</span>
                    <span style="font-size:14px; font-weight:600; text-decoration:line-through;">${mod.label}</span>
                </div>
                <button class="btn-secondary" style="padding:6px 16px; font-size:12px; color:var(--green); border-color:rgba(93,232,193,0.3);" onclick="toggleNavModuleVisibility('${key}')">+ Add Back</button>
            </div>`;
        });
    }

    el.innerHTML = html;
}

function moveNavModule(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= STATE.navPreferences.length) return;

    // Swap the elements in the array
    const temp = STATE.navPreferences[index];
    STATE.navPreferences[index] = STATE.navPreferences[newIndex];
    STATE.navPreferences[newIndex] = temp;

    save();
    renderNavSettings();
    renderNavbar();
}

// ============================================================
// LINKS MANAGER MODULE
// ============================================================
let activeEditLinkId = null;
let activeLinkCategory = 'all';

function setLinkCategoryFilter(cat) {
    activeLinkCategory = cat;
    renderLinks();
}

function promptAddNewLinkCategory() {
    const t = prompt("Enter a new category/tag:");
    if (t && t.trim()) {
        const cat = t.trim();
        if (!STATE.linkCategories) STATE.linkCategories = [];
        if (!STATE.linkCategories.includes(cat)) {
            STATE.linkCategories.push(cat);
            save();
            renderLinks();
            toast(`Category '#${cat}' added!`);
        }
    }
}

function deleteLinkCategory(e, tagToDelete) {
    e.stopPropagation();
    if (!confirm(`Delete category #${tagToDelete}? This will remove it from saved links.`)) return;

    if (STATE.linkCategories) {
        STATE.linkCategories = STATE.linkCategories.filter(t => t !== tagToDelete);
    }

    (STATE.links || []).forEach(l => {
        if (l.category === tagToDelete) {
            l.category = '';
            ofetch('update_link.php', { id: l.id, category: '' });
        }
    });

    if (activeLinkCategory === tagToDelete) activeLinkCategory = 'all';

    save();
    renderLinks();
    toast(`Category #${tagToDelete} deleted.`);
}

function renderLinkCategorySelect(selectedCategory = '') {
    const sel = document.getElementById('linkCategorySelect');
    if (!sel) return;
    const cats = STATE.linkCategories || [];
    let opts = `<option value="">(No Category)</option>`;
    cats.forEach(c => {
        opts += `<option value="${escapeHtml(c)}" ${c === selectedCategory ? 'selected' : ''}>#${escapeHtml(c)}</option>`;
    });
    sel.innerHTML = opts;
}

function getLinkThumbnail(url) {
    if (!url) return '';

    const ytReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(ytReg);
    if (match && match[1]) {
        return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }

    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch (e) {
        return '';
    }
}

function handleSharedLink(sharedText) {
    if (!sharedText || !sharedText.trim()) return;

    const text = sharedText.trim();

    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    const url = urlMatch ? urlMatch[0] : null;
    if (!url) {
        toast('No URL found in shared text');
        return;
    }

    let title = 'Shared Link';
    let cleanText = text.replace(url, '').replace(/Check out this video on YouTube/i, '').replace(/[-–—:]+$/, '').trim();
    if (cleanText) {
        title = cleanText;
    } else {
        try {
            const domain = new URL(url).hostname.replace(/^www\./, '');
            title = `Link: ${domain}`;
        } catch (e) {
            title = 'Shared Link';
        }
    }

    const thumb = getLinkThumbnail(url);
    const now = new Date().toISOString();
    const tempId = Date.now();

    if (!STATE.links) STATE.links = [];

    const linkData = {
        id: tempId,
        title: title,
        url: url,
        thumbnail: thumb,
        category: '',
        note: '',
        createdAt: now
    };

    STATE.links.unshift(linkData);
    save();

    ofetch('add_link.php', linkData, d => {
        const l = STATE.links.find(x => x.id === tempId);
        if (l) l.id = d.id;
        save();
        if (currentScreen === 'links') renderLinks();
    });

    navTo('links');
    renderLinks();
    toast('Link saved to Links! 🔗');
}

function openLinkModal(linkId = null) {
    activeEditLinkId = linkId;
    const modal = document.getElementById('linkModal');
    const titleEl = document.getElementById('linkModalTitle');
    const urlInput = document.getElementById('linkUrl');
    const titleInput = document.getElementById('linkTitle');
    const noteInput = document.getElementById('linkNote');

    if (linkId) {
        const l = (STATE.links || []).find(x => x.id === linkId);
        if (l) {
            if (titleEl) titleEl.textContent = 'Edit Link';
            if (urlInput) urlInput.value = l.url || '';
            if (titleInput) titleInput.value = l.title || '';
            if (noteInput) noteInput.value = l.note || '';
            renderLinkCategorySelect(l.category || '');
        }
    } else {
        if (titleEl) titleEl.textContent = 'Save New Link';
        if (urlInput) urlInput.value = '';
        if (titleInput) titleInput.value = '';
        if (noteInput) noteInput.value = '';
        renderLinkCategorySelect('');
    }

    if (modal) modal.classList.add('open');
}

function saveLink() {
    const url = document.getElementById('linkUrl').value.trim();
    let title = document.getElementById('linkTitle').value.trim();
    const category = document.getElementById('linkCategorySelect')?.value || '';
    const note = document.getElementById('linkNote').value.trim();

    if (!url) return toast('Please enter a valid URL');

    if (!title) {
        try {
            const domain = new URL(url).hostname.replace(/^www\./, '');
            title = `Link: ${domain}`;
        } catch (e) {
            title = 'Saved Link';
        }
    }

    const thumb = getLinkThumbnail(url);
    const now = new Date().toISOString();

    if (!STATE.links) STATE.links = [];

    if (activeEditLinkId) {
        const l = STATE.links.find(x => x.id === activeEditLinkId);
        if (l) {
            l.title = title;
            l.url = url;
            l.thumbnail = thumb;
            l.category = category;
            l.note = note;
            save();
            renderLinks();
            ofetch('update_link.php', { id: l.id, title, url, thumbnail: thumb, category, note });
            toast('Link updated! 🔗');
        }
    } else {
        const tempId = Date.now();
        const linkData = {
            id: tempId,
            title: title,
            url: url,
            thumbnail: thumb,
            category: category,
            note: note,
            createdAt: now
        };
        STATE.links.unshift(linkData);
        save();
        renderLinks();
        ofetch('add_link.php', linkData, d => {
            const l = STATE.links.find(x => x.id === tempId);
            if (l) l.id = d.id;
            save();
            renderLinks();
        });
        toast('Link saved! 🔗');
    }

    closeModal('linkModal');
}

function deleteLink(id) {
    if (!confirm('Delete this saved link?')) return;
    STATE.links = (STATE.links || []).filter(x => x.id !== id);
    save();
    renderLinks();
    toast('Link deleted 🗑️');
    ofetch('delete_link.php', { id });
}

function openExternalLink(url) {
    if (!url) return;
    if (window.AndroidInterface && typeof window.AndroidInterface.openExternalUrl === 'function') {
        try {
            window.AndroidInterface.openExternalUrl(url);
            return;
        } catch (e) {
            console.warn('Native openExternalUrl failed, using fallback:', e);
        }
    }
    window.open(url, '_system') || window.open(url, '_blank');
}

function renderLinks() {
    const grid = document.getElementById('linksGrid');
    if (!grid) return;

    if (!STATE.linkCategories) STATE.linkCategories = [];

    const catFilterEl = document.getElementById('linkCategoryFilter');
    if (catFilterEl) {
        const categories = new Set(STATE.linkCategories || []);
        (STATE.links || []).forEach(l => { if (l.category) categories.add(l.category); });

        let catHtml = `<div class="filter-tab ${activeLinkCategory === 'all' ? 'active' : ''}" onclick="setLinkCategoryFilter('all')">All</div>`;
        Array.from(categories).sort().forEach(cat => {
            catHtml += `<div class="filter-tab ${activeLinkCategory === cat ? 'active' : ''}" onclick="setLinkCategoryFilter('${escapeHtml(cat)}')" style="display:flex; align-items:center; gap:6px;">
                            #${escapeHtml(cat)}
                            <span style="opacity:0.5; font-size:14px; line-height:1;" onclick="deleteLinkCategory(event, '${escapeHtml(cat)}')">✕</span>
                        </div>`;
        });
        catFilterEl.innerHTML = catHtml;
    }

    const q = (document.getElementById('linkSearch')?.value || '').toLowerCase();
    let list = STATE.links || [];

    if (activeLinkCategory !== 'all') {
        list = list.filter(l => (l.category || '').toLowerCase() === activeLinkCategory.toLowerCase());
    }

    if (q) {
        list = list.filter(l => (l.title || '').toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q) || (l.note || '').toLowerCase().includes(q) || (l.category || '').toLowerCase().includes(q));
    }

    if (!list.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><div class="empty-icon">🔗</div><p>No saved links found.<br>Tap + Add Link or share links from YouTube/Chrome!</p></div>';
        return;
    }

    grid.innerHTML = list.map(l => {
        const isYt = (l.url || '').includes('youtu.be') || (l.url || '').includes('youtube.com');
        let domain = 'link';
        try {
            domain = new URL(l.url).hostname.replace(/^www\./, '');
        } catch (e) {
            domain = (l.url || '').replace(/^https?:\/\//i, '').split('/')[0] || 'link';
        }

        return `
            <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; background:var(--surface); border:1px solid var(--border); border-radius:16px;">
                ${l.thumbnail ? `
                    <div style="width:100%; height:150px; background:#000; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="openExternalLink('${escapeHtml(l.url)}')">
                        <img src="${escapeHtml(l.thumbnail)}" style="width:100%; height:100%; object-fit:${isYt ? 'cover' : 'contain'}; padding:${isYt ? '0' : '20px'}; background:${isYt ? '#000' : 'var(--surface2)'};" onerror="this.style.display='none';">
                        ${isYt ? `<div style="position:absolute; width:44px; height:44px; border-radius:50%; background:rgba(239,68,68,0.9); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; box-shadow:0 4px 12px rgba(0,0,0,0.4);">▶</div>` : ''}
                    </div>
                ` : ''}

                <div style="padding:16px; flex:1; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                        <div style="font-family:'Syne',sans-serif; font-size:15px; font-weight:700; color:var(--text); line-height:1.3; flex:1;" onclick="openExternalLink('${escapeHtml(l.url)}')">${escapeHtml(l.title || 'Untitled Link')}</div>
                        <span class="badge" style="font-size:10px; font-weight:700; background:var(--surface2); color:var(--accent); text-transform:lowercase;">${escapeHtml(domain)}</span>
                    </div>

                    ${l.category ? `<div style="margin-bottom:6px;"><span class="badge" style="font-size:10px; font-weight:700; background:var(--surface3); color:var(--text2);">#${escapeHtml(l.category)}</span></div>` : ''}

                    ${l.note ? `<div style="font-size:12px; color:var(--text2); margin:6px 0 10px; background:var(--surface2); padding:8px 10px; border-radius:8px; line-height:1.4;">📝 ${escapeHtml(l.note)}</div>` : ''}

                    <div style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <button class="btn-primary" style="padding:6px 12px; font-size:12px;" onclick="openExternalLink('${escapeHtml(l.url)}')">🔗 Open Link</button>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-secondary" style="padding:6px 10px; font-size:12px;" onclick="openLinkModal(${l.id})">✏️</button>
                            <button class="btn-secondary" style="padding:6px 10px; font-size:12px; color:var(--red);" onclick="deleteLink(${l.id})">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleNavModuleVisibility(key) {
    if (STATE.navPreferences.includes(key)) {
        // Hide it
        STATE.navPreferences = STATE.navPreferences.filter(k => k !== key);
        STATE.hiddenNavModules.push(key);
    } else {
        // Show it
        STATE.hiddenNavModules = STATE.hiddenNavModules.filter(k => k !== key);
        STATE.navPreferences.push(key);
    }

    save();
    renderNavSettings();
    renderNavbar();
}

// ============================================================
// DAILY REMINDERS MODULE (SYSTEM NOTIFICATIONS)
// ============================================================
function formatTimeDisplay(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const dispH = h % 12 === 0 ? 12 : h % 12;
    return `${dispH}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseTimeHHMM(timeStr) {
    if (!timeStr) return { h: 12, m: 0 };
    const str = String(timeStr).trim();
    const isPM = /pm/i.test(str);
    const isAM = /am/i.test(str);
    const cleanStr = str.replace(/[^\d:]/g, '');
    const parts = cleanStr.split(':').map(Number);
    let h = isNaN(parts[0]) ? 12 : parts[0];
    let m = isNaN(parts[1]) ? 0 : parts[1];

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    return { h: Math.min(23, Math.max(0, h)), m: Math.min(59, Math.max(0, m)) };
}

function calculateNextAlarmMillis(timeStr) {
    const { h, m } = parseTimeHHMM(timeStr);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    if (target.getTime() <= now.getTime() + 1000) {
        target.setDate(target.getDate() + 1);
    }
    return target.getTime();
}

function scheduleDailyReminderAlarm(reminder) {
    if (!reminder || !reminder.enabled) return;

    const triggerAtMillis = calculateNextAlarmMillis(reminder.time);

    if (window.AndroidInterface && typeof window.AndroidInterface.scheduleAlarm === 'function') {
        try {
            window.AndroidInterface.scheduleAlarm(
                reminder.id,
                triggerAtMillis,
                "Daily Reminder 🔔",
                reminder.message,
                true
            );
        } catch (e) {
            console.warn('Native scheduleAlarm failed:', e);
        }
    }
}

function cancelDailyReminderAlarm(reminderId) {
    if (window.AndroidInterface && typeof window.AndroidInterface.cancelAlarm === 'function') {
        try {
            window.AndroidInterface.cancelAlarm(reminderId);
        } catch (e) {
            console.warn('Native cancelAlarm failed:', e);
        }
    }
}

function addDailyReminder() {
    const msgInput = document.getElementById('dailyReminderMsg');
    const timeInput = document.getElementById('dailyReminderTime');

    const msg = msgInput ? msgInput.value.trim() : '';
    const time = timeInput ? timeInput.value : '';

    if (!msg) return toast('Please enter a reminder message');
    if (!time) return toast('Please select a time');

    if (!STATE.dailyReminders) STATE.dailyReminders = [];

    const tempId = Math.floor(Math.random() * 899999) + 100000;
    const reminder = {
        id: tempId,
        message: msg,
        time: time,
        enabled: true,
        lastFiredDate: ''
    };

    STATE.dailyReminders.push(reminder);
    save();
    renderDailyReminders();

    scheduleDailyReminderAlarm(reminder);

    if (msgInput) msgInput.value = '';
    toast(`Daily reminder '${msg}' added for ${formatTimeDisplay(time)}! 🔔`);
    requestNotificationPermission();
}

function toggleDailyReminder(id) {
    if (!STATE.dailyReminders) return;
    const r = STATE.dailyReminders.find(x => x.id === id);
    if (r) {
        r.enabled = !r.enabled;
        save();
        renderDailyReminders();
        if (r.enabled) {
            scheduleDailyReminderAlarm(r);
            toast('Reminder enabled 🔔');
        } else {
            cancelDailyReminderAlarm(r.id);
            toast('Reminder paused ⏸️');
        }
    }
}

function deleteDailyReminder(id) {
    if (!confirm('Delete this daily reminder?')) return;
    cancelDailyReminderAlarm(id);
    STATE.dailyReminders = (STATE.dailyReminders || []).filter(x => x.id !== id);
    save();
    renderDailyReminders();
    toast('Reminder deleted 🗑️');
}

function renderDailyReminders() {
    const listEl = document.getElementById('dailyRemindersList');
    if (!listEl) return;

    const list = STATE.dailyReminders || [];
    if (!list.length) {
        listEl.innerHTML = '<div style="font-size:12px; color:var(--text3); text-align:center; padding:8px;">No daily reminders set yet.</div>';
        return;
    }

    listEl.innerHTML = list.map(r => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface2); border:1px solid var(--border); padding:10px 14px; border-radius:12px;">
            <div>
                <div style="font-size:14px; font-weight:700; color:var(--text);">${escapeHtml(r.message)}</div>
                <div style="font-size:12px; color:var(--accent); font-weight:600; margin-top:2px;">🔔 Every day at ${formatTimeDisplay(r.time)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn-secondary" style="padding:4px 10px; font-size:11px; ${r.enabled ? 'color:var(--green); border-color:var(--green);' : 'opacity:0.5;'}" onclick="toggleDailyReminder(${r.id})">${r.enabled ? 'Active' : 'Paused'}</button>
                <button class="btn-secondary" style="padding:4px 8px; font-size:12px; color:var(--red);" onclick="deleteDailyReminder(${r.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function rescheduleAllDailyReminders() {
    (STATE.dailyReminders || []).forEach(r => {
        if (r.enabled) {
            scheduleDailyReminderAlarm(r);
        }
    });
}

function checkDailyReminders() {
    // When running inside Android app, native AlarmManager handles notifications via AlarmReceiver
    if (window.AndroidInterface) return;

    if (!STATE.dailyReminders || !STATE.dailyReminders.length) return;

    const now = new Date();
    const todayStr = fmtDate(now);
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    STATE.dailyReminders.forEach(r => {
        if (r.enabled && r.time === currentHHMM && r.lastFiredDate !== todayStr) {
            r.lastFiredDate = todayStr;
            save();
            sendSystemNotification("Daily Reminder 🔔", r.message);
        }
    });
}

// ============================================================
// AI ROUTINE PARSER ENGINE
// ============================================================
// NOTE ON THE BUG THIS SECTION FIXES:
// pdf.js's getTextContent() returns text items in the order they appear in the
// PDF's content stream, NOT in true left-to-right/top-to-bottom reading order.
// For a table with empty cells (e.g. a day with only 2 of 6 slots filled),
// there is no placeholder for the empty cells, so the flattened text silently
// shifts everything left. The AI then has no way to know which slot a course
// actually belongs to and guesses -- which is why classes were landing on the
// wrong day/time. Fix: use each text item's real (x, y) position on the page
// to deterministically bucket it into its actual (Day, Slot) cell BEFORE
// asking the AI to do anything. The AI is only ever asked to clean up the
// subject/room text for a cell whose day and time we already know for certain.

const DAY_NAME_TO_NUM = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function to24Hour(t) {
    const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]); const min = m[2]; const period = m[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
}

function parseTimeRangeText(str) {
    const matches = String(str).match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi) || [];
    if (matches.length < 2) return null;
    const start = to24Hour(matches[0]); const end = to24Hour(matches[1]);
    if (!start || !end) return null;
    return { start, end };
}

// Reconstructs the routine as a list of geometrically-correct {day, time, text} cells
// by using each PDF text item's real x/y coordinates instead of stream order.
async function buildRoutineGrid(pdf) {
    const cells = [];
    let cellIdCounter = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items = content.items
            .map(it => ({ text: (it.str || '').trim(), x: it.transform[4], y: it.transform[5] }))
            .filter(it => it.text.length > 0);
        if (items.length === 0) continue;

        // 1. Find the "Slot N" header items — used only as a ROUGH first pass, because
        // header labels are centered in their column while body text below is left-aligned,
        // so a header-based boundary can misclassify body text by a fraction of a point
        // right at the edge of a narrow column.
        const roughSlotAnchors = [];
        for (let i = 0; i < items.length; i++) {
            const m = items[i].text.match(/^Slot\s*(\d+)$/i);
            if (m) { roughSlotAnchors.push({ slot: parseInt(m[1]), x: items[i].x, y: items[i].y }); continue; }
            if (/^Slot$/i.test(items[i].text) && items[i + 1] && /^\d+$/.test(items[i + 1].text)) {
                roughSlotAnchors.push({ slot: parseInt(items[i + 1].text), x: items[i].x, y: items[i].y });
            }
        }
        if (roughSlotAnchors.length === 0) continue; // can't geometrically map this page -- caller will fall back

        roughSlotAnchors.sort((a, b) => a.x - b.x);
        const headerY = roughSlotAnchors[0].y;
        const dayHeaderItem = items.find(it => /^Day$/i.test(it.text) && Math.abs(it.y - headerY) < 3);
        const roughColumnAnchors = [{ slot: 0, x: dayHeaderItem ? dayHeaderItem.x : 0 }, ...roughSlotAnchors];

        function nearest(anchors, x) {
            let best = anchors[0], bestDist = Infinity;
            for (const c of anchors) { const d = Math.abs(x - c.x); if (d < bestDist) { bestDist = d; best = c; } }
            return best.slot;
        }

        // 2. Read the time-range row (e.g. "09:00 AM - 10:05 AM") using the rough anchors,
        // then take each column's MINIMUM x from that row as its true left edge — time text
        // is reliably left-aligned near the real column border, unlike the header label.
        const timeRowItems = items.filter(it => it.y < headerY - 2 && it.y > headerY - 25);
        const slotTimeText = {};
        const preciseMinX = {};
        timeRowItems.forEach(it => {
            const col = nearest(roughColumnAnchors, it.x);
            if (col === 0) return;
            slotTimeText[col] = (slotTimeText[col] || '') + ' ' + it.text;
            preciseMinX[col] = Math.min(preciseMinX[col] === undefined ? Infinity : preciseMinX[col], it.x);
        });
        preciseMinX[0] = dayHeaderItem ? dayHeaderItem.x : 0;
        const columnAnchors = Object.keys(preciseMinX).map(s => ({ slot: parseInt(s), x: preciseMinX[s] })).sort((a, b) => a.x - b.x);

        function nearestColumn(x) { return nearest(columnAnchors, x); }

        // 4. Find day-row labels (Saturday..Friday) in the Day column -- these define row bands
        const dayRows = items
            .filter(it => nearestColumn(it.x) === 0 && DAY_NAME_TO_NUM.hasOwnProperty(it.text.toLowerCase()))
            .sort((a, b) => b.y - a.y); // PDF y increases upward, so descending = top-to-bottom
        if (dayRows.length === 0) continue;

        // 5. Bucket every other item into its (day band, slot column)
        const buckets = {};
        for (const it of items) {
            const col = nearestColumn(it.x);
            if (col === 0) continue; // the day-name label itself
            if (it.y >= dayRows[0].y + 3) continue; // header area

            let dayIdx = -1;
            for (let i = 0; i < dayRows.length; i++) {
                const top = dayRows[i].y + 3;
                const bottom = i + 1 < dayRows.length ? dayRows[i + 1].y + 3 : -Infinity;
                if (it.y <= top && it.y > bottom) { dayIdx = i; break; }
            }
            if (dayIdx === -1) continue;

            const key = `${dayIdx}_${col}`;
            (buckets[key] = buckets[key] || []).push(it);
        }

        // 6. Assemble each bucket's text and attach its now-certain day + time
        Object.keys(buckets).forEach(key => {
            const [dayIdxStr, colStr] = key.split('_');
            const dayIdx = parseInt(dayIdxStr), col = parseInt(colStr);
            const dayName = dayRows[dayIdx].text.toLowerCase();
            const cellItems = buckets[key].sort((a, b) => (b.y - a.y) || (a.x - b.x));
            const text = cellItems.map(it => it.text).join(' ').replace(/\s+/g, ' ').trim();
            if (!text) return;

            // A real class cell always contains a course-code-like token (e.g. "CSE 3101").
            // Anything shorter without one is almost certainly a wrapped word that spilled
            // a fraction of a point past a column border — skip it rather than create a
            // phantom class with a garbage subject name.
            const looksLikeCourse = /[A-Za-z]{2,6}\s*\d{3,4}/.test(text);
            if (!looksLikeCourse && text.split(/\s+/).length < 4) return;

            const timeRange = parseTimeRangeText(slotTimeText[col] || '') || { start: '09:00', end: '10:00' };
            cells.push({
                id: `c${cellIdCounter++}`,
                dayOfWeek: DAY_NAME_TO_NUM[dayName],
                startTime: timeRange.start,
                endTime: timeRange.end,
                text
            });
        });
    }

    return cells;
}

async function handleRoutineUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    toast('Reading PDF... Please wait ⏳');

    try {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;

            const cells = await buildRoutineGrid(pdf);

            if (cells.length > 0) {
                // Geometry extraction worked -- day/time are already 100% correct.
                toast('Processing with AI... 🤖');
                await sendCellsToAI(cells);
            } else {
                // Fallback for a PDF layout we couldn't geometrically map: use the
                // old raw-text approach so upload still works, just less reliably.
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                }
                toast('Processing with AI (fallback mode)... 🤖');
                await sendRawTextToAI(fullText);
            }
        };
        fileReader.readAsArrayBuffer(file);
    } catch (error) {
        toast('Failed to read PDF! ❌');
        console.error(error);
    }
    event.target.value = ''; // input reset
}

// Primary path: day/time are already known from PDF geometry. The AI only
// extracts subject/room text per cell -- it can no longer get the day or time wrong.
async function sendCellsToAI(cells) {
    toast('Reading course names with AI... 🤖');

    const API_KEY = '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';
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    const cellsBlock = cells.map(c => `[${c.id}] ${c.text}`).join('\n');
    const prompt = `
    Below are text blocks extracted from individual cells of a university class routine table.
    Each cell's Day and Time are ALREADY KNOWN and correct -- do not guess or output them.
    Your only job: for each cell id, extract:
    - subject: the course code and course title combined (string)
    - room: the room number only, e.g. "408" or "103 DMSL" (string, or "" if none)

    Return ONLY a valid JSON array like [{"id":"c0","subject":"...","room":"..."}], no markdown, no extra text.

    Cells:
    ${cellsBlock}
    `;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });

        const data = await response.json();
        if (data.error) { console.error("Groq API Error:", data.error); toast('API Error: ' + data.error.message); return; }

        let jsonString = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonString);

        const byId = {};
        cells.forEach(c => byId[c.id] = c);

        const classes = parsed.map(p => {
            const cell = byId[p.id];
            if (!cell) return null;
            // dayOfWeek/startTime/endTime come from OUR geometry extraction, never from the AI.
            return {
                subject: p.subject || 'Unknown Class',
                room: p.room || '',
                startTime: cell.startTime,
                endTime: cell.endTime,
                dayOfWeek: cell.dayOfWeek
            };
        }).filter(Boolean);

        saveExtractedRoutines(classes);
    } catch (error) {
        toast('Failed to process routine! ❌');
        console.error("API Error:", error);
    }
}

// Fallback path only (geometry extraction failed on this PDF's layout) -- same
// behavior as before, AI has to infer day/time from possibly-scrambled text.
async function sendRawTextToAI(rawText) {
    const API_KEY = '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';
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    const prompt = `
    You are an expert university routine parser. I am giving you raw text extracted from a university class routine PDF.
    Because it is a table grid, the text order might be scrambled. Carefully map each course to its correct Day and Time Slot.

    Extract all classes and return ONLY a valid JSON array of objects. Do not use any markdown formatting like \`\`\`json or extra text. Each object must have:
    - subject: Course code and name (string)
    - room: Room number (string, e.g., "408" or "103 DMSL", or "")
    - startTime: 24-hour HH:MM format (string)
    - endTime: 24-hour HH:MM format (string)
    - dayOfWeek: Number (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday)

    Routine Raw Text:
    ${rawText}
    `;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
            })
        });

        const data = await response.json();
        if (data.error) { console.error("Groq API Error:", data.error); toast('API Error: ' + data.error.message); return; }

        let jsonString = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const classes = JSON.parse(jsonString);
        saveExtractedRoutines(classes);
    } catch (error) {
        toast('Failed to process routine! ❌');
        console.error("API Error:", error);
    }
}

function saveExtractedRoutines(classes) {
    if (!Array.isArray(classes) || classes.length === 0) {
        return toast('No classes found in this document.');
    }

    let addedCount = 0;

    classes.forEach(cls => {
        const tempId = Date.now() + Math.floor(Math.random() * 1000);
        const rData = {
            id: tempId,
            subject: cls.subject || 'Unknown Class',
            room: cls.room || '',
            startTime: cls.startTime || '09:00',
            endTime: cls.endTime || '10:00',
            dayOfWeek: parseInt(cls.dayOfWeek) || 0
        };

        // লোকাল স্টেটে পুশ করা
        STATE.attendanceRoutines.push(rData);
        addedCount++;

        // ব্যাকগ্রাউন্ডে Supabase-এ সিঙ্ক করা
        ofetch('add_att_routine.php', rData, d => {
            const r = STATE.attendanceRoutines.find(x => x.id === tempId);
            if (r) r.id = d.id;
            save();
        });
    });

    save();
    renderAttCalendar();
    renderAttendance();
    toast(`Successfully added ${addedCount} classes! 🎉`);
}


function testInstantNotification() {
    sendSystemNotification("🔔 LifeEasy Test", "Instant test notification working properly!");
    toast("Instant notification sent! Check your status bar 🔔");
}

function testScheduledNotification() {
    const targetTime = Date.now() + 5000;
    const testId = 99999;
    if (window.AndroidInterface && typeof window.AndroidInterface.scheduleAlarm === 'function') {
        try {
            window.AndroidInterface.scheduleAlarm(
                testId,
                targetTime,
                "⏱️ Scheduled Test",
                "5-second scheduled test notification working properly!",
                false
            );
            toast("Scheduled notification set for 5 seconds from now! ⏱️");
        } catch(e) {
            console.error("Schedule error:", e);
            toast("Error scheduling notification: " + e.message);
        }
    } else {
        sendSystemNotification("⏱️ Scheduled Test", "5-second scheduled test notification working properly!");
        toast("Notification sent! ⏱️");
    }
}

// ============================================================
// SECURITY & PASSWORD CHANGE MODULE
// ============================================================
function openChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    const p1 = document.getElementById('newPasswordInput');
    const p2 = document.getElementById('confirmPasswordInput');
    if (p1) p1.value = '';
    if (p2) p2.value = '';
    if (modal) modal.classList.add('open');
}

async function changeUserPassword() {
    const newPass = document.getElementById('newPasswordInput').value.trim();
    const confirmPass = document.getElementById('confirmPasswordInput').value.trim();

    if (!newPass || newPass.length < 6) return toast('Password must be at least 6 characters!');
    if (newPass !== confirmPass) return toast('Passwords do not match!');

    try {
        const { data, error } = await supabaseClient.auth.updateUser({ password: newPass });
        if (error) throw error;
        toast('Password changed successfully! 🔒');
        closeModal('changePasswordModal');
        document.getElementById('newPasswordInput').value = '';
        document.getElementById('confirmPasswordInput').value = '';
    } catch (err) {
        toast('Failed to update password: ' + (err.message || 'Error occurred'));
    }
}

// ============================================================
// OFFLINE SYNC QUEUE & TWO-WAY CLOUD SYNC
// ============================================================
function renderSettingsSyncQueue() {
    const listEl = document.getElementById('settingsSyncQueueList');
    if (!listEl) return;

    const queue = STATE.syncQueue || [];

    if (queue.length === 0) {
        listEl.innerHTML = '<div style="font-size:12px; color:var(--green); text-align:center; padding:10px; background:rgba(93,232,193,0.1); border-radius:10px; border:1px solid rgba(93,232,193,0.2);">✓ All data is synced with the cloud!</div>';
        return;
    }

    listEl.innerHTML = `
        <div style="font-size:11px; color:var(--accent3); font-weight:700; margin-bottom:8px;">${queue.length} item(s) pending cloud upload:</div>
        <div style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto;">
            ${queue.map(item => {
                const action = item.endpoint.replace('.php', '').replace(/_/g, ' ').toUpperCase();
                const name = item.payload.title || item.payload.name || item.payload.subject || (item.payload.amount ? 'Record ' + item.payload.amount : '') || 'Item Data';
                return `
                    <div style="background:var(--surface2); border:1px solid var(--border); padding:8px 12px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                        <div>
                            <span style="font-size:10px; color:var(--text3); font-weight:700; text-transform:uppercase;">${action}</span>
                            <div style="font-weight:600;">${escapeHtml(name.toString())}</div>
                        </div>
                        <span style="font-size:10px; color:var(--red); font-weight:700;">Retries: ${item.retries || 0}/3</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function triggerFullTwoWaySync() {
    toast('Syncing with cloud... ☁️');
    try {
        await processSyncQueue();
        await load();
        renderSettingsSyncQueue();
        toast('Sync Complete! ☁️');
    } catch (e) {
        toast('Sync failed: ' + (e.message || 'Error occurred'));
    }
}

// ============================================================
// ULTRA HD 4K/8K CANVAS WHITEBOARD EXPORT
// ============================================================
function exportWbUltraHD() {
    const curPage = getCurrentWbPage();
    const title = document.getElementById('wbTitle').value.trim() || 'whiteboard';
    const filename = `${title.toLowerCase().replace(/\s+/g, '_')}_page${wbActivePage + 1}_hd.png`;

    let minX = 0, minY = 0, maxX = 1200, maxY = 800;
    const allItems = [
        ...(curPage.paths || []).map(p => ({ obj: p, type: 'path' })),
        ...(curPage.shapes || []).map(s => ({ obj: s, type: 'shape' })),
        ...(curPage.stickies || []).map(st => ({ obj: st, type: 'sticky' })),
        ...(curPage.texts || []).map(t => ({ obj: t, type: 'text' })),
        ...(curPage.images || []).map(i => ({ obj: i, type: 'image' }))
    ];

    const bounds = getWbGroupBounds(allItems);
    if (bounds) {
        minX = Math.min(0, bounds.x - 60);
        minY = Math.min(0, bounds.y - 60);
        maxX = Math.max(1200, bounds.x + bounds.w + 60);
        maxY = Math.max(800, bounds.y + bounds.h + 60);
    }

    const contentW = Math.max(1200, maxX - minX);
    const contentH = Math.max(800, maxY - minY);

    const scale = 3;
    const off = document.createElement('canvas');
    off.width = Math.round(contentW * scale);
    off.height = Math.round(contentH * scale);
    const ctx = off.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-minX, -minY);

    (curPage.images || []).forEach(img => {
        if (img.src) {
            try {
                const el = new Image();
                el.src = img.src;
                ctx.drawImage(el, img.x, img.y, img.w, img.h);
            } catch(e) {}
        }
    });

    (curPage.shapes || []).forEach(s => {
        ctx.save();
        ctx.strokeStyle = s.color || '#000000';
        ctx.lineWidth = s.size || 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (s.lineStyle === 'dashed') ctx.setLineDash([10, 8]);
        else if (s.lineStyle === 'dotted') ctx.setLineDash([3, 6]);

        if (s.fillStyle === 'solid') ctx.fillStyle = s.color;
        else if (s.fillStyle === 'semi') ctx.fillStyle = s.color + '44';
        else ctx.fillStyle = 'transparent';

        ctx.beginPath();
        if (s.type === 'rect') {
            ctx.fillRect(s.x, s.y, s.w, s.h);
            ctx.strokeRect(s.x, s.y, s.w, s.h);
        } else if (s.type === 'circle') {
            ctx.ellipse(s.x + s.w/2, s.y + s.h/2, Math.abs(s.w/2), Math.abs(s.h/2), 0, 0, Math.PI * 2);
            if (s.fillStyle !== 'none') ctx.fill();
            ctx.stroke();
        } else if (s.type === 'arrow') {
            ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        }
        ctx.restore();
    });

    (curPage.stickies || []).forEach(st => {
        ctx.save();
        ctx.fillStyle = st.bgColor || '#fef08a';
        ctx.fillRect(st.x, st.y, st.w || 140, st.h || 140);
        ctx.fillStyle = st.color || '#1e293b';
        ctx.font = "14px 'Syne', sans-serif";
        wrapWbText(ctx, st.text, st.x + 12, st.y + 24, (st.w || 140) - 24, 18);
        ctx.restore();
    });

    (curPage.paths || []).forEach(path => {
        if (!path.points || path.points.length < 1) return;
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    });

    (curPage.texts || []).forEach(t => {
        ctx.save();
        ctx.font = `${t.size || 18}px 'Syne', sans-serif`;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
    });

    ctx.restore();

    const dataUrl = off.toDataURL('image/png');

    if (window.AndroidInterface && typeof window.AndroidInterface.downloadBase64File === 'function') {
        window.AndroidInterface.downloadBase64File(dataUrl, filename, 'image/png');
        toast('Saved Ultra HD 4K Image to Downloads! 📥');
    } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('Exported Ultra HD 4K Image! 📷');
    }
}
function exportWbSVG() {
    const curPage = getCurrentWbPage();
    const title = document.getElementById('wbTitle').value.trim() || 'whiteboard';
    const filename = `${title.toLowerCase().replace(/\s+/g, '_')}_page${wbActivePage + 1}.svg`;

    let minX = 0, minY = 0, maxX = 1200, maxY = 800;
    const bounds = getWbGroupBounds(curPage.paths ? curPage.paths.map(p => ({ obj: p, type: 'path' })) : []);
    if (bounds) {
        minX = Math.min(0, bounds.x - 50);
        minY = Math.min(0, bounds.y - 50);
        maxX = Math.max(1200, bounds.x + bounds.w + 50);
        maxY = Math.max(800, bounds.y + bounds.h + 50);
    }
    const svgW = Math.max(800, maxX - minX);
    const svgH = Math.max(600, maxY - minY);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="${minX} ${minY} ${svgW} ${svgH}" style="background:#ffffff;">\n`;

    (curPage.images || []).forEach(img => {
        if (img.src) svg += `<image href="${img.src}" x="${img.x}" y="${img.y}" width="${img.w}" height="${img.h}" />\n`;
    });

    (curPage.shapes || []).forEach(s => {
        const stroke = s.color || '#000000'; const sw = s.size || 4; let fill = 'none';
        if (s.fillStyle === 'solid') fill = s.color; else if (s.fillStyle === 'semi') fill = s.color + '44';
        if (s.type === 'rect') svg += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
        else if (s.type === 'circle') svg += `<ellipse cx="${s.x + s.w/2}" cy="${s.y + s.h/2}" rx="${Math.abs(s.w/2)}" ry="${Math.abs(s.h/2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />\n`;
        else if (s.type === 'arrow') svg += `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${sw}" />\n`;
    });

    (curPage.stickies || []).forEach(st => {
        svg += `<rect x="${st.x}" y="${st.y}" width="${st.w || 140}" height="${st.h || 140}" fill="${st.bgColor || '#fef08a'}" rx="8" />\n`;
        svg += `<text x="${st.x + 12}" y="${st.y + 28}" font-family="sans-serif" font-size="14" fill="${st.color || '#1e293b'}">${escapeHtml(st.text || '')}</text>\n`;
    });

    (curPage.paths || []).forEach(p => {
        if (p.points && p.points.length > 0) {
            let d = `M ${p.points[0].x} ${p.points[0].y}`;
            for (let i = 1; i < p.points.length; i++) d += ` L ${p.points[i].x} ${p.points[i].y}`;
            svg += `<path d="${d}" fill="none" stroke="${p.color}" stroke-width="${p.size}" stroke-linecap="round" stroke-linejoin="round" />\n`;
        }
    });

    (curPage.texts || []).forEach(t => {
        svg += `<text x="${t.x}" y="${t.y}" font-family="sans-serif" font-size="${t.size || 18}" fill="${t.color}">${escapeHtml(t.text || '')}</text>\n`;
    });

    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        if (window.AndroidInterface && typeof window.AndroidInterface.downloadBase64File === 'function') {
            window.AndroidInterface.downloadBase64File(dataUrl, filename, 'image/svg+xml');
            toast('Exported Infinite Vector SVG! 🎨');
        } else {
            const a = document.createElement('a'); a.href = dataUrl; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            toast('Exported Infinite Vector SVG! 🎨');
        }
    };
    reader.readAsDataURL(blob);
}
