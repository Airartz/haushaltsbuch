// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBALER APP STATE
// ═══════════════════════════════════════════════════════════════════════════════
const App = {
  user:        null,
  socket:      null,
  currentView: null,
  dropdownOpen: false
};

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  closeDropdown();
  // Dropdown neu öffnen damit Icon/Label aktuell ist
}

async function initApp() {
  initTheme();
  try {
    const meRes  = await fetch('/auth/me');
    const meData = await meRes.json();

    if (!meData.authenticated) {
      const setupRes  = await fetch('/auth/needs-setup');
      const setupData = await setupRes.json();
      setupData.needsSetup ? renderSetup() : renderLogin();
      return;
    }

    App.user   = meData;
    App.socket = io({ reconnection: true });
    setupSocketListeners();
    renderAppShell();
    setupSwipeNavigation(); // Tab-Wechsel per Wischen
    setupModalSwipe();       // Modal per Wischen schließen

    // Service Worker registrieren
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Push-Subscription wiederherstellen (nur wenn Berechtigung schon erteilt)
    initPushSilent();

    // Zur letzten Seite navigieren
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigateTo(hash);

  } catch (err) {
    console.error('[App] Init-Fehler:', err);
    document.getElementById('app').innerHTML = `
      <div class="loading-state" style="height:100vh;flex-direction:column;gap:12px">
        ${Icons.alert_circle}
        <p style="color:var(--gray-500);font-size:14px">Verbindungsfehler. Bitte Seite neu laden.</p>
        <button class="btn btn-primary btn-sm" onclick="location.reload()">Neu laden</button>
      </div>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SOCKET.IO LISTENER
// ═══════════════════════════════════════════════════════════════════════════════
function setupSocketListeners() {
  App.socket.on('shopping:update', (items) => {
    if (App.currentView === 'shopping') renderShoppingItems(items);
    if (App.currentView === 'dashboard') _refreshDashShopWidget(items);
  });

  App.socket.on('task:completed', (data) => {
    if (data.userId !== App.user.id) {
      showToast(`${data.userName} hat "${data.taskTitle}" erledigt`, 'info');
    }
    if (App.currentView === 'dashboard') loadDashboard();
    else if (App.currentView === 'tasks') loadTasks();
  });

  App.socket.on('task:created', () => {
    if (App.currentView === 'dashboard') loadDashboard();
    else if (App.currentView === 'tasks') loadTasks();
    else if (App.currentView === 'admin') loadAdmin();
  });

  App.socket.on('task:updated', () => {
    if (App.currentView === 'dashboard') loadDashboard();
    else if (App.currentView === 'tasks') loadTasks();
    else if (App.currentView === 'admin') loadAdmin();
  });

  App.socket.on('task:deleted', () => {
    if (App.currentView === 'dashboard') loadDashboard();
    else if (App.currentView === 'tasks') loadTasks();
    else if (App.currentView === 'admin') loadAdmin();
  });

  App.socket.on('calendar:update', () => {
    if (App.currentView === 'calendar') loadCalendar();
  });

  App.socket.on('dienstplan:update', () => {
    if (App.currentView === 'calendar' && typeof Calendar !== 'undefined' && Calendar.view === 'dienstplan') {
      loadDienstplan();
    }
  });

  App.socket.on('mealplan:update', () => {
    if (App.currentView === 'recipes' && typeof loadMealPlanEntries === 'function') {
      loadMealPlanEntries();
    }
  });

  App.socket.on('recipes:update', () => {
    if (App.currentView === 'recipes' && typeof loadRecipes === 'function') {
      loadRecipes();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  APP SHELL RENDERN
// ═══════════════════════════════════════════════════════════════════════════════
function renderAppShell() {
  const adminNav = App.user.role === 'admin' ? `
    <button class="nav-item" id="nav-admin" onclick="navigateTo('admin')">
      ${Icons.admin}<span>Verwaltung</span>
    </button>` : '';

  document.getElementById('app').innerHTML = `
    <header class="header">
      <div class="header-logo">
        ${Icons.home}
        <span>Zuhause</span>
      </div>
      <div class="header-right">
        <div class="user-avatar" id="user-avatar-btn" onclick="toggleDropdown(event)" title="${App.user.name}">
          ${App.user.name.charAt(0).toUpperCase()}
        </div>
        <div id="dropdown-container"></div>
      </div>
    </header>

    <main class="main-content" id="main-content">
      <div class="loading-state"><div class="spinner"></div></div>
    </main>

    <nav class="bottom-nav">
      <button class="nav-item" id="nav-dashboard" onclick="navigateTo('dashboard')">
        ${Icons.home}<span>Dashboard</span>
      </button>
      <button class="nav-item" id="nav-tasks" onclick="navigateTo('tasks')">
        ${Icons.tasks}<span>Aufgaben</span>
      </button>
      <button class="nav-item" id="nav-shopping" onclick="navigateTo('shopping')">
        ${Icons.shopping}<span>Einkauf</span>
      </button>
      <button class="nav-item" id="nav-calendar" onclick="navigateTo('calendar')">
        ${Icons.calendar_nav}<span>Kalender</span>
      </button>
      <button class="nav-item" id="nav-recipes" onclick="navigateTo('recipes')">
        ${Icons.recipes}<span>Rezepte</span>
      </button>
      ${adminNav}
    </nav>

    <div id="modal-overlay" class="modal-overlay hidden" onclick="closeModal()"></div>
    <div id="modal" class="modal hidden"></div>
    <div id="toast-container" class="toast-container"></div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
async function navigateTo(view) {
  App.currentView = view;
  window.location.hash = view;
  closeDropdown();

  // Dashboard-Timer stoppen wenn Tab gewechselt wird
  if (view !== 'dashboard' && typeof stopDashboardClock === 'function') {
    stopDashboardClock();
  }

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-${view}`);
  if (activeBtn) activeBtn.classList.add('active');

  switch (view) {
    case 'dashboard': await loadDashboard(); break;
    case 'tasks':     await loadTasks();     break;
    case 'shopping':  await loadShopping();  break;
    case 'calendar':  await loadCalendar();  break;
    case 'recipes':   await loadRecipes();   break;
    case 'admin':
      if (App.user.role === 'admin') await loadAdmin();
      else navigateTo('dashboard');
      break;
    default: navigateTo('dashboard');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DROPDOWN MENÜ
// ═══════════════════════════════════════════════════════════════════════════════
function toggleDropdown(event) {
  event.stopPropagation();
  if (App.dropdownOpen) { closeDropdown(); return; }

  const roleLabel = App.user.role === 'admin' ? 'Administrator' : 'Benutzer';

  // Notification.permission ist synchron: 'granted' | 'denied' | 'default'
  const perm      = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  let pushLabel, pushIcon;
  if (!supported)           { pushLabel = 'Push nicht verfügbar';        pushIcon = Icons.bell_off; }
  else if (perm === 'denied') { pushLabel = 'Ben. blockiert (Browser)';   pushIcon = Icons.bell_off; }
  else if (perm === 'granted') { pushLabel = 'Benachrichtigungen aktiv';  pushIcon = Icons.bell; }
  else                         { pushLabel = 'Benachrichtigungen aktivieren'; pushIcon = Icons.bell; }

  const testButton = (supported && perm === 'granted')
    ? `<button class="dropdown-item" onclick="sendTestPush(); closeDropdown();">${Icons.bell} <span>Test-Nachricht senden</span></button>`
    : '';

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const themeIcon = isDark
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const themeLabel = isDark ? 'Light Mode' : 'Dark Mode';

  document.getElementById('dropdown-container').innerHTML = `
    <div class="header-dropdown" id="header-dropdown">
      <div class="dropdown-user-info">
        <div class="dropdown-user-name">${escapeHtml(App.user.name)}</div>
        <div class="dropdown-user-role">${roleLabel}</div>
      </div>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item" onclick="toggleDarkMode()">
        ${themeIcon}<span>${themeLabel}</span>
      </button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item" onclick="togglePushNotification()">
        ${pushIcon}<span>${pushLabel}</span>
      </button>
      ${testButton}
      <div class="dropdown-divider"></div>
      <button class="dropdown-item" onclick="hardReloadApp(); closeDropdown();">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        <span>App neu laden</span>
      </button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item danger" onclick="logout()">
        ${Icons.logout}<span>Abmelden</span>
      </button>
    </div>`;

  App.dropdownOpen = true;
  setTimeout(() => document.addEventListener('click', closeDropdown, { once: true }), 0);
}


function closeDropdown() {
  document.getElementById('dropdown-container').innerHTML = '';
  App.dropdownOpen = false;
}

async function togglePushNotification() {
  closeDropdown();

  const isIOS        = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isHTTPS      = location.protocol === 'https:' || location.hostname === 'localhost';

  if (!isHTTPS) {
    showToast('Push benötigt HTTPS – bitte https:// in der Adresszeile verwenden', 'error');
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (isIOS && !isStandalone) {
      showToast('iPhone/iPad: App erst zum Homescreen hinzufügen (Teilen → Zum Home-Bildschirm), dann Push aktivieren', 'info');
    } else {
      showToast('Push wird von diesem Browser/Gerät nicht unterstützt', 'error');
    }
    return;
  }

  if (typeof Notification === 'undefined') {
    showToast('Benachrichtigungen werden nicht unterstützt', 'error');
    return;
  }

  if (Notification.permission === 'denied') {
    showToast('Benachrichtigungen sind blockiert – in den Browser-Einstellungen erlauben', 'error');
    return;
  }

  await initPush();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function openModal(title, bodyHtml, footerHtml = '') {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle" id="modal-drag-handle"></div>
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="btn-icon" onclick="closeModal()">${Icons.close}</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
  `;
  modal.style.transform = '';
  modal.style.transition = '';
  modal.classList.remove('hidden');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.transform = '';
    modal.style.transition = '';
    modal.classList.add('hidden');
  }
  document.getElementById('modal-overlay')?.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODAL PER WISCHGESTE SCHLIESSEN
// ═══════════════════════════════════════════════════════════════════════════════
function setupModalSwipe() {
  const modal = document.getElementById('modal');
  if (!modal) return;

  let startY = 0, deltaY = 0, startX = 0, active = false;

  modal.addEventListener('touchstart', (e) => {
    startY  = e.touches[0].clientY;
    startX  = e.touches[0].clientX;
    deltaY  = 0;
    active  = true;
    modal.style.transition = 'none';
  }, { passive: true });

  modal.addEventListener('touchmove', (e) => {
    if (!active) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;

    // Nur vertikales Wischen (kein horizontales Scrollen des Inhalts blockieren)
    if (Math.abs(dx) > Math.abs(dy)) return;

    deltaY = Math.max(0, dy); // nur nach unten
    if (deltaY > 0) {
      modal.style.transform = `translateX(-50%) translateY(${deltaY}px)`;
    }
  }, { passive: true });

  modal.addEventListener('touchend', () => {
    active = false;
    if (deltaY > 110) {
      // Genug gewischt → Modal schließen
      modal.style.transition = 'transform 0.22s ease';
      modal.style.transform  = `translateX(-50%) translateY(110%)`;
      setTimeout(closeModal, 230);
    } else {
      // Zurückschnappen
      modal.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
      modal.style.transform  = `translateX(-50%) translateY(0)`;
      setTimeout(() => { modal.style.transition = ''; modal.style.transform = ''; }, 260);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB-WECHSEL PER WISCHGESTE (Links/Rechts)
// ═══════════════════════════════════════════════════════════════════════════════
function setupSwipeNavigation() {
  if (window.innerWidth >= 1024) return; // Kein Swipe auf Desktop
  const content = document.getElementById('main-content');
  if (!content) return;

  let startX = 0, startY = 0, swiping = false;

  content.addEventListener('touchstart', (e) => {
    // Kein Tab-Swipe wenn Touch in einem horizontal scrollbaren Element startet
    let el = e.target;
    while (el && el !== content) {
      const ox = window.getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') { swiping = false; return; }
      el = el.parentElement;
    }
    startX  = e.touches[0].clientX;
    startY  = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });

  content.addEventListener('touchend', (e) => {
    if (!swiping) return;
    swiping = false;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Modal offen? Nicht navigieren
    if (!document.getElementById('modal')?.classList.contains('hidden')) return;

    // Swipe muss horizontal dominieren und mindestens 55px
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

    const views = App.user.role === 'admin'
      ? ['dashboard', 'tasks', 'shopping', 'calendar', 'recipes', 'admin']
      : ['dashboard', 'tasks', 'shopping', 'calendar', 'recipes'];

    const idx = views.indexOf(App.currentView);
    if (idx === -1) return;

    if (dx < 0 && idx < views.length - 1) navigateTo(views[idx + 1]); // links → nächster Tab
    else if (dx > 0 && idx > 0)           navigateTo(views[idx - 1]); // rechts → vorheriger Tab
  }, { passive: true });
}
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-show'));
  });

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showLoading() {
  const mc = document.getElementById('main-content');
  if (mc) mc.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
}

function getRecurrenceLabel(r) {
  return { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich' }[r] || r;
}

function getDayName(d) {
  return ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'][d] ?? '';
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Nacht';
  if (h < 12) return 'Morgen';
  if (h < 17) return 'Tag';
  return 'Abend';
}

// Geteilte completeTask Funktion (kann von Dashboard und Tasks genutzt werden)
async function completeTask(taskId, afterFn) {
  const btn = document.getElementById(`check-${taskId}`);
  if (btn) { btn.disabled = true; btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>`; }

  const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' });

  if (res.ok) {
    showToast('Aufgabe erledigt!', 'success');
    if (afterFn) afterFn(taskId);
  } else {
    const data = await res.json();
    showToast(data.error || 'Fehler beim Abhaken', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = Icons.check; }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REZEPTE - COMING SOON
// ═══════════════════════════════════════════════════════════════════════════════
function renderRecipesComingSoon() {
  document.getElementById('main-content').innerHTML = `
    <div class="page-header">
      <div><h2>Rezepte</h2><p class="page-subtitle">Wochenplan</p></div>
    </div>
    <div class="coming-soon-card">
      ${Icons.recipes_lg}
      <h3>Demnächst verfügbar</h3>
      <p>Wöchentlich wechselnde Rezepte werden gerade entwickelt.</p>
      <div class="coming-soon-tag">In Kürze</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH: LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">${Icons.home}</div>
          <h1>Zuhause</h1>
          <p>Bitte anmelden</p>
        </div>
        <form onsubmit="handleLogin(event)">
          <div class="form-group">
            <label for="login-email">E-Mail-Adresse</label>
            <input type="email" id="login-email" placeholder="name@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="login-password">Passwort</label>
            <input type="password" id="login-password" placeholder="Passwort eingeben" required autocomplete="current-password">
          </div>
          <div class="form-error hidden" id="login-error"></div>
          <button type="submit" class="btn btn-primary btn-full" id="login-btn" style="margin-top:8px">Anmelden</button>
        </form>
      </div>
    </div>`;
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  btn.disabled = true; btn.textContent = 'Anmelden...';
  errEl.classList.add('hidden');

  const res  = await fetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!res.ok) {
    errEl.textContent = data.error; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Anmelden';
    return;
  }
  window.location.reload();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH: SETUP (Erstkonfiguration)
// ═══════════════════════════════════════════════════════════════════════════════
function renderSetup() {
  document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">${Icons.home}</div>
          <h1>Willkommen</h1>
          <p>Admin-Konto einrichten</p>
        </div>
        <form onsubmit="handleSetup(event)">
          <div class="form-group">
            <label for="setup-name">Dein Name</label>
            <input type="text" id="setup-name" placeholder="Vorname" required>
          </div>
          <div class="form-group">
            <label for="setup-email">E-Mail-Adresse</label>
            <input type="email" id="setup-email" placeholder="name@example.com" required>
          </div>
          <div class="form-group">
            <label for="setup-password">Passwort <span style="color:var(--gray-400);font-weight:400">(mind. 8 Zeichen)</span></label>
            <input type="password" id="setup-password" placeholder="Passwort wählen" required minlength="8">
          </div>
          <div class="form-error hidden" id="setup-error"></div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:8px">Admin-Konto erstellen</button>
        </form>
      </div>
    </div>`;
}

async function handleSetup(e) {
  e.preventDefault();
  const name     = document.getElementById('setup-name').value;
  const email    = document.getElementById('setup-email').value;
  const password = document.getElementById('setup-password').value;
  const errEl    = document.getElementById('setup-error');

  const res  = await fetch('/auth/setup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();

  if (!res.ok) {
    errEl.textContent = data.error; errEl.classList.remove('hidden');
    return;
  }
  window.location.reload();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════
async function hardReloadApp() {
  try {
    // Alle Caches löschen
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Service Worker de-registrieren
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (_) {}
  // Seite komplett neu laden (kein Cache)
  window.location.reload(true);
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.reload();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initApp);
