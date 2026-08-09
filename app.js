// ============================================================
// STATE & HELPERS
// ============================================================
const STATE = {
    tasks: [], plans: [], counters: [], money: [], alarms: [], roadmaps: [], steps: [], attendance: [], academic: [],
    attendanceRoutines: [], attendanceLogs: [], accounts: [], expenses: [], notes: [], sleepLogs: [], syncQueue: [], customTags: [], tabs: [],

    navPreferences: ['dash', 'planner', 'tasks', 'counter', 'money', 'alarms', 'roadmap', 'attendance', 'academic', 'vault', 'expenses', 'notes', 'sleep', 'tabs', 'settings'],
    hiddenNavModules: [],

    // UPDATED: Now includes the top 4 stats as removable mini widgets
    dashWidgets: ['pending_tasks', 'todays_events', 'net_money', 'active_counters', 'redzone', 'schedule', 'classes', 'tasks'],
    dashHiddenWidgets: ['alarms', 'sleep', 'roadmap', 'specific_account', 'specific_counter', 'specific_note'],
    dashConfig: { accountId: null, counterId: null, noteId: null },

    selectedDate: '', attSelectedDate: '', activeRoadmap: null, activeAccountId: null, taskFilter: 'all', moneyFilter: 'all'
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
    classes: { icon: '🎓', label: 'Today\'s Classes (Full)' }
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
        case 'add_task.php': table = 'tasks'; if (payload.due === "") data.due_date = null; else if (payload.due) data.due_date = payload.due; delete data.due; if (payload.reminder === "") data.reminder = null; break;
        case 'update_task_details.php': table = 'tasks'; matchField = 'task_id'; if (payload.due === "") data.due_date = null; else if (payload.due) data.due_date = payload.due; delete data.due; if (payload.reminder === "") data.reminder = null; break;
        case 'update_task.php': table = 'tasks'; matchField = 'task_id'; data = { completed: payload.completed }; break;
        case 'delete_task.php': table = 'tasks'; matchField = 'task_id'; break;
        case 'add_plan.php': case 'update_plan.php': case 'delete_plan.php': table = 'plans'; if (endpoint === 'update_plan.php') data = { completed: payload.completed }; if (endpoint === 'add_plan.php') { data = { title: payload.title, desc: payload.desc, date: payload.date, time: payload.time, color: payload.color, recurrence: payload.recurrence }; } break;
        case 'add_counter.php': table = 'counters'; data = { name: payload.name, value: payload.value, step: payload.step, color: payload.color }; break;
        case 'update_counter.php': table = 'counters'; data = { value: payload.value, last_updated: payload.lastUpdated || new Date().toLocaleString() }; break;
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

        const [rTasks, rCounters, rPlans, rMoney, rAlarms, rRoadmaps, rSteps, rAcademic, rAccounts, rExpenses, rNotes, rSleep, rAttRoutines, rAttLogs] = await Promise.all([
            supabaseClient.from('tasks').select('*'), supabaseClient.from('counters').select('*'), supabaseClient.from('plans').select('*'),
            supabaseClient.from('money').select('*'), supabaseClient.from('alarms').select('*'), supabaseClient.from('roadmaps').select('*'),
            supabaseClient.from('steps').select('*'), supabaseClient.from('academic').select('*'), supabaseClient.from('accounts').select('*'),
            supabaseClient.from('expenses').select('*'), supabaseClient.from('notes').select('*'), supabaseClient.from('sleep_logs').select('*'),
            supabaseClient.from('attendance_routines').select('*'), supabaseClient.from('attendance_logs').select('*')
        ]);

        if (rTasks.error?.status === 401 || rCounters.error?.status === 401) { document.getElementById('authModal').style.display = 'flex'; return; }

        if (rTasks.data) STATE.tasks = rTasks.data.map(t => ({ ...t, id: t.task_id }));
        if (rCounters.data) STATE.counters = rCounters.data.map(c => ({ ...c, lastUpdated: c.last_updated }));
        if (rPlans.data) STATE.plans = rPlans.data;
        if (rMoney.data) STATE.money = rMoney.data;
        if (rAlarms.data) STATE.alarms = rAlarms.data;
        if (rRoadmaps.data) STATE.roadmaps = rRoadmaps.data;
        if (rSteps.data) STATE.steps = rSteps.data.map(s => ({ ...s, roadmapId: s.roadmap_id }));
        if (rAcademic.data) STATE.academic = rAcademic.data;
        if (rAccounts.data) STATE.accounts = rAccounts.data;
        if (rExpenses.data) STATE.expenses = rExpenses.data.map(e => ({ ...e, accountId: e.account_id }));
        // FIX: Ensure checklists and tags are parsed into strict arrays, preventing dashboard crashes
        if (rNotes.data) STATE.notes = rNotes.data.map(n => {
            let parsedChecklist = n.checklist;
            if (typeof parsedChecklist === 'string') { try { parsedChecklist = JSON.parse(parsedChecklist); } catch (e) { parsedChecklist = null; } }

            let parsedTags = n.tags;
            if (typeof parsedTags === 'string') { try { parsedTags = JSON.parse(parsedTags); } catch (e) { parsedTags = []; } }

            let parsedWb = n.wb_data;
            if (typeof parsedWb === 'string') { try { parsedWb = JSON.parse(parsedWb); } catch (e) { parsedWb = null; } }

            return {
                ...n,
                updatedAt: n.updated_at,
                tags: parsedTags || [],
                checklist: Array.isArray(parsedChecklist) ? parsedChecklist : null,
                isWhiteboard: n.is_whiteboard || false,
                wbData: parsedWb
            };
        });
        if (rSleep.data) STATE.sleepLogs = rSleep.data.map(s => ({ ...s, wake: s.wake_time, durationMins: s.duration_mins }));
        if (rAttRoutines && rAttRoutines.data) STATE.attendanceRoutines = rAttRoutines.data.map(r => ({ ...r, dayOfWeek: r.day_of_week, startTime: r.start_time || r.time, endTime: r.end_time || r.time }));
        if (rAttLogs && rAttLogs.data) STATE.attendanceLogs = rAttLogs.data.map(l => ({ ...l, routineId: l.routine_id }));

        save(); renderAll(); if (typeof updateGreeting === 'function') updateGreeting();
        if ((STATE.syncQueue || []).length > 0) showSyncBadge(); else hideSyncBadge();
    } catch (err) { console.log('Offline mode — using cached data', err); if ((STATE.syncQueue || []).length > 0) showSyncBadge(); }
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
    renderAttCalendar(); initColorPickers();
}

// ============================================================
// UI ROUTING
// ============================================================
function navTo(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById('screen-' + screen);
    if (targetScreen) targetScreen.classList.add('active');

    currentScreen = screen;

    // Call the new render function so the bottom bar highlights correctly
    renderNavbar();

    if (screen === 'roadmap') {
        document.getElementById('roadmapList-view').style.display = 'block'; document.getElementById('roadmapDetail-view').style.display = 'none'; STATE.activeRoadmap = null;
    }
    if (screen !== 'expenses') {
        STATE.activeAccountId = null; const dv = document.getElementById('transactionDetailView'); if (dv) dv.style.display = 'none';
    }

    if (screen === 'dash') renderDashboard();
    if (screen === 'expenses') renderExpenses();
    if (screen === 'notes') renderNotes();
    if (screen === 'sleep') renderSleep();
    if (screen === 'settings') { renderNavSettings(); renderDashSettings(); }
    if (screen === 'attendance') { renderAttCalendar(); renderAttendance(); }

    const fab = document.querySelector('.fab');
    if (fab) fab.style.display = (screen === 'expenses' || screen === 'vault' || screen === 'settings' || screen === 'notes' || screen === 'sleep') ? 'none' : 'flex';
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
    else openTaskModal();
}

function updateGreeting() {
    const h = new Date().getHours(); const g = h < 12 ? 'Good morning 👋' : h < 17 ? 'Good afternoon ☀️' : 'Good evening 🌙';
    document.getElementById('greeting').textContent = g;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('greetingSub').textContent = `${days[new Date().getDay()]} — let's get things done`;
    document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
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
                    wHtml = `<div class="stat-card"><div class="stat-icon">✅</div><div class="stat-num">${activeTasks}</div><div class="stat-label">Pending Tasks</div></div>`;
                    break;
                }
                case 'todays_events': {
                    wHtml = `<div class="stat-card"><div class="stat-icon">📅</div><div class="stat-num">${STATE.plans.filter(p => isEventOnDate(p, todayStr)).length}</div><div class="stat-label">Today's Events</div></div>`;
                    break;
                }
                case 'net_money': {
                    const lentTotal = STATE.money.filter(m => m.type === 'lent' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0);
                    const owedTotal = STATE.money.filter(m => m.type === 'borrowed' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0);
                    const netMoney = lentTotal - owedTotal;
                    const netColor = netMoney >= 0 ? 'var(--green)' : 'var(--red)';
                    wHtml = `<div class="stat-card"><div class="stat-icon">💰</div><div class="stat-num" style="color:${netColor}">${netMoney >= 0 ? '+' : '-'}$${Math.abs(netMoney).toFixed(0)}</div><div class="stat-label">Net Money</div></div>`;
                    break;
                }
                case 'active_counters': {
                    wHtml = `<div class="stat-card"><div class="stat-icon">🔢</div><div class="stat-num">${STATE.counters.length}</div><div class="stat-label">Active Counters</div></div>`;
                    break;
                }
                case 'alarms': {
                    const activeAlarms = STATE.alarms.filter(a => a.enabled && a.time).sort((a, b) => a.time > b.time ? 1 : -1);
                    if (activeAlarms.length === 0) wHtml = `<div class="stat-card"><div class="stat-icon">⏰</div><div class="stat-num" style="font-size:20px; padding:4px 0;">Off</div><div class="stat-label">Next Alarm</div></div>`;
                    else wHtml = `<div class="stat-card"><div class="stat-icon">⏰</div><div class="stat-num" style="font-size:22px; padding:2px 0;">${formatTime(activeAlarms[0].time)}</div><div class="stat-label">${activeAlarms[0].label || 'Next Alarm'}</div></div>`;
                    break;
                }
                case 'sleep': {
                    if (STATE.sleepLogs.length === 0) wHtml = `<div class="stat-card"><div class="stat-icon">😴</div><div class="stat-num" style="font-size:20px; padding:4px 0;">No Data</div><div class="stat-label">Last Night</div></div>`;
                    else {
                        const latest = [...STATE.sleepLogs].sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop();
                        wHtml = `<div class="stat-card"><div class="stat-icon">😴</div><div class="stat-num" style="color:var(--accent2);">${(latest.durationMins / 60).toFixed(1)}h</div><div class="stat-label">Last Night</div></div>`;
                    }
                    break;
                }
                case 'roadmap': {
                    if (STATE.roadmaps.length === 0) wHtml = `<div class="stat-card"><div class="stat-icon">🗺️</div><div class="stat-num" style="font-size:20px; padding:4px 0;">None</div><div class="stat-label">Active Roadmap</div></div>`;
                    else {
                        let bestR = STATE.roadmaps[0]; let bestPct = -1;
                        STATE.roadmaps.forEach(r => {
                            const steps = STATE.steps.filter(s => s.roadmapId === r.id);
                            const done = steps.filter(s => s.completed).length;
                            const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                            if (pct > bestPct && pct < 100) { bestPct = pct; bestR = r; }
                        });
                        if (bestPct === -1) { bestR = STATE.roadmaps[0]; bestPct = STATE.steps.filter(s => s.roadmapId === bestR.id && s.completed).length / (STATE.steps.filter(s => s.roadmapId === bestR.id).length || 1) * 100; }
                        wHtml = `<div class="stat-card"><div class="stat-icon">🗺️</div><div class="stat-num" style="font-size:24px; padding:2px 0;">${bestPct.toFixed(0)}%</div><div class="stat-label" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bestR.title}</div></div>`;
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
                            wHtml = `<div class="stat-card" style="position:relative;"><span style="position:absolute; top:8px; right:8px; font-size:10px; opacity:0.5; cursor:pointer;" onclick="STATE.dashConfig.accountId = null; save(); renderDashboard();">⚙️</span><div class="stat-icon">💳</div><div class="stat-num" style="font-size:20px; padding:4px 0; color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};">$${bal.toFixed(0)}</div><div class="stat-label" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${acc.name}</div></div>`;
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
                            wHtml = `<div class="stat-card" style="position:relative;"><span style="position:absolute; top:8px; right:8px; font-size:10px; opacity:0.5; cursor:pointer;" onclick="STATE.dashConfig.counterId = null; save(); renderDashboard();">⚙️</span><div class="stat-icon" style="color:${c.color};">🔢</div><div class="stat-num" style="font-size:24px; padding:2px 0;">${c.value}</div><div style="display:flex; justify-content:center; gap:4px; margin-top:4px;"><button class="btn-secondary" style="padding:2px 8px; font-size:12px;" onclick="adjustCounter(${c.id},-1); setTimeout(renderDashboard, 50)">-</button><button class="btn-secondary" style="padding:2px 8px; font-size:12px;" onclick="adjustCounter(${c.id},1); setTimeout(renderDashboard, 50)">+</button></div><div class="stat-label" style="margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</div></div>`;
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
                            wHtml = `<div class="stat-card" style="position:relative; text-align:left; display:flex; flex-direction:column; justify-content:space-between;"><span style="position:absolute; top:8px; right:8px; font-size:10px; opacity:0.5; cursor:pointer;" onclick="STATE.dashConfig.noteId = null; save(); renderDashboard();">⚙️</span><div style="font-size:11px; color:var(--text2); text-transform:uppercase; margin-bottom:4px; font-weight:700;">📝 ${n.title || 'Note'}</div><div style="font-size:11px; line-height:1.4; color:var(--text); white-space:pre-wrap;">${preview}</div></div>`;
                        }
                    }
                    break;
                }

                /* ------------------ FULL WIDGETS ------------------ */
                case 'redzone': {
                    let uHtml = `<div class="card" style="margin-bottom:12px;"><div class="section-header" style="margin-bottom:10px;"><div class="section-title" style="color:var(--red);">🚨 Urgent Deadlines</div></div>`;
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
                    let sHtml = `<div class="card" style="margin-bottom:12px;"><div class="section-header" style="margin-bottom:10px;"><div class="section-title">📅 Today's Schedule</div></div>`;
                    const todayPlans = STATE.plans.filter(p => isEventOnDate(p, todayStr) && p.time).sort((a, b) => a.time > b.time ? 1 : -1);
                    if (todayPlans.length === 0) sHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">Clear schedule today.</div>`;
                    else sHtml += `<div class="today-list">` + todayPlans.map(p => `<div class="today-item"><div class="today-dot" style="background:${p.color || 'var(--accent)'}"></div><div class="today-time">${formatTime(p.time)}</div><div class="today-text ${p.completed ? 'done' : ''}">${p.title}</div></div>`).join('') + `</div>`;
                    sHtml += `</div>`;
                    wHtml = sHtml;
                    break;
                }
                case 'tasks': {
                    let tHtml = `<div class="card" style="margin-bottom:12px;"><div class="section-header" style="margin-bottom:10px;"><div class="section-title">📋 Upcoming Tasks</div></div>`;
                    const upcoming = STATE.tasks.filter(t => !t.completed).slice(0, 5);
                    if (upcoming.length === 0) tHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">All clear!</div>`;
                    else tHtml += upcoming.map(t => `<div class="task-item" style="margin-bottom:8px; cursor:default;"><div class="priority-dot p${t.priority}" style="margin-top:6px"></div><div class="task-body"><div class="task-title">${t.title}</div><div class="task-due">${t.category} ${t.due ? '· ' + fmtDisplay(t.due) : ''}</div></div></div>`).join('');
                    tHtml += `</div>`;
                    wHtml = tHtml;
                    break;
                }
                case 'classes': {
                    let cHtml = `<div class="card" style="margin-bottom:12px;"><div class="section-header" style="margin-bottom:10px;"><div class="section-title">🎓 Today's Classes</div></div>`;
                    const dayOfWeek = today.getDay();
                    const todaysClasses = STATE.attendanceRoutines.filter(r => parseInt(r.dayOfWeek) === dayOfWeek).sort((a, b) => (a.startTime || a.time) > (b.startTime || b.time) ? 1 : -1);
                    if (todaysClasses.length === 0) cHtml += `<div style="font-size:12px; color:var(--text3); text-align:center; padding:10px;">No classes scheduled today.</div>`;
                    else cHtml += todaysClasses.map(c => {
                        const stats = typeof calculateAttendanceStats === 'function' ? calculateAttendanceStats(c.id) : { pct: 0, attended: 0, missed: 0 };
                        const classTime = c.startTime || c.time;
                        return `<div style="padding:10px; background:var(--surface2); border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:700; font-size:14px;">${c.subject}</div><div style="font-size:11px; color:var(--text2);">Room: ${c.room || 'N/A'} | ${classTime ? formatTime(classTime) : 'N/A'}</div></div><div style="font-size:16px; font-weight:800; color:${stats.pct >= 75 ? 'var(--green)' : 'var(--red)'}">${stats.pct.toFixed(0)}%</div></div>`;
                    }).join('');
                    cHtml += `</div>`;
                    wHtml = cHtml;
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

    // FIX: Ensure the settings menu defaults exactly match the dashboard defaults if it resets.
    if (!STATE.dashWidgets) STATE.dashWidgets = ['pending_tasks', 'todays_events', 'net_money', 'active_counters', 'redzone', 'schedule', 'classes', 'tasks'];
    if (!STATE.dashHiddenWidgets) STATE.dashHiddenWidgets = ['alarms', 'sleep', 'roadmap', 'specific_account', 'specific_counter', 'specific_note'];

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
// AUTH & THEME & VAULT
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
function renderVault() {
    supabaseClient.from('vault').select('*').then(({ data, error }) => {
        const el = document.getElementById('vaultFiles'); if (!el) return;
        if (!error && data && data.length > 0) { el.innerHTML = data.map(f => `<div class="card-sm" style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:14px;">${f.filename}</div><div style="font-size:10px;color:var(--text3);">Uploaded: ${new Date(f.upload_date).toLocaleDateString()}</div></div><div style="display:flex;gap:10px;"><a href="${f.filepath}" download target="_blank" class="btn-secondary" style="padding:4px 8px;">Download</a><button onclick="deleteVaultFile(${f.id}, '${f.filepath}')" style="background:none;border:none;color:var(--red);cursor:pointer;">🗑</button></div></div>`).join(''); } else { el.innerHTML = '<p style="text-align:center;padding:20px;">Vault is empty</p>'; }
    }).catch(() => { const el = document.getElementById('vaultFiles'); if (el) el.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text3);">📵 Vault unavailable</p>'; });
}
async function deleteVaultFile(id, filepath) {
    if (!confirm('Delete this file?')) return;
    try { const pathParts = filepath.split('/storage/v1/object/public/vault/'); if (pathParts.length > 1) { const storagePath = pathParts[1]; await supabaseClient.storage.from('vault').remove([storagePath]); } const { error } = await supabaseClient.from('vault').delete().eq('id', id); if (error) throw error; toast('File deleted 🗑️'); renderVault(); } catch (err) { toast('Failed to delete file.'); }
}
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone'); const fileInput = document.getElementById('fileInput'); if (!dropZone) return;
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--green)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--accent)');
    dropZone.addEventListener('drop', e => { e.preventDefault(); uploadFile(e.dataTransfer.files); });
    if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFile(fileInput.files); });
});
async function uploadFile(files) {
    if (!files || !files.length) return; const file = files[0]; const dz = document.getElementById('dropZone'); if (dz) dz.style.borderColor = 'var(--accent2)';
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession(); const userId = sessionData?.session?.user?.id; if (!userId) throw new Error("You must be logged in to upload files.");
        const fileExt = file.name.split('.').pop(); const generatedName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data: sData, error: sErr } = await supabaseClient.storage.from('vault').upload(generatedName, file); if (sErr) throw sErr;
        const { data: urlObj } = supabaseClient.storage.from('vault').getPublicUrl(generatedName);
        const { error: tErr } = await supabaseClient.from('vault').insert([{ user_id: userId, filename: file.name, filepath: urlObj.publicUrl }]); if (tErr) throw tErr;
        if (dz) dz.style.borderColor = 'var(--accent)'; toast('File saved to Vault! 🔒'); renderVault();
    } catch (err) { if (dz) dz.style.borderColor = 'var(--accent)'; alert('Upload failed: ' + (err.message || err)); }
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
function openPlannerModal() { document.getElementById('planTitle').value = ''; document.getElementById('planDesc').value = ''; document.getElementById('planDate').value = STATE.selectedDate; document.getElementById('planRecurrence').value = 'none'; document.getElementById('plannerModal').classList.add('open'); }
function savePlan() {
    const title = document.getElementById('planTitle').value.trim(); if (!title) return toast('Please enter a title');
    const planData = { title, desc: document.getElementById('planDesc').value, date: document.getElementById('planDate').value, time: document.getElementById('planTime').value || '09:00', color: selectedColors.plan, recurrence: document.getElementById('planRecurrence').value };
    const tempId = Date.now(); planData.id = tempId; planData.completed = false; STATE.plans.push(planData);
    renderCalendar(); renderPlanner(); renderDashboard(); closeModal('plannerModal'); save(); toast('Event added 📅');
    ofetch('add_plan.php', planData, d => { const p = STATE.plans.find(x => x.id === tempId); if (p) p.id = d.id; renderCalendar(); renderPlanner(); renderDashboard(); save(); });
}
function togglePlan(e, id) { if (e) e.stopPropagation(); const p = STATE.plans.find(x => x.id === id); if (!p) return; p.completed = !p.completed; renderPlanner(); renderDashboard(); save(); ofetch('update_plan.php', { id, completed: p.completed }); }
function deletePlan(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this event series?')) return; STATE.plans = STATE.plans.filter(x => x.id !== id); renderCalendar(); renderPlanner(); renderDashboard(); save(); toast('Deleted 🗑️'); ofetch('delete_plan.php', { id }); }
function renderPlanner() {
    const el = document.getElementById('plannerEvents'); const selDateObj = new Date(STATE.selectedDate + 'T00:00:00'); const selDisplay = selDateObj.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
    let html = `<div class="section-header"><div class="section-title">Events on ${selDisplay}</div></div>`;
    const selPlans = STATE.plans.filter(p => isEventOnDate(p, STATE.selectedDate)).sort((a, b) => a.time > b.time ? 1 : -1);
    if (selPlans.length === 0) { html += `<div style="text-align:center; color:var(--text3); font-size:13px; margin-bottom:24px;">No events scheduled for this day.</div>`; } else {
        html += selPlans.map(p => `<div class="time-slot"><div class="time-label">${formatTime(p.time)}</div><div class="time-line" style="background:${p.color}"></div><div class="time-events" style="flex:1"><div class="event-block ${p.completed ? 'done' : ''}" style="border-color:${p.color}" onclick="togglePlan(event, ${p.id})"><div class="event-title">${p.title}</div>${p.desc ? `<div class="event-desc">${p.desc}</div>` : ''}<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font-size:10px;color:var(--text3)">${p.completed ? '✓ Done' : (p.recurrence && p.recurrence !== 'none' ? '🔁 ' + p.recurrence : '⏰ ' + p.time)}</span><span onclick="deletePlan(event, ${p.id})" style="font-size:16px;color:var(--text3);cursor:pointer;padding:4px">🗑</span></div></div></div></div>`).join('');
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
function openTaskModal() { document.getElementById('taskModalTitle').textContent = 'New Task'; document.getElementById('taskTitle').value = ''; document.getElementById('taskDesc').value = ''; document.getElementById('taskDue').value = fmtDate(new Date()); document.getElementById('taskReminder').value = ''; delete document.getElementById('taskModal').dataset.editId; document.getElementById('taskModal').classList.add('open'); }
function openTaskModalById(id) { const t = STATE.tasks.find(x => x.id === id); if (!t) return; document.getElementById('taskModalTitle').textContent = 'Edit Task'; document.getElementById('taskTitle').value = t.title; document.getElementById('taskDesc').value = t.description || ''; document.getElementById('taskCategory').value = t.category || 'Work'; document.getElementById('taskPriority').value = t.priority || 0; document.getElementById('taskDue').value = t.due || ''; document.getElementById('taskReminder').value = t.reminder || ''; document.getElementById('taskModal').dataset.editId = t.id; document.getElementById('taskModal').classList.add('open'); }
function saveTask() {
    const title = document.getElementById('taskTitle').value.trim(); if (!title) return toast('Please enter a task title');
    const editId = document.getElementById('taskModal').dataset.editId;
    const taskData = { title, description: document.getElementById('taskDesc').value, category: document.getElementById('taskCategory').value, priority: parseInt(document.getElementById('taskPriority').value), due: document.getElementById('taskDue').value, reminder: document.getElementById('taskReminder').value };
    if (editId) {
        taskData.id = parseInt(editId); const idx = STATE.tasks.findIndex(x => x.id === taskData.id); if (idx >= 0) { taskData.completed = STATE.tasks[idx].completed; STATE.tasks[idx] = taskData; }
        renderTasks(); renderDashboard(); closeModal('taskModal'); save(); ofetch('update_task_details.php', taskData, () => toast('Task updated! ✅'));
    } else {
        const tempId = Date.now(); taskData.id = tempId; taskData.completed = false; STATE.tasks.unshift(taskData);
        renderTasks(); renderDashboard(); closeModal('taskModal'); save(); toast('Saved! ✅');
        ofetch('add_task.php', taskData, d => { const t = STATE.tasks.find(x => x.id === tempId); if (t) t.id = Number(d.id); renderTasks(); save(); });
    }
    if (taskData.reminder) scheduleReminderToast(taskData);
}
function toggleTask(e, id) { if (e) e.stopPropagation(); const t = STATE.tasks.find(x => x.id === id); if (!t) return; t.completed = !t.completed; renderTasks(); renderDashboard(); save(); toast(t.completed ? 'Task done! 🎉' : 'Task reopened'); ofetch('update_task.php', { id, completed: t.completed }); }
function deleteTask(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this task?')) return; STATE.tasks = STATE.tasks.filter(t => t.id !== id); renderTasks(); renderDashboard(); save(); toast('Task deleted 🗑️'); ofetch('delete_task.php', { id }); }
function setTaskFilter(f, el) { STATE.taskFilter = f; document.querySelectorAll('#taskFilters .filter-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderTasks(); }
function renderTasks() {
    let tasks = [...STATE.tasks];
    if (STATE.taskFilter === 'active') tasks = tasks.filter(t => !t.completed); else if (STATE.taskFilter === 'done') tasks = tasks.filter(t => t.completed); else if (STATE.taskFilter === 'high') tasks = tasks.filter(t => t.priority === 2 && !t.completed); else if (STATE.taskFilter === 'work') tasks = tasks.filter(t => t.category === 'Work'); else if (STATE.taskFilter === 'personal') tasks = tasks.filter(t => t.category === 'Personal');
    const el = document.getElementById('taskList'); if (tasks.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No tasks here</p></div>';
    el.innerHTML = tasks.map(t => `<div class="task-item ${t.completed ? 'done' : ''}" onclick="openTaskModalById(${t.id})" style="cursor:pointer;"><div class="task-check ${t.completed ? 'checked' : ''}" onclick="toggleTask(event, ${t.id})"></div><div class="task-body"><div class="task-title">${t.title}</div><div class="task-meta"><span class="priority-dot p${t.priority}"></span><span class="pill pill-accent" style="font-size:10px;padding:2px 7px">${t.category}</span>${t.due ? `<span class="task-due">📅 ${fmtDisplay(t.due)}</span>` : ''} ${t.priority === 2 ? '<span style="font-size:11px;color:var(--red)">🔴 High</span>' : ''}</div></div><div class="task-delete" onclick="deleteTask(event, ${t.id})">🗑</div></div>`).join('');
}

// ============================================================
// COUNTERS
// ============================================================
function saveCounter() {
    const name = document.getElementById('counterName').value.trim();
    if (!name) return toast('Enter a name');
    const cData = { name, value: parseInt(document.getElementById('counterStart').value) || 0, step: parseInt(document.getElementById('counterStep').value) || 1, color: selectedColors.counter };
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
        if (STATE.dashConfig.counterId == tempId) STATE.dashConfig.counterId = String(d.id); // Reconcile Pin
        renderCounters(); renderDashboard(); save();
    });
} // <--- THIS WAS THE FATAL MISSING BRACKET

function adjustCounter(id, dir) { const c = STATE.counters.find(x => x.id === id); if (!c) return; c.value += dir * c.step; c.lastUpdated = new Date().toISOString(); renderCounters(); save(); ofetch('update_counter.php', { id, value: c.value }); }
function resetCounter(id) { const c = STATE.counters.find(x => x.id === id); if (!c) return; c.value = 0; c.lastUpdated = new Date().toISOString(); renderCounters(); save(); ofetch('update_counter.php', { id, value: 0 }); }
function deleteCounter(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this counter?')) return; STATE.counters = STATE.counters.filter(x => x.id !== id); renderCounters(); save(); toast('Counter deleted 🗑️'); ofetch('delete_counter.php', { id }); }
function openCounterModal() { document.getElementById('counterName').value = ''; document.getElementById('counterStep').value = '1'; document.getElementById('counterStart').value = '0'; document.getElementById('counterModal').classList.add('open'); }
// Helper to calculate relative time (e.g., "13.5 days ago")
function timeSince(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;

    if (isNaN(diffMs) || diffMs < 0) return 'Just now';

    const diffMins = diffMs / (1000 * 60);
    if (diffMins < 1) return 'Just now';
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
        // Generate the combined Date + Time + Timer HTML
        let editInfo = 'Never edited';
        if (c.lastUpdated) {
            const d = new Date(c.lastUpdated);
            if (!isNaN(d.getTime())) {
                const exactDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                // Add the time formatting (e.g. 12:25)
                const exactTime = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                const relativeTime = timeSince(c.lastUpdated);

                // Shows: "Edited on 27/6/2025 at 12:25" and directly below it "15.7 days ago"
                editInfo = `Edited on ${exactDate} at ${exactTime}<br><span style="opacity: 0.7;">${relativeTime}</span>`;
            }
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
function saveMoney() { const person = document.getElementById('moneyPerson').value.trim(); const amount = parseFloat(document.getElementById('moneyAmount').value); if (!person || !amount) return toast('Fill required fields'); const mData = { person, amount, type: document.getElementById('moneyType').value, note: document.getElementById('moneyNote').value, due: document.getElementById('moneyDue').value }; const tempId = Date.now(); mData.id = tempId; mData.settled = false; STATE.money.push(mData); renderMoney(); renderDashboard(); closeModal('moneyModal'); save(); toast('Saved 💰'); ofetch('add_money.php', mData, d => { const m = STATE.money.find(x => x.id === tempId); if (m) m.id = d.id; renderMoney(); renderDashboard(); save(); }); }
function settleMoney(e, id) { if (e) e.stopPropagation(); const m = STATE.money.find(x => x.id === id); if (!m) return; m.settled = true; renderMoney(); save(); toast('Settled ✓'); ofetch('update_money.php', { id }); }
function deleteMoney(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this money record?')) return; STATE.money = STATE.money.filter(x => x.id !== id); renderMoney(); save(); toast('Deleted 🗑️'); ofetch('delete_money.php', { id }); }
function openMoneyModal() { document.getElementById('moneyPerson').value = ''; document.getElementById('moneyAmount').value = ''; document.getElementById('moneyNote').value = ''; document.getElementById('moneyDue').value = ''; document.getElementById('moneyModal').classList.add('open'); }
function setMoneyFilter(f, el) { STATE.moneyFilter = f; document.querySelectorAll('#screen-money .filter-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderMoney(); }
function renderMoney() { let records = [...STATE.money]; if (STATE.moneyFilter === 'lent') records = records.filter(m => m.type === 'lent'); else if (STATE.moneyFilter === 'borrowed') records = records.filter(m => m.type === 'borrowed'); else if (STATE.moneyFilter === 'pending') records = records.filter(m => !m.settled); else if (STATE.moneyFilter === 'settled') records = records.filter(m => m.settled); const lentTotal = STATE.money.filter(m => m.type === 'lent' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0); const owedTotal = STATE.money.filter(m => m.type === 'borrowed' && !m.settled).reduce((s, m) => s + parseFloat(m.amount || 0), 0); document.getElementById('totalLent').textContent = '$' + lentTotal.toFixed(2); document.getElementById('totalOwed').textContent = '$' + owedTotal.toFixed(2); const el = document.getElementById('moneyList'); if (records.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No records found</p></div>'; el.innerHTML = records.map(m => `<div class="money-item ${m.settled ? 'money-settled' : ''}"><div class="money-avatar ${m.type}">${m.person[0].toUpperCase()}</div><div class="money-info"><div class="money-name">${m.person} ${m.settled ? '<span class="pill pill-green" style="font-size:9px">Settled</span>' : ''}</div><div class="money-note">${m.note || (m.type === 'lent' ? 'You lent' : 'You borrowed')} ${m.due ? '· Due ' + fmtDisplay(m.due) : ''}</div></div><div style="text-align:right"><div class="money-amount ${m.type}">${m.type === 'lent' ? '+' : '-'}$${parseFloat(m.amount).toFixed(2)}</div>${!m.settled ? `<button class="settle-btn" onclick="settleMoney(event, ${m.id})">Settle</button>` : ''}<div onclick="deleteMoney(event, ${m.id})" style="font-size:16px;color:var(--text3);cursor:pointer;margin-top:4px;padding:4px;">🗑</div></div></div>`).join(''); }

// ============================================================
// ALARMS
// ============================================================
function saveAlarm() { const time = document.getElementById('alarmTime').value; if (!time) return toast('Please set a time'); const days = [...document.querySelectorAll('.day-btn.selected')].map(b => b.dataset.day).join(''); const [h, m] = time.split(':').map(Number); const aData = { time, hour: h, minute: m, label: document.getElementById('alarmLabel').value || 'Alarm', days }; const tempId = Date.now(); aData.id = tempId; aData.enabled = true; STATE.alarms.push(aData); renderAlarms(); closeModal('alarmModal'); save(); toast('Alarm set ⏰'); ofetch('add_alarm.php', aData, d => { const a = STATE.alarms.find(x => x.id === tempId); if (a) a.id = d.id; renderAlarms(); renderDashboard(); save(); }); }
function toggleAlarm(e, id) { if (e) e.stopPropagation(); const a = STATE.alarms.find(x => x.id === id); if (!a) return; a.enabled = !a.enabled; renderAlarms(); renderDashboard(); save(); toast(a.enabled ? 'Alarm enabled' : 'Alarm disabled'); ofetch('update_alarm.php', { id, enabled: a.enabled }); }
function deleteAlarm(e, id) { if (e) e.stopPropagation(); if (!confirm('Are you sure you want to delete this alarm?')) return; STATE.alarms = STATE.alarms.filter(x => x.id !== id); renderAlarms(); renderDashboard(); save(); toast('Alarm deleted 🗑️'); ofetch('delete_alarm.php', { id }); }
function openAlarmModal() { document.getElementById('alarmTime').value = ''; document.getElementById('alarmLabel').value = ''; document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected')); document.getElementById('alarmModal').classList.add('open'); }
function toggleDay(el) { el.classList.toggle('selected'); }
function renderAlarms() { const el = document.getElementById('alarmList'); if (STATE.alarms.length === 0) return el.innerHTML = '<div class="empty-state"><div class="empty-icon">⏰</div><p>No alarms set</p></div>'; el.innerHTML = STATE.alarms.map(a => { const [h, m] = a.time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h; const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']; const daysStr = a.days ? a.days.split('').map(d => dayNames[parseInt(d)]).join(' ') : 'Once'; return `<div class="alarm-item ${!a.enabled ? 'money-settled' : ''}"><div style="flex:1"><div class="alarm-time">${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')}<span class="alarm-time-ampm">${ampm}</span></div><div class="alarm-label">${a.label}</div><div class="alarm-days">${daysStr}</div></div><label class="alarm-toggle"><input type="checkbox" ${a.enabled ? 'checked' : ''} onchange="toggleAlarm(event, ${a.id})"><span class="toggle-slider"></span></label><div class="alarm-delete" onclick="deleteAlarm(event, ${a.id})">🗑</div></div>`; }).join(''); }
function setupAlarmTicks() { setInterval(() => { const now = new Date(); const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds(); if (s !== 0) return; STATE.alarms.filter(a => a.enabled && a.time).forEach(a => { const [ah, am] = a.time.split(':').map(Number); if (ah !== h || am !== m) return; const dayOfWeek = now.getDay().toString(); if (!a.days || a.days === '' || a.days.includes(dayOfWeek)) { sendSystemNotification("Alarm: " + a.label, formatTime(a.time)); try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==').play(); } catch (e) { } } }); }, 1000); }

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
function renderAttendance() { const el = document.getElementById('attendanceList'); if (!el) return; if (!STATE.attSelectedDate) STATE.attSelectedDate = fmtDate(new Date()); const selDateObj = new Date(STATE.attSelectedDate + 'T00:00:00'); const dayOfWeek = selDateObj.getDay(); const todaysRoutines = STATE.attendanceRoutines.filter(r => parseInt(r.dayOfWeek) === dayOfWeek).sort((a, b) => (a.startTime || a.time) > (b.startTime || b.time) ? 1 : -1); let html = `<div class="section-header" style="margin-top:20px;"><div class="section-title">Classes for ${selDateObj.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>`; if (todaysRoutines.length === 0) { html += '<div class="empty-state"><div class="empty-icon">🏖️</div><p>No classes scheduled for today.</p></div>'; } else { html += todaysRoutines.map(r => { const log = STATE.attendanceLogs.find(l => l.routineId === r.id && l.date === STATE.attSelectedDate); const currentStatus = log ? log.status : null; const stats = calculateAttendanceStats(r.id); const timeStr = r.startTime && r.endTime ? `${formatTime(r.startTime)} - ${formatTime(r.endTime)}` : formatTime(r.time || '00:00'); return `<div class="att-card" style="border-left: 4px solid var(--accent); position: relative;"><div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 8px;"><span onclick="openAttRoutineModalById(${r.id})" style="font-size:16px; color:var(--text3); cursor:pointer;" title="Edit Class">✏️</span><span onclick="deleteAttRoutine(event, ${r.id})" style="font-size:16px; color:var(--text3); cursor:pointer;" title="Delete Class">🗑</span></div><div class="att-header" style="padding-right: 50px;"><div class="att-title">${r.subject}</div></div><div style="font-size:12px; color:var(--text2); margin-top:4px;">⏰ ${timeStr} &nbsp;|&nbsp; 🏫 Room: ${r.room || 'N/A'}</div><div style="display:flex; justify-content:space-between; margin-top:12px; margin-bottom:8px; font-size:11px; color:var(--text2); font-family: 'Syne', sans-serif;"><span><b>Total Classes:</b> <span style="color:var(--text); font-size: 13px;">${stats.total}</span></span><span><b>Attended:</b> <span style="color:var(--green); font-size: 13px;">${stats.attended}</span></span><span><b>Missed:</b> <span style="color:var(--red); font-size: 13px;">${stats.missed}</span></span></div><div class="att-bar-bg" style="height: 4px;"><div class="att-bar-fill" style="width:${stats.pct}%; background: ${stats.pct >= 75 ? 'var(--green)' : 'var(--red)'}"></div></div><div style="display: flex; justify-content: space-between; font-size:11px; color:var(--text3); margin-bottom:12px;"><span>${stats.statsMsg}</span><span style="font-weight: 700; color: ${stats.pct >= 75 ? 'var(--green)' : 'var(--red)'};">${stats.pct.toFixed(1)}%</span></div><div class="att-controls" style="display:flex; gap:8px;"><button class="btn-secondary" style="flex:1; padding:8px; font-size:12px; background: ${currentStatus === 'attended' ? 'var(--green)' : 'var(--surface2)'}; color: ${currentStatus === 'attended' ? '#000' : 'var(--text)'};" onclick="updateAttLog(${r.id}, 'attended')">✅ Attended</button><button class="btn-secondary" style="flex:1; padding:8px; font-size:12px; background: ${currentStatus === 'missed' ? 'var(--red)' : 'var(--surface2)'}; color: ${currentStatus === 'missed' ? '#fff' : 'var(--text)'};" onclick="updateAttLog(${r.id}, 'missed')">❌ Missed</button><button class="btn-secondary" style="flex:1; padding:8px; font-size:12px; background: ${currentStatus === 'cancelled' ? 'var(--accent3)' : 'var(--surface2)'}; color: ${currentStatus === 'cancelled' ? '#000' : 'var(--text)'};" onclick="updateAttLog(${r.id}, 'cancelled')">⏸️ Cancel</button></div></div>`; }).join(''); } el.innerHTML = html; }

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
function renderExpenses() { if (!STATE.activeAccountId) { const mv = document.getElementById('expensesMainView'); const dv = document.getElementById('transactionDetailView'); if (mv) mv.style.display = 'block'; if (dv) dv.style.display = 'none'; } const el = document.getElementById('accountDisplay'); if (!el) return; if (!STATE.accounts || STATE.accounts.length === 0) { el.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon">💳</div><p>No accounts yet.<br>Tap <strong>+ Account</strong> to create one.</p></div>`; return; } el.innerHTML = STATE.accounts.map(acc => { const txCount = STATE.expenses.filter(e => e.accountId == acc.id).length; const bal = getAccountBalance(acc.id); return `<div onclick="openAccountDetail(${acc.id})" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;cursor:pointer;transition:all 0.2s;min-width:0;"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Account</div><div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${acc.name}</div><div style="font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};">$${bal.toFixed(2)}</div><div style="font-size:10px;color:var(--text3);margin-top:8px;">${txCount} transaction${txCount !== 1 ? 's' : ''}</div></div>`; }).join(''); }
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

function openAccountDetail(id) { STATE.activeAccountId = id; const acc = STATE.accounts.find(a => a.id == id); if (!acc) return; document.getElementById('expensesMainView').style.display = 'none'; document.getElementById('transactionDetailView').style.display = 'block'; document.getElementById('accountNameTitle').innerHTML = `${acc.name} <span onclick="deleteAccount(${acc.id})" style="font-size:16px;cursor:pointer;color:var(--red);margin-left:12px;padding:4px;" title="Delete Account">🗑️</span>`; renderTransactions(id); }
function hideTransactionDetail() { STATE.activeAccountId = null; document.getElementById('transactionDetailView').style.display = 'none'; document.getElementById('expensesMainView').style.display = 'block'; renderExpenses(); } function openTransactionModal() { const acc = STATE.accounts.find(a => a.id == STATE.activeAccountId); if (navigator.onLine && acc && acc.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!'); const m = document.getElementById('transactionModal'); if (!m) return toast('Modal not found!'); document.getElementById('transAmount').value = ''; document.getElementById('transNote').value = ''; document.getElementById('transCategory').value = 'Food'; m.classList.add('open'); }
function openAddFundModal() { const acc = STATE.accounts.find(a => a.id == STATE.activeAccountId); if (navigator.onLine && acc && acc.pendingSync) return toast('⏳ Waiting for cloud sync. Try again in a second!'); const m = document.getElementById('addFundModal'); if (!m) return toast('Fund modal not found!'); document.getElementById('fundAmount').value = ''; document.getElementById('fundNote').value = ''; m.classList.add('open'); }
function saveAddFund() { const amount = parseFloat(document.getElementById('fundAmount').value); const note = document.getElementById('fundNote').value.trim(); const accountId = STATE.activeAccountId; if (!amount || amount <= 0) return toast('Enter a valid amount'); if (!accountId) return toast('No account selected'); const now = new Date(); const dateStr = now.toISOString().split('T')[0]; const timeStr = now.toTimeString().slice(0, 5); const storedAmount = -Math.abs(amount); const tempId = Date.now(); const expenseData = { id: tempId, accountId, amount: storedAmount, category: 'Deposit', note: note || 'Added Funds', date: dateStr, time: timeStr }; STATE.expenses.push(expenseData); save(); renderTransactions(accountId); renderExpenses(); renderDashboard(); closeModal('addFundModal'); toast('Funds added! 💰'); ofetch('add_expense.php', expenseData, d => { const exp = STATE.expenses.find(e => e.id === tempId); if (exp) { exp.id = Number(d.id); save(); renderTransactions(accountId); } }); }
function saveTransaction() { const amount = parseFloat(document.getElementById('transAmount').value); const category = document.getElementById('transCategory').value; const note = document.getElementById('transNote').value.trim(); const accountId = STATE.activeAccountId; if (!amount || amount <= 0) return toast('Enter a valid amount'); if (!accountId) return toast('No account selected'); const now = new Date(); const dateStr = now.toISOString().split('T')[0]; const timeStr = now.toTimeString().slice(0, 5); const tempId = Date.now(); const expenseData = { id: tempId, accountId, amount, category, note, date: dateStr, time: timeStr }; STATE.expenses.push(expenseData); save(); renderTransactions(accountId); renderExpenses(); renderDashboard(); closeModal('transactionModal'); toast('Saved! ✅'); ofetch('add_expense.php', expenseData, d => { const exp = STATE.expenses.find(e => e.id === tempId); if (exp) { exp.id = Number(d.id); save(); renderTransactions(accountId); } }); }
function deleteExpense(btn) { const expenseId = btn.getAttribute('data-expense-id'); const accountId = btn.getAttribute('data-account-id'); if (!expenseId || expenseId === 'undefined') return toast('Cannot delete: missing ID.'); if (!confirm('Delete this transaction?')) return; STATE.expenses = STATE.expenses.filter(ex => ex.id != expenseId); renderTransactions(accountId); renderExpenses(); renderDashboard(); save(); toast('Transaction deleted 🗑️'); ofetch('delete_expense.php', { id: expenseId }); }
function deleteAccount(id) { if (!confirm('Delete this account and all its transactions? This cannot be undone.')) return; STATE.accounts = STATE.accounts.filter(a => a.id != id); STATE.expenses = STATE.expenses.filter(e => e.accountId != id); renderExpenses(); hideTransactionDetail(); renderDashboard(); save(); toast('Account deleted 🗑️'); ofetch('delete_account.php', { id }); }
function renderTransactions(accountId) { const list = document.getElementById('transactionList'); if (!list) return; const acc = STATE.accounts.find(a => a.id == accountId); const trans = STATE.expenses.filter(e => e.accountId == accountId).sort((a, b) => { const da = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00')); const db = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00')); return db - da; }); const expensesOnly = trans.filter(t => parseFloat(t.amount) > 0); const totalSpent = expensesOnly.reduce((s, t) => s + parseFloat(t.amount || 0), 0); const bal = getAccountBalance(accountId); const categoryIcons = { 'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Shopping': '🛍️', 'Health': '💊', 'Entertainment': '🎮', 'Education': '📚', 'Utilities': '💡', 'Other': '📌', 'Deposit': '💰' }; const catColors = ['#7c6ef5', '#5de8c1', '#f5a623', '#f5647c', '#64c8f5', '#c87cf5', '#f57c64']; const catTotals = {}; expensesOnly.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount || 0); }); const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]); let html = `<div style="background:linear-gradient(135deg,rgba(124,110,245,0.12),rgba(93,232,193,0.06));border:1px solid rgba(124,110,245,0.25);border-radius:var(--radius);padding:20px;margin-bottom:16px;"><div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Current Balance</div><div style="font-family:'Syne',sans-serif;font-size:38px;font-weight:800;color:${bal >= 0 ? 'var(--accent2)' : 'var(--red)'};line-height:1;">$${bal.toFixed(2)}</div><div style="display:flex;gap:24px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Total Spent</div><div style="font-size:18px;font-weight:700;color:var(--red);margin-top:2px;">-$${totalSpent.toFixed(2)}</div></div><div><div style="font-size:10px;color:var(--text3);text-transform:uppercase;">Transactions</div><div style="font-size:18px;font-weight:700;color:var(--text);margin-top:2px;">${trans.length}</div></div></div></div>`; if (catEntries.length > 0) { html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;"><div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:14px;">Spending by Category</div>`; catEntries.forEach(([cat, amt], i) => { const pct = totalSpent > 0 ? (amt / totalSpent * 100) : 0; const color = catColors[i % catColors.length]; const icon = categoryIcons[cat] || '📌'; html += `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><div style="display:flex;align-items:center;gap:6px;font-size:13px;"><span>${icon}</span><span style="font-weight:500;">${cat}</span></div><div><span style="font-size:13px;font-weight:700;color:var(--red);">-$${parseFloat(amt).toFixed(2)}</span><span style="font-size:10px;color:var(--text3);margin-left:6px;">${pct.toFixed(0)}%</span></div></div><div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.5s;"></div></div></div>`; }); html += `</div>`; } if (trans.length === 0) { html += `<div class="empty-state"><div class="empty-icon">💸</div><p>No expenses yet.<br>Tap + Expense to add one.</p></div>`; } else { const groups = {}; trans.forEach(t => { const d = t.date || 'Unknown'; if (!groups[d]) groups[d] = []; groups[d].push(t); }); const todayStr = new Date().toISOString().split('T')[0]; Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => { const dayTotal = groups[date].filter(t => t.amount > 0).reduce((s, t) => s + parseFloat(t.amount || 0), 0); let displayDate; try { displayDate = date === todayStr ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { displayDate = date; } html += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;padding:0 4px;"><span>${displayDate}</span><span style="color:var(--red);">-$${dayTotal.toFixed(2)}</span></div>`; groups[date].forEach(t => { const isIncome = parseFloat(t.amount) < 0; const displayAmt = Math.abs(parseFloat(t.amount)).toFixed(2); const amtSign = isIncome ? '+' : '-'; const amtColor = isIncome ? 'var(--green)' : 'var(--red)'; const icon = isIncome ? '💰' : (categoryIcons[t.category] || '📌'); let timeDisplay = ''; if (t.time) { const [h, m] = t.time.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; const dh = h > 12 ? h - 12 : h === 0 ? 12 : h; timeDisplay = `${dh}:${String(m).padStart(2, '0')} ${ampm}`; } html += `<div style="display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;"><div style="width:44px;height:44px;border-radius:12px;background:${isIncome ? 'rgba(93,232,193,0.1)' : 'rgba(245,100,124,0.1)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;">${icon}</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;">${t.category}</div><div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.note || 'No note'}</div>${timeDisplay ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;">🕐 ${timeDisplay}</div>` : ''}</div><div style="text-align:right;flex-shrink:0;"><div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:${amtColor};">${amtSign}$${displayAmt}</div><button data-expense-id="${t.id}" data-account-id="${accountId}" onclick="deleteExpense(this)" style="background:none;border:none;font-size:18px;color:var(--text3);cursor:pointer;margin-top:6px;padding:2px;">🗑</button></div></div>`; }); }); } list.innerHTML = html; }

// ===================== NOTES (Google Keep style) =====================
const NOTE_COLORS = ['', '#7c6ef5', '#5de8c1', '#f5a623', '#f5647c', '#64c8f5', '#c87cf5', '#f57c64'];
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
                    <span class="${it.done ? 'done' : ''}">${escapeHtml(it.text)}</span>
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
                        <div class="note-title" style="color:var(--accent2);">🎨 ${escapeHtml(n.title)}</div>
                        <div class="note-body">Canvas Note</div>
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

        return `<div class="note-card" style="${n.color ? `background:${n.color}22;border-color:${n.color}66` : ''}" onclick="${n.trashed ? '' : `openNoteModal(${n.id})`}">
                ${n.pinned ? '<div class="note-pin-badge">📌</div>' : ''}
                ${n.title ? `<div class="note-title">${escapeHtml(n.title)}</div>` : ''}
                ${bodyHtml}${checklistHtml}${tagsHtml}
                <div class="note-actions">${actions}</div>
            </div>`;
    }).join('');
}

// ============================================================
// INFINITE WHITEBOARD ENGINE
// ============================================================
let wbCanvas, wbCtx; let wbTool = 'pen'; let isDrawing = false; let isPanning = false; let startX = 0, startY = 0; let scale = 1; let panX = 0, panY = 0; let activeWbNoteId = null; let wbPaths = []; let wbTexts = [];
function openWhiteboardModal(noteId = null) { const modal = document.getElementById('whiteboardModal'); wbCanvas = document.getElementById('wbCanvas'); wbCtx = wbCanvas.getContext('2d'); activeWbNoteId = noteId; scale = 1; panX = 0; panY = 0; if (noteId) { const n = STATE.notes.find(x => x.id === noteId); document.getElementById('wbTitle').value = n.title || 'Untitled Board'; if (n.wbData) { wbPaths = n.wbData.paths || []; wbTexts = n.wbData.texts || []; } else { wbPaths = []; wbTexts = []; } } else { document.getElementById('wbTitle').value = 'New Whiteboard'; wbPaths = []; wbTexts = []; } modal.classList.add('open'); setTimeout(() => { const container = document.getElementById('wbContainer'); wbCanvas.width = container.clientWidth; wbCanvas.height = container.clientHeight; initWbEvents(); redrawWb(); }, 350); }
function setWbTool(tool) { wbTool = tool;['Pen', 'Eraser', 'Text'].forEach(t => { const btn = document.getElementById('wbTool' + t); if (btn) { btn.style.background = (t.toLowerCase() === tool) ? 'var(--accent)' : 'var(--surface2)'; btn.style.color = (t.toLowerCase() === tool) ? '#fff' : 'var(--text)'; } }); }
function zoomWb(factor) { scale *= factor; scale = Math.max(0.2, Math.min(scale, 5)); document.getElementById('wbZoomLevel').textContent = `${Math.round(scale * 100)}%`; redrawWb(); }
function resetWbView() { scale = 1; panX = 0; panY = 0; document.getElementById('wbZoomLevel').textContent = '100%'; redrawWb(); }
function clearWbCanvas() { if (!confirm('Clear entire whiteboard?')) return; wbPaths = []; wbTexts = []; redrawWb(); }
function initWbEvents() { const container = document.getElementById('wbContainer'); const getPos = (e) => { const rect = wbCanvas.getBoundingClientRect(); let clientX = e.clientX; let clientY = e.clientY; if (e.touches && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } return { x: (clientX - rect.left - panX) / scale, y: (clientY - rect.top - panY) / scale }; }; const startAction = (e) => { if (e.button === 1 || e.shiftKey || (e.touches && e.touches.length > 1)) { isPanning = true; let clientX = e.touches ? e.touches[0].clientX : e.clientX; let clientY = e.touches ? e.touches[0].clientY : e.clientY; startX = clientX - panX; startY = clientY - panY; container.style.cursor = 'grab'; return; } const pos = getPos(e); if (wbTool === 'text') { const txt = prompt('Enter text:'); if (txt) { wbTexts.push({ text: txt, x: pos.x, y: pos.y, color: document.getElementById('wbColor').value, size: parseInt(document.getElementById('wbSize').value) * 5 }); redrawWb(); } return; } isDrawing = true; const color = wbTool === 'eraser' ? '#ffffff' : document.getElementById('wbColor').value; const size = parseInt(document.getElementById('wbSize').value); wbPaths.push({ tool: wbTool, color, size, points: [{ x: pos.x, y: pos.y }] }); }; const moveAction = (e) => { if (isPanning) { e.preventDefault(); let clientX = e.touches ? e.touches[0].clientX : e.clientX; let clientY = e.touches ? e.touches[0].clientY : e.clientY; panX = clientX - startX; panY = clientY - startY; redrawWb(); return; } if (!isDrawing) return; e.preventDefault(); const pos = getPos(e); const currentPath = wbPaths[wbPaths.length - 1]; if (currentPath) { currentPath.points.push({ x: pos.x, y: pos.y }); redrawWb(); } }; const endAction = () => { isDrawing = false; isPanning = false; container.style.cursor = 'crosshair'; }; container.onmousedown = startAction; container.onmousemove = moveAction; container.onmouseup = container.onmouseleave = endAction; container.ontouchstart = startAction; container.ontouchmove = moveAction; container.ontouchend = container.ontouchcancel = endAction; container.onwheel = (e) => { e.preventDefault(); const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9; zoomWb(zoomFactor); }; }
function redrawWb() { if (!wbCtx) return; wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height); wbCtx.save(); wbCtx.translate(panX, panY); wbCtx.scale(scale, scale); wbPaths.forEach(path => { if (path.points.length < 1) return; wbCtx.beginPath(); wbCtx.strokeStyle = path.color; wbCtx.lineWidth = path.size; wbCtx.lineCap = 'round'; wbCtx.lineJoin = 'round'; wbCtx.moveTo(path.points[0].x, path.points[0].y); for (let i = 1; i < path.points.length; i++) { wbCtx.lineTo(path.points[i].x, path.points[i].y); } wbCtx.stroke(); }); wbTexts.forEach(t => { wbCtx.font = `${t.size}px 'DM Sans', sans-serif`; wbCtx.fillStyle = t.color; wbCtx.fillText(t.text, t.x, t.y); }); wbCtx.restore(); }
function saveWhiteboardNote() { const title = document.getElementById('wbTitle').value.trim() || 'Untitled Board'; const now = new Date().toISOString(); const wbData = { paths: wbPaths, texts: wbTexts }; if (activeWbNoteId) { const n = STATE.notes.find(x => x.id === activeWbNoteId); if (n) { n.title = title; n.wbData = wbData; n.updatedAt = now; } } else { const tempId = Date.now(); const nData = { id: tempId, title: title, body: '[Whiteboard Note]', isWhiteboard: true, wbData: wbData, pinned: false, archived: false, trashed: false, updatedAt: now }; STATE.notes.unshift(nData); } save(); renderNotes(); closeModal('whiteboardModal'); toast('Whiteboard saved! 🎨'); }

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
function rescheduleAllReminders() { STATE.tasks.forEach(t => { if (t.reminder && !t.completed) scheduleReminderToast(t); }); }
function requestNotificationPermission() { if ("Notification" in window) { if (Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); } } }
function sendSystemNotification(title, bodyText) { toast(`🔔 ${title} ${bodyText ? '- ' + bodyText : ''}`); if ("Notification" in window && Notification.permission === "granted") { try { if (navigator.serviceWorker) { navigator.serviceWorker.ready.then(function (registration) { registration.showNotification(title, { body: bodyText, vibrate: [200, 100, 200] }); }).catch(function () { new Notification(title, { body: bodyText }); }); } else { new Notification(title, { body: bodyText }); } } catch (e) { console.log("Notification failed", e); } } }

// ============================================================
// STANDBY MODE LOGIC
// ============================================================
let standbyClockInterval, standbyPomoInterval; let pomoTimeLeft = 25 * 60; let isPomoRunning = false;
function openStandby() { document.getElementById('zenStandby').style.display = 'flex'; try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } switchStandbyMode('clock'); }
function exitStandby() { document.getElementById('zenStandby').style.display = 'none'; clearInterval(standbyClockInterval); clearInterval(standbyPomoInterval); try { if (document.exitFullscreen) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { } }
function setStandbyTheme(themeClass, el) { document.getElementById('zenStandby').className = themeClass; document.querySelectorAll('.zen-theme-dot').forEach(d => { d.classList.remove('active'); d.style.borderColor = 'transparent'; }); el.classList.add('active'); el.style.borderColor = '#fff'; }
function switchStandbyMode(mode) { document.getElementById('nav-clock').classList.remove('active'); document.getElementById('nav-pomo').classList.remove('active'); document.getElementById('nav-' + mode).classList.add('active'); if (mode === 'clock') { document.getElementById('zenClock').style.display = 'flex'; document.getElementById('zenPomo').style.display = 'none'; clearInterval(standbyClockInterval); standbyClockInterval = setInterval(updateStandbyClock, 1000); updateStandbyClock(); } else { document.getElementById('zenClock').style.display = 'none'; document.getElementById('zenPomo').style.display = 'flex'; clearInterval(standbyClockInterval); updatePomoDisplay(); } }
function updateStandbyClock() { const d = new Date(); document.getElementById('zenTimeDisplay').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; document.getElementById('zenSecDisplay').textContent = String(d.getSeconds()).padStart(2, '0'); document.getElementById('zenDateDisplay').textContent = d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }); }
function togglePomodoro() { isPomoRunning = !isPomoRunning; document.getElementById('zenPomoBtn').textContent = isPomoRunning ? 'Pause' : 'Start'; if (isPomoRunning) { standbyPomoInterval = setInterval(() => { if (pomoTimeLeft > 0) { pomoTimeLeft--; updatePomoDisplay(); } else { resetPomodoro(); toast('Focus Session Complete! 🍅'); try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==').play(); } catch (e) { } } }, 1000); } else { clearInterval(standbyPomoInterval); } }
function resetPomodoro() { isPomoRunning = false; clearInterval(standbyPomoInterval); document.getElementById('zenPomoBtn').textContent = 'Start'; pomoTimeLeft = 25 * 60; updatePomoDisplay(); }
function updatePomoDisplay() { const m = Math.floor(pomoTimeLeft / 60); const s = pomoTimeLeft % 60; document.getElementById('zenPomoDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; const C = 282.74; const offset = C - (pomoTimeLeft / (25 * 60)) * C; document.getElementById('zenPomoRing').style.strokeDasharray = C; document.getElementById('zenPomoRing').style.strokeDashoffset = offset; }

// ============================================================
// DYNAMIC NAVIGATION ENGINE
// ============================================================
function renderNavbar() {
    const nav = document.getElementById('mainBottomNav');
    if (!nav) return;

    // SAFETY CHECK: If old save data wiped the preferences, rebuild them instantly
    if (!STATE.navPreferences || STATE.navPreferences.length === 0) {
        STATE.navPreferences = Object.keys(NAV_MODULES);
        STATE.hiddenNavModules = [];
        save();
    }

    // Filter out any ghost/deleted modules
    const safeNavs = STATE.navPreferences.filter(key => NAV_MODULES[key]);

    nav.innerHTML = safeNavs.map(key => {
        const mod = NAV_MODULES[key];
        const isActive = currentScreen === key ? 'active' : '';
        return `
        <div class="nav-item ${isActive}" onclick="navTo('${key}')">
            <div class="nav-icon">${mod.icon}</div>
            <div class="nav-label">${mod.label}</div>
        </div>`;
    }).join('');
}

function renderNavSettings() {
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