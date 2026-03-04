// --- LOCAL STATE & DATA PERSISTENCE ---
const STORAGE_KEY = 'codeflow_data_v1';
let appState = {
    xp: 30, level: 1, streak: 0,
    stats: { totalMinutes: 0, sessions: 0, completedTasks: 0, dailyMinutes: [0,0,0,0,0,0,0], heatmap: [] },
    tasks: [], goals: [], completedSessionsList: []
};

if(appState.stats.heatmap.length === 0) {
    for(let i=0; i<30; i++) { appState.stats.heatmap.push(Math.floor(Math.random() * 5)); }
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try { 
            const parsed = JSON.parse(saved);
            appState = { ...appState, ...parsed, stats: { ...appState.stats, ...parsed.stats } };
            if(appState.stats.completedTasks === undefined) appState.stats.completedTasks = 0;
        } catch (e) { console.error("Could not load save data"); }
    }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); }

// --- AUTHENTICATION LOGIC ---
function checkAuth() {
    const sessionToken = sessionStorage.getItem('codeflow_auth');
    const userProfile = sessionStorage.getItem('codeflow_profile');
    
    if(sessionToken && userProfile) {
        document.getElementById('auth-container').classList.remove('active');
        document.getElementById('app-container').style.display = 'block';
        
        const profile = JSON.parse(userProfile);
        document.getElementById('profile-btn-name').innerText = profile.name;
        document.getElementById('prof-name').value = profile.name;
        document.getElementById('prof-email').value = sessionStorage.getItem('codeflow_email') || 'developer@gmail.com';
    } else if(sessionToken && !userProfile) {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('onboarding-view').style.display = 'block';
    } else {
        document.getElementById('auth-container').classList.add('active');
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
        document.getElementById('onboarding-view').style.display = 'none';
    }
}

function handleLogin(e) { 
    e.preventDefault(); 
    
    const email = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    // Extra JS validation layer for visual feedback
    if(!email.endsWith('@gmail.com')) {
        triggerToast("Login Failed", "You must use a valid @gmail.com address.");
        return;
    }
    if(pass.length < 8) {
        triggerToast("Login Failed", "Password must be at least 8 characters.");
        return;
    }

    sessionStorage.setItem('codeflow_auth', 'true'); 
    sessionStorage.setItem('codeflow_email', email);
    checkAuth(); 
}

function handleOnboarding(e) {
    e.preventDefault();
    sessionStorage.setItem('codeflow_profile', JSON.stringify({
        name: document.getElementById('onboard-name').value, age: document.getElementById('onboard-age').value,
        gender: document.getElementById('onboard-gender').value, focus: document.getElementById('onboard-focus').value
    })); checkAuth();
}
function logoutApp() { sessionStorage.removeItem('codeflow_auth'); sessionStorage.removeItem('codeflow_profile'); checkAuth(); }

// --- INITIALIZATION ---
let vantaEffect;
let activityChartInstance = null; 

window.onload = () => {
    loadState();
    const savedTheme = localStorage.getItem('codeflow_theme') || 'red';
    changeTheme(savedTheme); 

    checkAuth();
    renderPlannerDays();
    renderTasks();
    renderGoals();
    renderDashboardSessions();
    updateGlobalUI();
    updateDisplay();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('goal-date').value = today;
    document.getElementById('task-date').value = today;

    startNotificationEngine();
};

// --- THEMES & VANTA.JS ---
function changeTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('codeflow_theme', themeName);
    initVanta();
}
function initVanta() {
    const isDark = document.body.classList.contains('dark-mode');
    const theme = document.body.getAttribute('data-theme') || 'red';
    if (vantaEffect) vantaEffect.destroy();
    
    let hc, mc;
    if(theme === 'blue') { hc = 0x41d2ef; mc = isDark ? 0x194b57 : 0xe3f8fc; } 
    else if(theme === 'green') { hc = 0x4cb572; mc = isDark ? 0x1b452a : 0xe9f6ed; } 
    // New Monochrome Theme Colors
    else if(theme === 'mono') { hc = isDark ? 0xe0e4e8 : 0x263238; mc = isDark ? 0x333333 : 0xcccccc; }
    else { hc = 0xdb4d39; mc = isDark ? 0x5a231b : 0xfbeae7; }

    vantaEffect = VANTA.FOG({
        el: "#vanta-bg", mouseControls: true, touchControls: true, gyroControls: false,
        minHeight: 200.00, minWidth: 200.00, highlightColor: hc, midtoneColor: mc,
        lowlightColor: isDark ? 0x1e1e1e : 0xffffff, baseColor: isDark ? 0x121212 : 0xf5f7fa,
        blurFactor: 0.60, speed: 1.50, zoom: 1.00
    });
}

// --- REAL-TIME NOTIFICATIONS & TOASTS ---
function triggerToast(title, message) {
    const soundToggle = document.getElementById('sound-toggle');
    const soundEnabled = soundToggle ? soundToggle.checked : true;
    
    if(soundEnabled) {
        const audio = document.getElementById('notif-sound');
        if(audio) { audio.currentTime = 0; audio.play().catch(e => console.log('Notification audio blocked.')); }
    }

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-bell"></i><div><strong style="display:block; font-size:1rem;">${title}</strong><span style="font-size:0.85rem; color:var(--text-muted);">${message}</span></div>`;
    
    container.appendChild(toast);
    
    const list = document.getElementById('notif-list');
    if(list) {
        list.innerHTML = `<div style="font-size:0.85rem; padding:8px; background:var(--card-hover-bg); border-radius:4px;"><strong>${title}:</strong> ${message}</div>` + list.innerHTML;
        document.getElementById('notif-dot').style.display = 'block';
    }

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 5000);
}

function toggleNotif() {
    const drop = document.getElementById('notif-dropdown');
    document.getElementById('notif-dot').style.display = 'none';
    drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
}

function startNotificationEngine() {
    setInterval(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}); 

        appState.tasks.forEach(t => {
            if(!t.done && !t.notified && t.rawDate === todayStr && t.rawTime === timeStr) {
                triggerToast("Task Reminder", `Time to start: ${t.rawTitle}`);
                t.notified = true; saveState();
            }
        });
    }, 10000);
}

// --- NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.nav-links button').forEach(btn => btn.classList.remove('active'));
    const targetBtn = Array.from(document.querySelectorAll('.nav-links button')).find(b => b.getAttribute('onclick').includes(tabId));
    if(targetBtn) targetBtn.classList.add('active');
    
    document.querySelectorAll('.page-view').forEach(page => {
        page.classList.remove('active');
        const elements = page.querySelectorAll('.animate-up');
        elements.forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = null; });
    });
    
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'analytics') { updateStatsUI(); renderHeatmap(); }
}

function switchSettingsTab(panelId) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active'); document.getElementById(panelId).classList.add('active');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    document.getElementById('dark-mode-icon').className = document.body.classList.contains('dark-mode') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    initVanta(); 
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function toggleFullScreen() {
    const elem = document.getElementById("focus-fs-container");
    if (!document.fullscreenElement) { elem.requestFullscreen().catch(e=>e); document.getElementById("fs-btn").innerHTML = '<i class="fa-solid fa-compress"></i>'; } 
    else { document.exitFullscreen(); document.getElementById("fs-btn").innerHTML = '<i class="fa-solid fa-expand"></i>'; }
}

// --- CALENDAR ---
function renderPlannerDays() {
    const container = document.getElementById('planner-days'); if (!container) return;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; let html = ''; const today = new Date();
    for(let i = -3; i <= 3; i++) {
        let d = new Date(today); d.setDate(today.getDate() + i);
        html += `<div class="day-card ${i===0?'active':''}" onclick="selectDay(this)"><div class="day-name">${days[d.getDay()]}</div><div class="day-num">${d.getDate()}</div></div>`;
    } container.innerHTML = html;
}
function selectDay(el) { document.querySelectorAll('.day-card').forEach(c => c.classList.remove('active')); el.classList.add('active'); }

// --- TASKS & GOALS ---
function saveTask() {
    const title = document.getElementById('task-title').value; 
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value; 
    
    if(!title || !time || !date) return alert("Please fill all task fields.");
    
    let displayTitle = `[${new Date(`1970-01-01T${time}:00`).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] ${title}`;
    
    appState.tasks.push({ id: Date.now(), title: displayTitle, rawTitle: title, rawDate: date, rawTime: time, done: false, notified: false }); 
    saveState();
    
    document.getElementById('task-title').value = ''; document.getElementById('task-time').value = ''; 
    closeModal('task-modal'); renderTasks(); triggerToast('Task Created', 'It will alert you at ' + time);
}

function renderTasks() {
    const dashList = document.getElementById('dash-task-list'); const planList = document.getElementById('planner-task-list');
    if(!dashList || !planList) return;
    if(appState.tasks.length === 0) {
        dashList.innerHTML = planList.innerHTML = '<div style="text-align:center; padding: 30px; color:var(--text-muted); font-weight: 500;">No pending issues.</div>'; return;
    }
    let html = ''; appState.tasks.forEach(t => {
        html += `<div class="task-item"><strong style="text-decoration: ${t.done?'line-through':'none'}; color: ${t.done?'var(--text-muted)':'var(--text-main)'}; font-weight: 500;">${t.title}</strong><div class="task-checkbox ${t.done?'checked':''}" onclick="toggleTask(${t.id})"></div></div>`;
    });
    dashList.innerHTML = planList.innerHTML = html;
}

function toggleTask(id) { 
    const task = appState.tasks.find(t => t.id === id); 
    if(task) { 
        task.done = !task.done; 
        if(task.done) {
            appState.stats.completedTasks += 1;
            if(document.getElementById('sound-toggle').checked) { const a = document.getElementById('notif-sound'); if(a){a.currentTime = 0; a.play().catch(e=>e);} }
        } else {
            appState.stats.completedTasks -= 1;
        }
        saveState(); renderTasks(); updateGlobalUI();
    } 
}

function saveGoal() {
    const title = document.getElementById('goal-title').value; const date = document.getElementById('goal-date').value; const total = parseInt(document.getElementById('goal-total').value);
    if(!title || !date || isNaN(total)) return alert("Please fill all goal fields.");
    appState.goals.push({ id: Date.now(), title, date, total, current: 0 }); saveState();
    document.getElementById('goal-title').value = ''; document.getElementById('goal-total').value = ''; closeModal('goal-modal'); renderGoals();
}
function updateGoalProgress(id, inc) {
    const goal = appState.goals.find(g => g.id === id);
    if(goal) {
        goal.current = Math.max(0, Math.min(goal.total, goal.current + inc));
        if(inc > 0) { appState.xp += 5; if(appState.xp >= 100) { appState.level++; appState.xp %= 100; } updateGlobalUI(); }
        saveState(); renderGoals();
    }
}
function renderGoals() {
    const list = document.getElementById('goals-list'); if(!list) return;
    if(appState.goals.length === 0) { list.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-muted); border: 1px dashed var(--input-border); border-radius: var(--radius-md);">Set a specific course goal, deadline, and track your progress.</div>'; return; }
    let html = ''; appState.goals.forEach(g => {
        const percent = Math.round((g.current / g.total) * 100); const isComplete = g.current === g.total;
        html += `<div class="goal-card interactive-card"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><h4 style="font-size:1.1rem; font-weight:600; margin-bottom:4px; color: ${isComplete ? 'var(--primary)' : 'var(--text-main)'}">${isComplete ? '<i class="fa-solid fa-check-circle"></i> ' : ''}${g.title}</h4><span style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-regular fa-calendar"></i> Deadline: ${new Date(g.date).toLocaleDateString()}</span></div><strong style="font-family:var(--font-numbers); font-size:1.2rem; color:var(--primary);">${percent}%</strong></div><div class="goal-progress-bar"><div class="goal-progress-fill" style="width: ${percent}%; background: ${isComplete ? 'var(--primary-hover)' : 'var(--primary)'};"></div></div><div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;"><span style="font-size:0.9rem; font-weight:500;">Mod <span style="color:var(--text-main); font-weight:600;">${g.current}</span> / ${g.total}</span><div style="display:flex; gap:8px;"><button class="icon-btn" style="width:28px; height:28px;" onclick="updateGoalProgress(${g.id}, -1)"><i class="fa-solid fa-minus"></i></button><button class="icon-btn" style="width:28px; height:28px;" onclick="updateGoalProgress(${g.id}, 1)"><i class="fa-solid fa-plus"></i></button></div></div></div>`;
    }); list.innerHTML = html;
}

// --- FOCUS & AUDIO MODAL LOGIC ---
let timerInterval; let defaultDuration = 25 * 60; let timeLeft = defaultDuration; let isRunning = false;

function updateDisplay() { const t = document.getElementById('time-display'); if(t) t.textContent = `${Math.floor(timeLeft/60).toString().padStart(2,'0')}:${(timeLeft%60).toString().padStart(2,'0')}`; }

function handleFocusPlayClick() {
    if(isRunning) {
        clearInterval(timerInterval);
        document.getElementById('play-pause-btn').innerHTML = '<i class="fa-solid fa-play" style="margin-left:4px;"></i>';
        isRunning = false;
        document.getElementById('focus-audio-player').pause();
    } else {
        if(timeLeft < defaultDuration) {
            startTimerCountdown();
            document.getElementById('focus-audio-player').play().catch(e=>e);
        } else {
            openModal('focus-setup-modal');
        }
    }
}

function startFocusSession() {
    const taskName = document.getElementById('setup-focus-task').value || 'Deep Work Session';
    const durationMins = parseInt(document.getElementById('setup-focus-time').value) || 25;
    const audioTrack = document.getElementById('setup-focus-audio').value;

    document.getElementById('active-focus-task').innerText = taskName;
    defaultDuration = durationMins * 60;
    timeLeft = defaultDuration;
    updateDisplay();

    const player = document.getElementById('focus-audio-player');
    if(audioTrack) {
        player.src = audioTrack;
        player.load();
        player.volume = 0.5;
        player.play().catch(e => { triggerToast("Audio Alert", "Could not play the track. Check the file name."); });
    } else {
        player.pause();
    }

    closeModal('focus-setup-modal');
    
    const elem = document.getElementById("focus-fs-container");
    if (!document.fullscreenElement) { elem.requestFullscreen().catch(e=>e); document.getElementById("fs-btn").innerHTML = '<i class="fa-solid fa-compress"></i>'; }
    startTimerCountdown();
}

function startTimerCountdown() {
    timerInterval = setInterval(() => { if(timeLeft>0) { timeLeft--; updateDisplay(); } else { finishSession(true); } }, 1000); 
    document.getElementById('play-pause-btn').innerHTML = '<i class="fa-solid fa-pause"></i>'; 
    isRunning = true;
}

function resetTimer() { 
    clearInterval(timerInterval); timeLeft = defaultDuration; isRunning = false; 
    document.getElementById('play-pause-btn').innerHTML = '<i class="fa-solid fa-play" style="margin-left:4px;"></i>'; 
    document.getElementById('focus-audio-player').pause(); updateDisplay(); 
}

function finishSessionEarly() { if(confirm("Terminate this block early?")) finishSession(false); }

function finishSession(completed) {
    clearInterval(timerInterval); isRunning = false; 
    document.getElementById('play-pause-btn').innerHTML = '<i class="fa-solid fa-play" style="margin-left:4px;"></i>';
    document.getElementById('focus-audio-player').pause();

    const mins = Math.floor((defaultDuration - timeLeft) / 60);
    if(mins > 0) {
        appState.stats.totalMinutes += mins; appState.stats.sessions += 1;
        appState.stats.dailyMinutes[4] += mins; appState.stats.heatmap[appState.stats.heatmap.length-1] += 1;
        
        appState.xp += (mins * 2) + (completed ? 10 : 0); 
        if(appState.xp >= 100) { appState.level++; appState.xp %= 100; } 
        appState.streak = 1; 
        
        appState.completedSessionsList.push(`Deep Work: ${mins}m`);
        saveState(); renderDashboardSessions(); updateGlobalUI(); 
        triggerToast("Session Complete", `Logged ${mins} minutes of focus.`);
    }
    resetTimer();
}

// --- ANALYTICS UI (CHART.JS) ---
function renderDashboardSessions() {
    const list = document.getElementById('dash-session-list'); if(!list) return;
    if(appState.completedSessionsList.length === 0) { list.innerHTML = '<div style="text-align:center; padding: 30px; color:var(--text-muted); font-weight: 500;">No sessions logged today.</div>'; return; }
    let html = ''; appState.completedSessionsList.slice(-3).reverse().forEach(s => { html += `<div class="session-item"><strong style="font-weight:500;">${s}</strong><i class="fa-solid fa-check-circle"></i></div>`; });
    list.innerHTML = html;
}
function updateGlobalUI() {
    document.getElementById('nav-level').innerText = `Lv.${appState.level}`; document.getElementById('nav-streak').innerText = appState.streak;
    if(document.getElementById('side-study-time')) document.getElementById('side-study-time').innerText = `${appState.stats.totalMinutes}m`;
    if(document.getElementById('side-sessions')) document.getElementById('side-sessions').innerText = appState.stats.sessions;
}

function updateStatsUI() {
    const { totalMinutes, sessions, completedTasks, dailyMinutes } = appState.stats;
    document.getElementById('stat-weekly-time').innerText = `${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`;
    document.getElementById('stat-avg-session').innerText = sessions > 0 ? `${Math.round(totalMinutes/sessions)} min` : '0 min';
    document.getElementById('stat-tasks-done').innerText = completedTasks || 0;
    document.getElementById('stat-total-sessions').innerText = sessions;

    const ctx = document.getElementById('weeklyActivityChart');
    if(ctx) {
        if(activityChartInstance) { activityChartInstance.destroy(); }
        const isDark = document.body.classList.contains('dark-mode');
        const themeColor = getComputedStyle(document.body).getPropertyValue('--primary').trim();
        const textColor = isDark ? '#A0A0A0' : '#717171';

        activityChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Minutes Coded', data: dailyMinutes, backgroundColor: themeColor, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: isDark ? '#333' : '#E0E4E8' }, ticks: { color: textColor } }, x: { grid: { display: false }, ticks: { color: textColor } } } }
        });
    }
}

function renderHeatmap() {
    const container = document.getElementById('heatmap-container'); if(!container) return; container.innerHTML = '';
    appState.stats.heatmap.forEach((c) => {
        let hc = c>5 ? 3 : c>2 ? 2 : c>0 ? 1 : 0;
        container.innerHTML += `<div class="heatmap-cell ${hc?'heat-'+hc:'heat-0'}" data-tooltip="${c===1?'1 commit':c+' commits'}"></div>`;
    });
}

// --- NETWORK TAB ---
function addFriend() {
    const code = document.getElementById('friend-code').value; if(!code) return;
    const list = document.getElementById('friends-list');
    if(list.innerText.includes('No connections')) list.innerHTML = '';
    list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:var(--card-hover-bg); border-radius:var(--radius-sm); border:1px solid var(--card-border);"><div style="display:flex; align-items:center; gap:16px;"><div style="width:40px; height:40px; background:var(--primary-light); color:var(--primary); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-code-branch"></i></div><div><strong style="font-size:1rem; color:var(--text-main);">Dev (${code})</strong><br><span style="color:var(--primary);font-size:0.85rem;font-weight:500;">• Online</span></div></div><button class="btn-secondary" style="padding:6px 12px; font-size: 0.9rem;">Ping</button></div>`;
    document.getElementById('friend-code').value = ''; triggerToast('Connection Added', `You are now linked with ${code}`);
}
function joinRoom(btn) { btn.innerText = "Connecting..."; setTimeout(() => { btn.innerText = "Connected"; btn.className = "btn-secondary"; triggerToast("Chat Room", "You have joined the secure channel."); }, 1000); }