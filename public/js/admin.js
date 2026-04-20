// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN VIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function loadAdmin() {
  showLoading();
  try {
    const [usersRes, tasksRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/tasks')
    ]);
    const users = await usersRes.json();
    const tasks = await tasksRes.json();
    renderAdmin(users, tasks);
    loadUpdateInfo();
  } catch (_) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">${Icons.alert_circle}<h3>Ladefehler</h3></div>`;
  }
}

function renderAdmin(users, tasks) {
  const todayTasks = tasks.filter(t => !t.completion_id);
  const doneTasks  = tasks.filter(t =>  t.completion_id);

  const html = `
    <div class="page-header">
      <div><h2>Verwaltung</h2><p class="page-subtitle">Admin-Bereich</p></div>
    </div>

    <!-- ── Update ── -->
    <div class="admin-section">
      <div class="section-header">
        <h3>App-Update</h3>
        <button class="btn btn-outline btn-sm" onclick="checkUpdate()">
          ${Icons.refresh} Prüfen
        </button>
      </div>
      <div id="update-info">
        <div class="update-loading">Lade Version…</div>
      </div>
    </div>

    <!-- ── Benutzer ── -->
    <div class="admin-section">
      <div class="section-header">
        <h3>Benutzer</h3>
        <button class="btn btn-primary btn-sm" onclick="openAddUserModal()">
          ${Icons.plus} Neu
        </button>
      </div>
      <div id="admin-user-list">
        ${users.map(u => renderUserCard(u)).join('')}
      </div>
    </div>

    <!-- ── Alle Aufgaben ── -->
    <div class="admin-section">
      <div class="section-header">
        <h3>Aufgaben heute</h3>
        <button class="btn btn-primary btn-sm" onclick="openAddTaskModal()">
          ${Icons.plus} Neu
        </button>
      </div>
      ${tasks.length === 0
        ? `<div class="empty-state-sm">Noch keine Aufgaben vorhanden.</div>`
        : `<div class="task-list-admin">
            ${tasks.map(t => renderAdminTaskCard(t)).join('')}
           </div>`
      }
    </div>`;

  document.getElementById('main-content').innerHTML = html;
}

function renderUserCard(u) {
  const isSelf = u.id === App.user.id;
  return `
    <div class="user-card" id="user-card-${u.id}">
      <div class="user-avatar-lg">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${escapeHtml(u.name)}</div>
        <div class="user-email">${escapeHtml(u.email)}</div>
        <div class="user-badges">
          <span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">
            ${u.role === 'admin' ? 'Administrator' : 'Benutzer'}
          </span>
          ${isSelf ? '<span class="badge badge-gray">Du</span>' : ''}
        </div>
      </div>
      <div class="user-actions">
        <button class="btn btn-outline btn-sm"
                onclick="openResetPasswordModal(${u.id}, '${escapeHtml(u.name)}')"
                title="Passwort zurücksetzen">
          ${Icons.key}
        </button>
        ${!isSelf ? `
        <button class="btn-icon btn-icon-danger"
                onclick="deleteAdminUser(${u.id}, '${escapeHtml(u.name)}')"
                title="Benutzer löschen">
          ${Icons.trash}
        </button>` : ''}
      </div>
    </div>`;
}

function renderAdminTaskCard(task) {
  const isDone = !!task.completion_id;
  return `
    <div class="task-admin-card ${isDone ? 'task-admin-done' : ''}">
      <div class="task-admin-info">
        <div class="task-admin-time">${Icons.clock_sm} ${task.time_of_day} Uhr</div>
        <div class="task-admin-title">${escapeHtml(task.title)}</div>
        <div class="task-admin-meta">
          <span class="badge badge-blue">${getRecurrenceLabel(task.recurrence)}</span>
          <span class="assigned-badge">${Icons.user_sm} ${escapeHtml(task.assigned_name)}</span>
          ${isDone ? `<span class="badge badge-green">${Icons.check_sm} Erledigt</span>` : ''}
        </div>
      </div>
      <div class="task-admin-actions">
        <button class="btn-icon btn-icon-danger"
                onclick="deleteAdminTask(${task.id})"
                title="Aufgabe löschen">
          ${Icons.trash}
        </button>
      </div>
    </div>`;
}

// ─── Benutzer anlegen ────────────────────────────────────────────────────────
function openAddUserModal() {
  openModal('Neuen Benutzer anlegen', `
    <div class="form-group">
      <label for="nu-name">Name *</label>
      <input type="text" id="nu-name" placeholder="Vorname" required>
    </div>
    <div class="form-group">
      <label for="nu-email">E-Mail-Adresse *</label>
      <input type="email" id="nu-email" placeholder="name@example.com" required>
    </div>
    <div class="form-group">
      <label for="nu-password">Passwort <span style="color:var(--gray-400);font-weight:400">(mind. 8 Zeichen)</span></label>
      <input type="password" id="nu-password" placeholder="Passwort festlegen" required minlength="8">
    </div>
    <div class="form-error hidden" id="nu-error"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary" onclick="submitAddUser()">Anlegen</button>`
  );
}

async function submitAddUser() {
  const name     = document.getElementById('nu-name')?.value?.trim();
  const email    = document.getElementById('nu-email')?.value?.trim();
  const password = document.getElementById('nu-password')?.value;
  const errEl    = document.getElementById('nu-error');

  if (!name || !email || !password) {
    errEl.textContent = 'Alle Felder ausfüllen.'; errEl.classList.remove('hidden'); return;
  }

  const res  = await fetch('/api/admin/users', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, email, password })
  });
  const data = await res.json();

  if (!res.ok) {
    errEl.textContent = data.error; errEl.classList.remove('hidden'); return;
  }

  closeModal();
  showToast('Benutzer angelegt!', 'success');
  loadAdmin();
}

// ─── Passwort zurücksetzen ───────────────────────────────────────────────────
function openResetPasswordModal(userId, userName) {
  openModal(`Passwort – ${userName}`, `
    <p style="font-size:14px;color:var(--gray-500);margin-bottom:16px">
      Neues Passwort für <strong>${escapeHtml(userName)}</strong> festlegen.
    </p>
    <div class="form-group">
      <label for="rp-password">Neues Passwort *</label>
      <input type="password" id="rp-password" placeholder="Mind. 8 Zeichen" minlength="8">
    </div>
    <div class="form-error hidden" id="rp-error"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary" onclick="submitResetPassword(${userId})">Speichern</button>`
  );
}

async function submitResetPassword(userId) {
  const password = document.getElementById('rp-password')?.value;
  const errEl    = document.getElementById('rp-error');

  if (!password || password.length < 8) {
    errEl.textContent = 'Mind. 8 Zeichen eingeben.'; errEl.classList.remove('hidden'); return;
  }

  const res = await fetch(`/api/admin/users/${userId}/password`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ password })
  });

  if (res.ok) { closeModal(); showToast('Passwort aktualisiert!', 'success'); }
  else        { errEl.textContent = 'Fehler'; errEl.classList.remove('hidden'); }
}

// ─── Benutzer löschen ────────────────────────────────────────────────────────
async function deleteAdminUser(userId, userName) {
  if (!confirm(`Benutzer "${userName}" wirklich löschen?\nAlle Aufgaben werden ebenfalls entfernt.`)) return;

  const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (res.ok) { showToast('Benutzer gelöscht', 'info'); loadAdmin(); }
  else        { showToast('Fehler beim Löschen', 'error'); }
}

// ─── Admin: Aufgabe löschen ──────────────────────────────────────────────────
async function deleteAdminTask(taskId) {
  if (!confirm('Aufgabe wirklich löschen?')) return;

  const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (res.ok) { showToast('Aufgabe gelöscht', 'info'); loadAdmin(); }
  else        { showToast('Fehler beim Löschen', 'error'); }
}

// ─── Auto-Update ─────────────────────────────────────────────────────────────
async function loadUpdateInfo() {
  const box = document.getElementById('update-info');
  if (!box) return;
  try {
    const res  = await fetch('/api/admin/update/info');
    const data = await res.json();
    box.innerHTML = renderUpdateBox(data.version, data.repo, null);
  } catch(_) {
    box.innerHTML = '<div class="update-error">Versionsinformation nicht verfügbar.</div>';
  }
}

async function checkUpdate() {
  const box = document.getElementById('update-info');
  if (!box) return;
  box.innerHTML = `<div class="update-loading">${Icons.refresh} Prüfe auf Updates…</div>`;
  try {
    const res  = await fetch('/api/admin/update/check');
    const data = await res.json();
    if (!res.ok) {
      box.innerHTML = `<div class="update-error">${escapeHtml(data.error)}</div>`;
      return;
    }
    box.innerHTML = renderUpdateBox(data.currentVersion, null, data);
  } catch(_) {
    box.innerHTML = '<div class="update-error">GitHub nicht erreichbar.</div>';
  }
}

function renderUpdateBox(currentVersion, repo, checkResult) {
  const repoHint = repo
    ? `<span class="badge badge-gray">${Icons.github} ${escapeHtml(repo)}</span>`
    : `<button class="btn btn-outline btn-sm" onclick="openSetRepoModal()">
         ${Icons.github} Repository einrichten
       </button>`;

  let statusHtml = '';
  if (checkResult) {
    if (checkResult.hasUpdate) {
      const date = checkResult.publishedAt
        ? new Date(checkResult.publishedAt).toLocaleDateString('de-DE') : '';
      statusHtml = `
        <div class="update-available">
          <span class="badge badge-warning">Update verfügbar: v${escapeHtml(checkResult.latestVersion)}</span>
          ${date ? `<span class="update-date">${date}</span>` : ''}
          ${checkResult.releaseName ? `<div class="update-name">${escapeHtml(checkResult.releaseName)}</div>` : ''}
          <div class="update-actions">
            <a href="${escapeHtml(checkResult.releaseUrl)}" target="_blank" rel="noopener"
               class="btn btn-outline btn-sm">Release-Notes</a>
            <button class="btn btn-primary btn-sm" onclick="applyUpdate()">
              ${Icons.download} Update installieren
            </button>
          </div>
        </div>`;
    } else {
      statusHtml = `<span class="badge badge-green">${Icons.check_sm} Aktuell (v${escapeHtml(checkResult.currentVersion)})</span>`;
    }
  }

  return `
    <div class="update-box">
      <div class="update-row">
        <span class="update-label">Aktuelle Version</span>
        <span class="badge badge-blue">v${escapeHtml(currentVersion || checkResult?.currentVersion || '–')}</span>
      </div>
      <div class="update-row">
        <span class="update-label">Repository</span>
        ${repoHint}
      </div>
      ${statusHtml}
    </div>`;
}

async function applyUpdate() {
  if (!confirm('Update jetzt via git pull installieren?\nDer Server muss danach neu gestartet werden.')) return;
  const box = document.getElementById('update-info');
  box.innerHTML += '<div class="update-log" id="update-log">Installiere…</div>';
  try {
    const res  = await fetch('/api/admin/update/apply', { method: 'POST' });
    const data = await res.json();
    document.getElementById('update-log').innerHTML =
      `<pre class="update-output">${escapeHtml(data.output)}</pre>
       ${data.success
         ? '<div class="update-success">Fertig! Bitte Server neu starten.</div>'
         : '<div class="update-error">Fehler beim Update.</div>'}`;
  } catch(_) {
    document.getElementById('update-log').innerHTML = '<div class="update-error">Verbindungsfehler.</div>';
  }
}

function openSetRepoModal() {
  openModal('GitHub-Repository einrichten', `
    <p style="font-size:14px;color:var(--gray-500);margin-bottom:16px">
      Gib das GitHub-Repository im Format <strong>besitzer/repo-name</strong> ein.
    </p>
    <div class="form-group">
      <label for="repo-input">Repository</label>
      <input type="text" id="repo-input" placeholder="z.B. meinname/haushaltsbuch">
    </div>
    <div class="form-error hidden" id="repo-error"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
     <button class="btn btn-primary" onclick="submitSetRepo()">Speichern</button>`
  );
}

async function submitSetRepo() {
  const repo  = document.getElementById('repo-input')?.value?.trim();
  const errEl = document.getElementById('repo-error');
  if (!repo) { errEl.textContent = 'Repository eingeben.'; errEl.classList.remove('hidden'); return; }
  const res  = await fetch('/api/admin/update/repo', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ repo })
  });
  const data = await res.json();
  if (!res.ok) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
  closeModal();
  showToast('Repository gespeichert!', 'success');
  loadUpdateInfo();
}
