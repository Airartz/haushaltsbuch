// ═══════════════════════════════════════════════════════════════════════════════
//  DIENSTPLAN
// ═══════════════════════════════════════════════════════════════════════════════

const Dienstplan = {
  shiftTypes:  [],
  entries:     [],
  users:       [],
  manageOpen:  false
};

const DP_COLORS = ['#1A56DB','#059669','#DC2626','#D97706','#7C3AED','#DB2777','#0891B2','#374151'];

async function loadDienstplan() {
  const mc = document.getElementById('main-content');
  if (!mc) return;
  mc.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const [typesRes, usersRes] = await Promise.all([
      fetch('/api/dienstplan/types'),
      fetch('/api/users')
    ]);
    Dienstplan.shiftTypes = await typesRes.json();
    Dienstplan.users      = await usersRes.json();
  } catch {
    Dienstplan.shiftTypes = [];
    Dienstplan.users      = [];
  }

  await loadDienstplanEntries();
}

async function loadDienstplanEntries() {
  const year  = Calendar.currentYear;
  const month = Calendar.currentMonth;
  const from  = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last  = new Date(year, month + 1, 0).getDate();
  const to    = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;

  try {
    const res = await fetch(`/api/dienstplan/entries?from=${from}&to=${to}`);
    Dienstplan.entries = await res.json();
  } catch {
    Dienstplan.entries = [];
  }
  renderDienstplan();
}

function dpEntryLabel(entry) {
  if (entry.entry_type === 'dienst')  return entry.shift_name ? entry.shift_name.slice(0, 2).toUpperCase() : 'D';
  if (entry.entry_type === 'frei')    return 'F';
  if (entry.entry_type === 'urlaub')  return 'U';
  if (entry.entry_type === 'krank')   return 'K';
  return '?';
}

function dpEntryColor(entry) {
  if (entry.entry_type === 'dienst')  return entry.shift_color || '#1A56DB';
  if (entry.entry_type === 'frei')    return '#6B7280';
  if (entry.entry_type === 'urlaub')  return '#059669';
  if (entry.entry_type === 'krank')   return '#DC2626';
  return '#6B7280';
}

function renderDienstplan() {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  const year        = Calendar.currentYear;
  const month       = Calendar.currentMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date().toISOString().split('T')[0];
  const DAY_SHORT   = ['So','Mo','Di','Mi','Do','Fr','Sa'];

  // Days array
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow     = new Date(dateStr + 'T00:00:00').getDay();
    days.push({ d, dateStr, dow, isWE: dow === 0 || dow === 6 });
  }

  // Entries map: { userId: { dateStr: entry } }
  const map = {};
  Dienstplan.entries.forEach(e => {
    if (!map[e.user_id]) map[e.user_id] = {};
    map[e.user_id][e.entry_date] = e;
  });

  // Table header
  const dayHeaders = days.map(d => {
    const isToday = d.dateStr === today;
    return `<th class="dp-day-th${d.isWE ? ' dp-we' : ''}${isToday ? ' dp-today-th' : ''}">
      <span class="dp-day-label">${DAY_SHORT[d.dow]}</span>
      <span class="dp-day-num">${d.d}</span>
    </th>`;
  }).join('');

  // User rows
  const userRows = Dienstplan.users.map(user => {
    const isMe  = user.id === App.user.id;
    const cells = days.map(day => {
      const entry   = map[user.id]?.[day.dateStr];
      const badge   = entry
        ? `<span class="dp-badge" style="background:${dpEntryColor(entry)}" title="${entry.entry_type === 'dienst' ? (entry.shift_name || 'Dienst') : entry.entry_type}">${dpEntryLabel(entry)}</span>`
        : '';
      const isToday = day.dateStr === today;
      const click   = isMe ? `onclick="openDpEntryModal('${day.dateStr}')"` : '';
      return `<td class="dp-cell${day.isWE ? ' dp-we' : ''}${isToday ? ' dp-today-cell' : ''}${isMe ? ' dp-my-cell' : ''}" ${click}>${badge}</td>`;
    }).join('');
    return `<tr>
      <th class="dp-user-th${isMe ? ' dp-me' : ''}">${escapeHtml(user.name)}</th>
      ${cells}
    </tr>`;
  }).join('');

  // Manage section
  const typesList = Dienstplan.shiftTypes.length === 0
    ? `<p class="dp-empty-hint">Noch keine Dienste angelegt</p>`
    : Dienstplan.shiftTypes.map(t => `
        <div class="dp-type-item">
          <span class="dp-type-dot" style="background:${t.color}"></span>
          <span class="dp-type-name">${escapeHtml(t.name)}</span>
          ${t.start_time ? `<span class="dp-type-time">${t.start_time}${t.end_time ? '–' + t.end_time : ''}</span>` : ''}
          <button class="btn-icon btn-icon-danger" onclick="deleteDpType(${t.id})">${Icons.trash}</button>
        </div>`).join('');

  const colorPicker = DP_COLORS.map((c, i) =>
    `<label class="dp-color-opt">
      <input type="radio" name="dp-type-color" value="${c}"${i === 0 ? ' checked' : ''}>
      <span class="dp-color-dot" style="background:${c}"></span>
    </label>`
  ).join('');

  const manageBody = Dienstplan.manageOpen ? `
    <div class="dp-manage-body">
      <div class="dp-types-list">${typesList}</div>
      <div class="dp-add-type">
        <input type="text" id="dp-type-name" placeholder="Name (z.B. Frühdienst)" maxlength="20">
        <div class="dp-time-row">
          <input type="time" id="dp-type-start" placeholder="Von">
          <span>–</span>
          <input type="time" id="dp-type-end" placeholder="Bis">
        </div>
        <div class="dp-color-row">${colorPicker}</div>
        <button class="btn btn-primary btn-sm" onclick="saveDpType()">${Icons.plus} Hinzufügen</button>
      </div>
    </div>` : '';

  mc.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Kalender</h2>
        <p class="page-subtitle">Termine & Dienstplan</p>
      </div>
    </div>

    <div class="cal-view-toggle">
      <button class="cal-toggle-btn" onclick="Calendar.view='calendar'; loadCalendar()">Kalender</button>
      <button class="cal-toggle-btn active">Dienstplan</button>
    </div>

    <div class="cal-container" style="padding-bottom:4px">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="changeDpMonth(-1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="cal-month-label">
          <span class="cal-month-name">${Calendar.MONTH_NAMES[month]}</span>
          <span class="cal-year">${year}</span>
        </div>
        <button class="cal-nav-btn" onclick="changeDpMonth(1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>

    <div class="dp-manage-section">
      <button class="dp-manage-toggle" onclick="Dienstplan.manageOpen=!Dienstplan.manageOpen; renderDienstplan()">
        <span>Dienste verwalten</span>
        <svg class="dp-chevron${Dienstplan.manageOpen ? ' open' : ''}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      ${manageBody}
    </div>

    <div class="dp-legend">
      <span class="dp-legend-item"><span class="dp-legend-dot" style="background:#6B7280"></span>F = Frei</span>
      <span class="dp-legend-item"><span class="dp-legend-dot" style="background:#059669"></span>U = Urlaub</span>
      <span class="dp-legend-item"><span class="dp-legend-dot" style="background:#DC2626"></span>K = Krank</span>
      ${Dienstplan.shiftTypes.map(t => `<span class="dp-legend-item"><span class="dp-legend-dot" style="background:${t.color}"></span>${t.name.slice(0,2).toUpperCase()} = ${escapeHtml(t.name)}</span>`).join('')}
    </div>

    <div class="dp-table-wrapper">
      <table class="dp-table">
        <thead>
          <tr>
            <th class="dp-user-col-h dp-sticky-col">Person</th>
            ${dayHeaders}
          </tr>
        </thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>
  `;
}

function changeDpMonth(delta) {
  Calendar.currentMonth += delta;
  if (Calendar.currentMonth > 11) { Calendar.currentMonth = 0; Calendar.currentYear++; }
  if (Calendar.currentMonth < 0)  { Calendar.currentMonth = 11; Calendar.currentYear--; }
  loadDienstplanEntries();
}

function openDpEntryModal(dateStr) {
  const dateObj   = new Date(dateStr + 'T00:00:00');
  const dayNames  = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const dayLabel  = `${dayNames[dateObj.getDay()]}, ${dateObj.getDate()}. ${Calendar.MONTH_NAMES[dateObj.getMonth()]}`;
  const existing  = Dienstplan.entries.find(e => e.user_id === App.user.id && e.entry_date === dateStr);

  const dienstBtns = Dienstplan.shiftTypes.length === 0
    ? `<p class="dp-empty-hint">Erst unter "Dienste verwalten" Dienste anlegen.</p>`
    : Dienstplan.shiftTypes.map(t => {
        const isActive = existing?.entry_type === 'dienst' && existing?.shift_type_id === t.id;
        return `<button class="dp-entry-btn${isActive ? ' active' : ''}" style="--dp-color:${t.color}" onclick="saveDpEntry('${dateStr}','dienst',${t.id})">
          <span class="dp-entry-dot" style="background:${t.color}"></span>
          <span class="dp-entry-name">${escapeHtml(t.name)}</span>
          ${t.start_time ? `<span class="dp-entry-time">${t.start_time}${t.end_time ? '–' + t.end_time : ''}</span>` : ''}
        </button>`;
      }).join('');

  const statusBtns = `
    <div class="dp-status-row">
      <button class="dp-status-btn dp-btn-frei${existing?.entry_type==='frei'?' active':''}" onclick="saveDpEntry('${dateStr}','frei',null)">Frei</button>
      <button class="dp-status-btn dp-btn-urlaub${existing?.entry_type==='urlaub'?' active':''}" onclick="saveDpEntry('${dateStr}','urlaub',null)">Urlaub</button>
      <button class="dp-status-btn dp-btn-krank${existing?.entry_type==='krank'?' active':''}" onclick="saveDpEntry('${dateStr}','krank',null)">Krank</button>
    </div>`;

  const deleteBtn = existing
    ? `<button class="btn btn-outline btn-sm" onclick="deleteDpEntry(${existing.id})">Eintrag löschen</button>`
    : '';

  openModal(dayLabel, `
    <div class="form-group">
      <label>Dienst</label>
      <div class="dp-entry-list">${dienstBtns}</div>
    </div>
    <div class="form-group" style="margin-top:4px">
      <label>Status</label>
      ${statusBtns}
    </div>
  `, `
    ${deleteBtn}
    <button class="btn btn-outline" onclick="closeModal()">Schließen</button>
  `);
}

async function saveDpEntry(dateStr, entryType, shiftTypeId) {
  const res = await fetch('/api/dienstplan/entries', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ entry_date: dateStr, entry_type: entryType, shift_type_id: shiftTypeId })
  });
  if (res.ok) {
    closeModal();
    showToast('Gespeichert!', 'success');
    await loadDienstplanEntries();
  } else {
    const d = await res.json();
    showToast(d.error || 'Fehler', 'error');
  }
}

async function deleteDpEntry(entryId) {
  const res = await fetch(`/api/dienstplan/entries/${entryId}`, { method: 'DELETE' });
  if (res.ok) {
    closeModal();
    showToast('Eintrag gelöscht', 'success');
    await loadDienstplanEntries();
  } else {
    showToast('Fehler beim Löschen', 'error');
  }
}

async function saveDpType() {
  const name = document.getElementById('dp-type-name')?.value?.trim();
  if (!name) { showToast('Name erforderlich', 'error'); return; }

  const start_time = document.getElementById('dp-type-start')?.value || '';
  const end_time   = document.getElementById('dp-type-end')?.value   || '';
  const color      = document.querySelector('input[name="dp-type-color"]:checked')?.value || '#1A56DB';

  const btn = document.querySelector('.dp-add-type .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const res  = await fetch('/api/dienstplan/types', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, start_time, end_time, color })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`"${name}" hinzugefügt!`, 'success');
      Dienstplan.manageOpen = true;
      await loadDienstplan();
    } else {
      showToast(data.error || 'Fehler beim Speichern', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '+ Hinzufügen'; }
    }
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '+ Hinzufügen'; }
  }
}

async function deleteDpType(typeId) {
  if (!confirm('Dienst löschen? Alle Einträge mit diesem Dienst werden ebenfalls gelöscht.')) return;
  const res = await fetch(`/api/dienstplan/types/${typeId}`, { method: 'DELETE' });
  if (res.ok) {
    Dienstplan.shiftTypes = Dienstplan.shiftTypes.filter(t => t.id !== typeId);
    showToast('Dienst gelöscht', 'success');
    await loadDienstplanEntries();
  } else {
    showToast('Fehler beim Löschen', 'error');
  }
}
