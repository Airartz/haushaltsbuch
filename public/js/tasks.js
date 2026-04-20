// ═══════════════════════════════════════════════════════════════════════════════
//  TASKS VIEW
// ═══════════════════════════════════════════════════════════════════════════════
let _allTasks = [];

async function loadTasks() {
  showLoading();
  try {
    const res = await fetch('/api/tasks');
    _allTasks = await res.json();
    renderTasksList();
  } catch (_) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">${Icons.alert_circle}<h3>Ladefehler</h3></div>`;
  }
}

function renderTasksList() {
  const now         = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const dateStr     = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `
    <div class="page-header">
      <div>
        <h2>Alle Aufgaben</h2>
        <p class="page-subtitle">${dateStr}</p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAddTaskModal()">
        ${Icons.plus} Neu
      </button>
    </div>`;

  if (_allTasks.length === 0) {
    html += `
      <div class="empty-state">
        ${Icons.tasks_lg}
        <h3>Noch keine Aufgaben</h3>
        <p>Erstelle deine erste Aufgabe mit dem Button oben.</p>
      </div>`;
  } else {
    // Nur Tasks die heute fällig sind
    const dueTasks = _allTasks.filter(t => t.due_today);
    const rest     = _allTasks.filter(t => !t.due_today);

    const done     = dueTasks.filter(t => t.completion_id);
    const pending  = dueTasks.filter(t => !t.completion_id);
    const overdue  = pending.filter(t => t.time_of_day < currentTime);
    const upcoming = pending.filter(t => t.time_of_day >= currentTime);

    if (overdue.length > 0) {
      html += `<div class="section-label section-label-warning">${Icons.clock} Überfällig</div>`;
      overdue.forEach(t => { html += renderFullTaskCard(t, 'overdue'); });
    }
    if (upcoming.length > 0) {
      html += `<div class="section-label">${Icons.calendar} Ausstehend</div>`;
      upcoming.forEach(t => { html += renderFullTaskCard(t, 'upcoming'); });
    }
    if (done.length > 0) {
      html += `<div class="section-label section-label-success">${Icons.check} Heute erledigt</div>`;
      done.forEach(t => { html += renderFullTaskCard(t, 'done'); });
    }
    if (rest.length > 0) {
      html += `<div class="section-label">${Icons.calendar} Andere Tage</div>`;
      rest.forEach(t => { html += renderFullTaskCard(t, 'upcoming'); }); // zeigen ohne Status
    }
  }

  document.getElementById('main-content').innerHTML = html;
}

function renderFullTaskCard(task, status) {
  const isDone = !!task.completion_id;
  const checkBtn = isDone
    ? `<div class="task-check-done">${Icons.check_sm}</div>`
    : `<button class="btn-check-sm" id="check-${task.id}"
              onclick="completeTask(${task.id}, refreshTaskCard)"
              title="Erledigt">${Icons.check_sm}</button>`;

  return `
    <div class="task-card task-card-full task-card-${status}" id="task-full-${task.id}">
      <div class="task-card-left">${checkBtn}</div>
      <div class="task-card-content ${isDone ? 'task-content-done' : ''}">
        <div class="task-time-row">
          ${Icons.clock_sm}
          <span>${task.time_of_day} Uhr</span>
          <span class="badge badge-blue">${getRecurrenceLabel(task.recurrence)}</span>
          ${task.recurrence === 'weekly'  ? `<span class="badge badge-gray">${getDayName(task.day_of_week)}</span>` : ''}
          ${task.recurrence === 'monthly' ? `<span class="badge badge-gray">Tag ${task.day_of_month}</span>` : ''}
          ${isDone ? `<span class="badge badge-green">${Icons.check_sm} Erledigt</span>` : ''}
        </div>
        <h4>${escapeHtml(task.title)}</h4>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          <span class="badge badge-gray">${Icons.user_sm} ${escapeHtml(task.assigned_name || '')}</span>
        </div>
      </div>
      <div class="task-card-actions">
        <button class="btn-icon" onclick="openEditTaskModal(${task.id})" title="Bearbeiten">${Icons.edit}</button>
        <button class="btn-icon btn-icon-danger" onclick="deleteTaskFromList(${task.id})" title="Löschen">${Icons.trash}</button>
      </div>
    </div>`;
}

function refreshTaskCard(taskId) {
  // Einfach die Liste neu laden – Socket-Event kommt sowieso
  loadTasks();
}

// ─── Aufgabe löschen ──────────────────────────────────────────────────────────
async function deleteTaskFromList(taskId) {
  if (!confirm('Aufgabe wirklich löschen?')) return;

  const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (res.ok) { showToast('Aufgabe gelöscht', 'info'); loadTasks(); }
  else         { showToast('Fehler beim Löschen', 'error'); }
}

// ─── Neue Aufgabe Modal ───────────────────────────────────────────────────────
function openAddTaskModal() {
  openModal('Neue Aufgabe', buildTaskForm(null), `
    <button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="submitTask()">Hinzufügen</button>`);

  updateRecurrenceFields();
  if (App.user.role === 'admin') loadUsersIntoSelect();
}

function openEditTaskModal(taskId) {
  const task = _allTasks.find(t => t.id === taskId);
  if (!task) return;

  openModal('Aufgabe bearbeiten', buildTaskForm(task), `
    <button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="submitTask(${taskId})">Speichern</button>`);

  updateRecurrenceFields();
  if (App.user.role === 'admin') loadUsersIntoSelect(task.assigned_to);
}

function buildTaskForm(task) {
  const isEdit = !!task;
  return `
    <div class="form-group">
      <label for="tf-title">Titel *</label>
      <input type="text" id="tf-title" placeholder="z.B. Küche wischen" required
             value="${escapeHtml(task?.title || '')}">
    </div>
    <div class="form-group">
      <label for="tf-desc">Beschreibung <span style="color:var(--gray-400);font-weight:400">(optional)</span></label>
      <textarea id="tf-desc" placeholder="Weitere Hinweise...">${escapeHtml(task?.description || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="tf-time">Uhrzeit *</label>
        <input type="time" id="tf-time" required value="${task?.time_of_day || '08:00'}">
      </div>
      <div class="form-group">
        <label for="tf-recurrence">Wiederholung</label>
        <select id="tf-recurrence" class="form-select" onchange="updateRecurrenceFields()">
          <option value="daily"   ${task?.recurrence === 'daily'   ? 'selected' : ''}>Täglich</option>
          <option value="weekly"  ${task?.recurrence === 'weekly'  ? 'selected' : ''}>Wöchentlich</option>
          <option value="monthly" ${task?.recurrence === 'monthly' ? 'selected' : ''}>Monatlich</option>
        </select>
      </div>
    </div>
    <div id="tf-weekly-fields" class="hidden">
      <div class="form-group">
        <label for="tf-dow">Wochentag</label>
        <select id="tf-dow" class="form-select">
          ${['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].map((d, i) =>
            `<option value="${i}" ${task?.day_of_week == i ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="tf-monthly-fields" class="hidden">
      <div class="form-group">
        <label for="tf-dom">Tag des Monats</label>
        <input type="number" id="tf-dom" min="1" max="31" value="${task?.day_of_month || 1}">
      </div>
    </div>
    ${App.user.role === 'admin' ? `
    <div class="form-group" id="tf-assign-group">
      <label for="tf-assigned">Zugewiesen an</label>
      <select id="tf-assigned" class="form-select">
        <option>Laden...</option>
      </select>
    </div>` : ''}
    <div class="form-error hidden" id="tf-error"></div>`;
}

function updateRecurrenceFields() {
  const val = document.getElementById('tf-recurrence')?.value;
  document.getElementById('tf-weekly-fields')?.classList.toggle('hidden', val !== 'weekly');
  document.getElementById('tf-monthly-fields')?.classList.toggle('hidden', val !== 'monthly');
}

async function loadUsersIntoSelect(selectedId) {
  const res   = await fetch('/api/users');
  const users = await res.json();
  const sel   = document.getElementById('tf-assigned');
  if (!sel) return;
  sel.innerHTML = users.map(u =>
    `<option value="${u.id}" ${u.id === (selectedId || App.user.id) ? 'selected' : ''}>${escapeHtml(u.name)}</option>`
  ).join('');
}

async function submitTask(editId) {
  const title       = document.getElementById('tf-title')?.value?.trim();
  const description = document.getElementById('tf-desc')?.value?.trim();
  const time_of_day = document.getElementById('tf-time')?.value;
  const recurrence  = document.getElementById('tf-recurrence')?.value;
  const day_of_week  = document.getElementById('tf-dow')?.value;
  const day_of_month = document.getElementById('tf-dom')?.value;
  const assigned_to  = document.getElementById('tf-assigned')?.value;
  const errEl        = document.getElementById('tf-error');

  if (!title || !time_of_day) {
    errEl.textContent = 'Titel und Uhrzeit sind Pflichtfelder.';
    errEl.classList.remove('hidden');
    return;
  }

  const payload = { title, description, recurrence, time_of_day, day_of_week, day_of_month, assigned_to };
  const url     = editId ? `/api/tasks/${editId}` : '/api/tasks';
  const method  = editId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal();
    showToast(editId ? 'Aufgabe gespeichert' : 'Aufgabe erstellt', 'success');
    loadTasks();
  } else {
    const data = await res.json();
    errEl.textContent = data.error || 'Fehler';
    errEl.classList.remove('hidden');
  }
}
