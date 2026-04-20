// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════
let _dashboardTimer = null;

async function loadDashboard() {
  showLoading();
  stopDashboardClock();
  try {
    const [taskRes, calRes, shopRes] = await Promise.all([
      fetch('/api/tasks/dashboard'),
      fetch(`/api/calendar/events?from=${_dashToday()}&to=${_dashTomorrow()}`),
      fetch('/api/shopping')
    ]);
    const taskData  = await taskRes.json();
    const calEvents = await calRes.json();
    const shopItems = await shopRes.json();
    renderDashboard(taskData, calEvents, shopItems || []);
  } catch (_) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">${Icons.alert_circle}<h3>Ladefehler</h3><p>Verbindung prüfen und neu laden.</p></div>`;
  }
}

function _dashToday() { return new Date().toISOString().split('T')[0]; }
function _dashTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function stopDashboardClock() {
  if (_dashboardTimer) { clearInterval(_dashboardTimer); _dashboardTimer = null; }
}

function startDashboardClock() {
  stopDashboardClock();
  _dashboardTimer = setInterval(() => {
    const timeEl = document.getElementById('dash-clock');
    if (!timeEl) { stopDashboardClock(); return; }

    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    // Jede volle Minute Tasks still im Hintergrund aktualisieren (kein Neu-Laden)
    if (now.getSeconds() === 0) { _silentRefreshTasks(); }
  }, 1000);
}

async function _silentRefreshTasks() {
  try {
    const [taskRes, calRes, shopRes] = await Promise.all([
      fetch('/api/tasks/dashboard'),
      fetch(`/api/calendar/events?from=${_dashToday()}&to=${_dashTomorrow()}`),
      fetch('/api/shopping')
    ]);
    const taskData  = await taskRes.json();
    const calEvents = await calRes.json();
    const shopItems = await shopRes.json();

    const mc = document.getElementById('main-content');
    if (!mc) return;

    // Bestehende dynamische Bereiche entfernen
    mc.querySelectorAll('.task-card, .section-label, .empty-state, .dashboard-footer, .dash-cal-section, .dash-shop-widget')
      .forEach(el => el.remove());

    // Neu einfügen (nach dem greeting-card)
    const greeting = mc.querySelector('.greeting-card');
    if (!greeting) return;

    const { overdue, upcoming } = taskData;
    const total = overdue.length + upcoming.length;

    // Shopping-Widget (offene Artikel)
    const openItems = (shopItems || []).filter(i => !i.in_cart);
    if (openItems.length > 0) {
      const shopDiv = document.createElement('div');
      shopDiv.className = 'dash-shop-widget';
      shopDiv.setAttribute('onclick', "navigateTo('shopping')");
      shopDiv.innerHTML = _renderShopWidgetInner(openItems);
      greeting.insertAdjacentElement('afterend', shopDiv);
    }

    // Kalender-Events (nach dem Shopping-Widget einfügen)
    if (calEvents.length > 0) {
      const todayStr = _dashToday();
      const todayEvs    = calEvents.filter(e => e.event_date === todayStr);
      const tomorrowEvs = calEvents.filter(e => e.event_date !== todayStr);
      let calHtml = '';
      if (todayEvs.length)    { calHtml += `<div class="dash-cal-group-label">Heute</div>`;  todayEvs.forEach(e => calHtml += _renderDashCalItem(e, true)); }
      if (tomorrowEvs.length) { calHtml += `<div class="dash-cal-group-label">Morgen</div>`; tomorrowEvs.forEach(e => calHtml += _renderDashCalItem(e, false)); }
      const calDiv = document.createElement('div');
      calDiv.className = 'dash-cal-section';
      calDiv.setAttribute('onclick', "navigateTo('calendar')");
      calDiv.innerHTML = `<div class="dash-cal-header">${Icons.calendar}<span>Termine</span></div>${calHtml}`;
      greeting.insertAdjacentElement('afterend', calDiv);
    }

    // Tasks
    let tasksHtml = '';
    if (total === 0) {
      tasksHtml = `<div class="empty-state">${Icons.check_circle}<h3>Alles erledigt!</h3><p>Keine anstehenden Aufgaben in den nächsten 3 Stunden.</p></div>`;
    } else {
      if (overdue.length)  { tasksHtml += `<div class="section-label section-label-warning">${Icons.clock} Überfällig (${overdue.length})</div>`; overdue.forEach(t => tasksHtml += renderDashboardTaskCard(t, 'overdue')); }
      if (upcoming.length) { tasksHtml += `<div class="section-label">${Icons.clock} Nächste 3 Stunden (${upcoming.length})</div>`; upcoming.forEach(t => tasksHtml += renderDashboardTaskCard(t, 'upcoming')); }
    }
    tasksHtml += `<div class="dashboard-footer"><button class="btn btn-outline btn-sm" onclick="navigateTo('tasks')">${Icons.tasks} Alle Aufgaben</button></div>`;
    mc.insertAdjacentHTML('beforeend', tasksHtml);
  } catch (_) { /* still im Hintergrund — kein Fehler anzeigen */ }
}

function _renderShopWidgetInner(items) {
  const count = items.length;
  const preview = items.slice(0, 3).map(i => escapeHtml(i.name)).join(', ');
  const more = count > 3 ? ` +${count - 3}` : '';
  return `
    <div class="dash-shop-header">
      ${Icons.shopping}<span>Einkaufsliste</span>
      <span class="dash-shop-badge">${count}</span>
    </div>
    <div class="dash-shop-preview">${preview}${more}</div>`;
}

function renderDashboard({ overdue, upcoming }, calEvents = [], shopItems = []) {
  const now      = new Date();
  const timeStr  = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dateStr  = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const total    = overdue.length + upcoming.length;
  const name     = App.user.name.split(' ')[0];

  let html = `
    <div class="greeting-card">
      <div class="greeting-time" id="dash-clock">${timeStr}</div>
      <h2>Guten ${getGreeting()}, ${escapeHtml(name)}</h2>
      <p>${dateStr}</p>
    </div>`;

  // ── Shopping-Widget ────────────────────────────────────────────────────
  const openItems = (shopItems || []).filter(i => !i.in_cart);
  if (openItems.length > 0) {
    html += `<div class="dash-shop-widget" onclick="navigateTo('shopping')">${_renderShopWidgetInner(openItems)}</div>`;
  }

  // ── Kalender-Shortcut ──────────────────────────────────────────────────
  if (calEvents.length > 0) {
    const todayStr = _dashToday();
    const todayEvents = calEvents.filter(e => e.event_date === todayStr);
    const tomorrowEvents = calEvents.filter(e => e.event_date !== todayStr);

    let calHtml = '';

    if (todayEvents.length > 0) {
      calHtml += `<div class="dash-cal-group-label">Heute</div>`;
      todayEvents.forEach(ev => { calHtml += _renderDashCalItem(ev, true); });
    }
    if (tomorrowEvents.length > 0) {
      calHtml += `<div class="dash-cal-group-label">Morgen</div>`;
      tomorrowEvents.forEach(ev => { calHtml += _renderDashCalItem(ev, false); });
    }

    html += `
      <div class="dash-cal-section" onclick="navigateTo('calendar')">
        <div class="dash-cal-header">
          ${Icons.calendar}
          <span>Termine</span>
        </div>
        ${calHtml}
      </div>`;
  }

  if (total === 0) {
    html += `
      <div class="empty-state">
        ${Icons.check_circle}
        <h3>Alles erledigt!</h3>
        <p>Keine anstehenden Aufgaben in den nächsten 3 Stunden.</p>
      </div>
      <div class="dashboard-footer">
        <button class="btn btn-outline btn-sm" onclick="navigateTo('tasks')">
          ${Icons.tasks} Alle Aufgaben
        </button>
      </div>`;
  } else {
    if (overdue.length > 0) {
      html += `<div class="section-label section-label-warning">${Icons.clock} Überfällig (${overdue.length})</div>`;
      overdue.forEach(t => { html += renderDashboardTaskCard(t, 'overdue'); });
    }
    if (upcoming.length > 0) {
      html += `<div class="section-label">${Icons.clock} Nächste 3 Stunden (${upcoming.length})</div>`;
      upcoming.forEach(t => { html += renderDashboardTaskCard(t, 'upcoming'); });
    }
    html += `
      <div class="dashboard-footer">
        <button class="btn btn-outline btn-sm" onclick="navigateTo('tasks')">
          ${Icons.tasks} Alle Aufgaben ansehen
        </button>
      </div>`;
  }

  document.getElementById('main-content').innerHTML = html;

  // Live-Uhr starten
  startDashboardClock();
}

function _renderDashCalItem(ev, isToday) {
  const timeStr = ev.event_time
    ? `<span class="dash-cal-time">${ev.event_time}${ev.end_time ? ' – ' + ev.end_time : ''}</span>`
    : `<span class="dash-cal-time">Ganztägig</span>`;

  // Prüfen ob Event bald ansteht
  const now = new Date();
  const evDate = new Date(ev.event_date + 'T' + (ev.event_time || '23:59'));
  const isUpcoming = isToday && evDate >= now && (evDate - now) < 3 * 60 * 60 * 1000;
  const pulseClass = isUpcoming ? ' dash-cal-item-upcoming' : '';

  return `
    <div class="dash-cal-item${pulseClass}">
      <div class="dash-cal-dot" style="background:${ev.color || '#1A56DB'}"></div>
      <div class="dash-cal-info">
        <span class="dash-cal-title">${escapeHtml(ev.title)}</span>
        ${timeStr}
      </div>
    </div>`;
}

function renderDashboardTaskCard(task, status) {
  return `
    <div class="task-card task-card-${status}" id="dash-task-${task.id}">
      <div class="task-card-content">
        <div class="task-card-time">
          ${Icons.clock_sm}
          ${task.time_of_day} Uhr
        </div>
        <h4>${escapeHtml(task.title)}</h4>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          <span class="badge badge-blue">${getRecurrenceLabel(task.recurrence)}</span>
          ${task.recurrence === 'weekly' ? `<span class="badge badge-gray">${getDayName(task.day_of_week)}</span>` : ''}
          <span class="badge badge-gray">${Icons.user_sm} ${escapeHtml(task.assigned_name || '')}</span>
        </div>
      </div>
      <button class="btn-check" id="check-${task.id}"
              onclick="completeTask(${task.id}, removeDashboardTask)"
              title="Als erledigt markieren">
        ${Icons.check}
      </button>
    </div>`;
}

function _refreshDashShopWidget(items) {
  const mc = document.getElementById('main-content');
  if (!mc) return;
  const greeting = mc.querySelector('.greeting-card');
  if (!greeting) return;

  // Remove existing widget
  mc.querySelectorAll('.dash-shop-widget').forEach(el => el.remove());

  const openItems = (items || []).filter(i => !i.in_cart);
  if (openItems.length > 0) {
    const shopDiv = document.createElement('div');
    shopDiv.className = 'dash-shop-widget';
    shopDiv.setAttribute('onclick', "navigateTo('shopping')");
    shopDiv.innerHTML = _renderShopWidgetInner(openItems);
    greeting.insertAdjacentElement('afterend', shopDiv);
  }
}

function removeDashboardTask(taskId) {
  const card = document.getElementById(`dash-task-${taskId}`);
  if (!card) return;
  card.classList.add('task-completed-anim');
  setTimeout(() => {
    card.remove();
    const remaining = document.querySelectorAll('.task-card');
    if (remaining.length === 0) loadDashboard();
  }, 320);
}
