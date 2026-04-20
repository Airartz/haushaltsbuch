// ═══════════════════════════════════════════════════════════════════════════════
//  KALENDER
// ═══════════════════════════════════════════════════════════════════════════════
const Calendar = {
  currentMonth: new Date().getMonth(),
  currentYear:  new Date().getFullYear(),
  events:       [],
  selectedDate: null,
  view:         'calendar',

  MONTH_NAMES: [
    'Januar','Februar','März','April','Mai','Juni',
    'Juli','August','September','Oktober','November','Dezember'
  ],
  DAY_LABELS: ['Mo','Di','Mi','Do','Fr','Sa','So'],

  EVENT_COLORS: [
    { value: '#1A56DB', label: 'Blau' },
    { value: '#059669', label: 'Grün' },
    { value: '#DC2626', label: 'Rot' },
    { value: '#D97706', label: 'Orange' },
    { value: '#7C3AED', label: 'Lila' },
    { value: '#DB2777', label: 'Pink' },
    { value: '#0891B2', label: 'Cyan' },
    { value: '#374151', label: 'Grau' },
  ]
};

async function loadCalendar() {
  if (Calendar.view === 'dienstplan') { loadDienstplan(); return; }
  const mc = document.getElementById('main-content');
  if (!mc) return;

  // Bereich berechnen: ganzer Monat + Puffer für die Wochenanzeige
  const from = `${Calendar.currentYear}-${String(Calendar.currentMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Calendar.currentYear, Calendar.currentMonth + 1, 0).getDate();
  const to = `${Calendar.currentYear}-${String(Calendar.currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  try {
    const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`);
    Calendar.events = await res.json();
  } catch {
    Calendar.events = [];
  }

  renderCalendar();
}

function renderCalendar() {
  const mc = document.getElementById('main-content');
  if (!mc) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Erster Tag des Monats
  const firstDay = new Date(Calendar.currentYear, Calendar.currentMonth, 1);
  // Wochentag des 1. (Montag = 0, Sonntag = 6)
  let startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(Calendar.currentYear, Calendar.currentMonth + 1, 0).getDate();

  // Events pro Tag gruppieren
  const eventsByDate = {};
  Calendar.events.forEach(ev => {
    if (!eventsByDate[ev.event_date]) eventsByDate[ev.event_date] = [];
    eventsByDate[ev.event_date].push(ev);
  });

  // Kalenderraster aufbauen
  let calendarCells = '';
  // Header-Zeile
  Calendar.DAY_LABELS.forEach(d => {
    calendarCells += `<div class="cal-day-header">${d}</div>`;
  });

  // Leere Zellen vor dem 1.
  for (let i = 0; i < startDow; i++) {
    calendarCells += `<div class="cal-day cal-day-empty"></div>`;
  }

  // Tage
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${Calendar.currentYear}-${String(Calendar.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === Calendar.selectedDate;
    const dayEvents = eventsByDate[dateStr] || [];
    const hasEvents = dayEvents.length > 0;

    // Prüben ob ein Event bald ansteht (heute oder morgen)
    const dateObj = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
    const isUpcoming = diffDays >= 0 && diffDays <= 1 && hasEvents;

    let classes = 'cal-day';
    if (isToday) classes += ' cal-day-today';
    if (isSelected) classes += ' cal-day-selected';
    if (isUpcoming) classes += ' cal-day-upcoming';

    // Punkte für Events (max 3 Punkte anzeigen)
    let dots = '';
    if (hasEvents) {
      const uniqueColors = [...new Set(dayEvents.map(e => e.color || '#1A56DB'))].slice(0, 3);
      dots = `<div class="cal-dots">${uniqueColors.map(c => `<span class="cal-dot" style="background:${c}"></span>`).join('')}</div>`;
    }

    calendarCells += `
      <div class="${classes}" onclick="selectCalendarDate('${dateStr}')">
        <span class="cal-day-number">${day}</span>
        ${dots}
      </div>`;
  }

  // Ausgewählter Tag: Events anzeigen
  let selectedDayContent = '';
  if (Calendar.selectedDate) {
    const selEvents = eventsByDate[Calendar.selectedDate] || [];
    const selDateObj = new Date(Calendar.selectedDate + 'T00:00:00');
    const dayName = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][selDateObj.getDay()];
    const dayNum = selDateObj.getDate();
    const monthName = Calendar.MONTH_NAMES[selDateObj.getMonth()];

    const formattedDate = `${dayName}, ${dayNum}. ${monthName}`;

    let eventsList = '';
    if (selEvents.length === 0) {
      eventsList = `
        <div class="cal-no-events">
          ${Icons.calendar}
          <span>Keine Termine</span>
        </div>`;
    } else {
      eventsList = selEvents.map(ev => {
        const timeStr = ev.event_time
          ? `<span class="cal-event-time">${Icons.clock_sm} ${ev.event_time}${ev.end_time ? ' – ' + ev.end_time : ''}</span>`
          : '';
        const descStr = ev.description
          ? `<p class="cal-event-desc">${escapeHtml(ev.description)}</p>`
          : '';

        // Prüfen ob Event bald ansteht
        const now = new Date();
        const evDate = new Date(ev.event_date + 'T' + (ev.event_time || '23:59'));
        const isUpcoming = evDate >= now && (evDate - now) < 24 * 60 * 60 * 1000;
        const upcomingClass = isUpcoming ? ' cal-event-upcoming' : '';

        return `
          <div class="cal-event-card${upcomingClass}" style="border-left-color: ${ev.color || '#1A56DB'}">
            <div class="cal-event-header">
              <div class="cal-event-info">
                ${timeStr}
                <h4>${escapeHtml(ev.title)}</h4>
                ${descStr}
              </div>
              <div class="cal-event-actions">
                <button class="btn-icon" onclick="openEditEventModal(${ev.id})" title="Bearbeiten">${Icons.edit}</button>
                <button class="btn-icon btn-icon-danger" onclick="deleteCalendarEvent(${ev.id})" title="Löschen">${Icons.trash}</button>
              </div>
            </div>
            <div class="cal-event-meta">
              <span class="cal-event-creator">${Icons.user_sm} ${escapeHtml(ev.created_by_name)}</span>
            </div>
          </div>`;
      }).join('');
    }

    selectedDayContent = `
      <div class="cal-selected-day">
        <div class="cal-selected-header">
          <h3>${formattedDate}</h3>
          <button class="btn btn-primary btn-sm" onclick="openNewEventModal('${Calendar.selectedDate}')">
            ${Icons.plus} Termin
          </button>
        </div>
        ${eventsList}
      </div>`;
  }

  mc.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Kalender</h2>
        <p class="page-subtitle">Termine & Ereignisse</p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openNewEventModal()">
        ${Icons.plus} Neu
      </button>
    </div>

    <div class="cal-view-toggle">
      <button class="cal-toggle-btn active">Kalender</button>
      <button class="cal-toggle-btn" onclick="Calendar.view='dienstplan'; loadDienstplan()">Dienstplan</button>
    </div>

    <div class="cal-container">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="changeMonth(-1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="cal-month-label">
          <span class="cal-month-name">${Calendar.MONTH_NAMES[Calendar.currentMonth]}</span>
          <span class="cal-year">${Calendar.currentYear}</span>
        </div>
        <button class="cal-nav-btn" onclick="changeMonth(1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="cal-grid">
        ${calendarCells}
      </div>

      <button class="cal-today-btn" onclick="goToToday()">Heute</button>
    </div>

    ${selectedDayContent}
  `;
}

function changeMonth(delta) {
  Calendar.currentMonth += delta;
  if (Calendar.currentMonth > 11) { Calendar.currentMonth = 0; Calendar.currentYear++; }
  if (Calendar.currentMonth < 0)  { Calendar.currentMonth = 11; Calendar.currentYear--; }
  Calendar.selectedDate = null;
  loadCalendar();
}

function goToToday() {
  const today = new Date();
  Calendar.currentMonth = today.getMonth();
  Calendar.currentYear = today.getFullYear();
  Calendar.selectedDate = today.toISOString().split('T')[0];
  loadCalendar();
}

function selectCalendarDate(dateStr) {
  Calendar.selectedDate = (Calendar.selectedDate === dateStr) ? null : dateStr;
  renderCalendar();

  // Zum ausgewählten Tag scrollen
  if (Calendar.selectedDate) {
    setTimeout(() => {
      const el = document.querySelector('.cal-selected-day');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

// ─── EVENT MODAL ────────────────────────────────────────────────────────────

function openNewEventModal(dateStr) {
  const date = dateStr || Calendar.selectedDate || new Date().toISOString().split('T')[0];

  const colorOptions = Calendar.EVENT_COLORS.map(c =>
    `<label class="cal-color-option">
      <input type="radio" name="event-color" value="${c.value}" ${c.value === '#1A56DB' ? 'checked' : ''}>
      <span class="cal-color-dot" style="background:${c.value}"></span>
    </label>`
  ).join('');

  openModal('Neuer Termin', `
    <div class="form-group">
      <label for="event-title">Titel *</label>
      <input type="text" id="event-title" placeholder="Termin-Name" required>
    </div>
    <div class="form-group">
      <label for="event-desc">Beschreibung</label>
      <textarea id="event-desc" placeholder="Optional" rows="2"></textarea>
    </div>
    <div class="form-group">
      <label for="event-date">Datum *</label>
      <input type="date" id="event-date" value="${date}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="event-time">Startzeit</label>
        <input type="time" id="event-time">
      </div>
      <div class="form-group">
        <label for="event-end-time">Endzeit</label>
        <input type="time" id="event-end-time">
      </div>
    </div>
    <div class="form-group">
      <label>Farbe</label>
      <div class="cal-color-picker">${colorOptions}</div>
    </div>
  `, `
    <button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="saveCalendarEvent()">Speichern</button>
  `);

  setTimeout(() => document.getElementById('event-title')?.focus(), 200);
}

async function saveCalendarEvent() {
  const title = document.getElementById('event-title')?.value;
  const description = document.getElementById('event-desc')?.value;
  const event_date = document.getElementById('event-date')?.value;
  const event_time = document.getElementById('event-time')?.value;
  const end_time = document.getElementById('event-end-time')?.value;
  const color = document.querySelector('input[name="event-color"]:checked')?.value || '#1A56DB';

  if (!title?.trim()) {
    document.getElementById('event-title')?.classList.add('input-error');
    return;
  }
  if (!event_date) {
    document.getElementById('event-date')?.classList.add('input-error');
    return;
  }

  const res = await fetch('/api/calendar/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, event_date, event_time, end_time, color })
  });

  if (res.ok) {
    closeModal();
    showToast('Termin erstellt!', 'success');
    Calendar.selectedDate = event_date;
    loadCalendar();
  } else {
    const data = await res.json();
    showToast(data.error || 'Fehler beim Speichern', 'error');
  }
}

function openEditEventModal(eventId) {
  const ev = Calendar.events.find(e => e.id === eventId);
  if (!ev) return;

  const colorOptions = Calendar.EVENT_COLORS.map(c =>
    `<label class="cal-color-option">
      <input type="radio" name="event-color" value="${c.value}" ${c.value === (ev.color || '#1A56DB') ? 'checked' : ''}>
      <span class="cal-color-dot" style="background:${c.value}"></span>
    </label>`
  ).join('');

  openModal('Termin bearbeiten', `
    <div class="form-group">
      <label for="event-title">Titel *</label>
      <input type="text" id="event-title" value="${escapeHtml(ev.title)}" required>
    </div>
    <div class="form-group">
      <label for="event-desc">Beschreibung</label>
      <textarea id="event-desc" rows="2">${escapeHtml(ev.description || '')}</textarea>
    </div>
    <div class="form-group">
      <label for="event-date">Datum *</label>
      <input type="date" id="event-date" value="${ev.event_date}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="event-time">Startzeit</label>
        <input type="time" id="event-time" value="${ev.event_time || ''}">
      </div>
      <div class="form-group">
        <label for="event-end-time">Endzeit</label>
        <input type="time" id="event-end-time" value="${ev.end_time || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Farbe</label>
      <div class="cal-color-picker">${colorOptions}</div>
    </div>
  `, `
    <button class="btn btn-outline" onclick="closeModal()">Abbrechen</button>
    <button class="btn btn-primary" onclick="updateCalendarEvent(${eventId})">Speichern</button>
  `);
}

async function updateCalendarEvent(eventId) {
  const title = document.getElementById('event-title')?.value;
  const description = document.getElementById('event-desc')?.value;
  const event_date = document.getElementById('event-date')?.value;
  const event_time = document.getElementById('event-time')?.value;
  const end_time = document.getElementById('event-end-time')?.value;
  const color = document.querySelector('input[name="event-color"]:checked')?.value || '#1A56DB';

  if (!title?.trim() || !event_date) {
    showToast('Titel und Datum erforderlich', 'error');
    return;
  }

  const res = await fetch(`/api/calendar/events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, event_date, event_time, end_time, color })
  });

  if (res.ok) {
    closeModal();
    showToast('Termin aktualisiert!', 'success');
    Calendar.selectedDate = event_date;
    loadCalendar();
  } else {
    const data = await res.json();
    showToast(data.error || 'Fehler beim Speichern', 'error');
  }
}

async function deleteCalendarEvent(eventId) {
  if (!confirm('Termin wirklich löschen?')) return;

  const res = await fetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Termin gelöscht', 'success');
    loadCalendar();
  } else {
    showToast('Fehler beim Löschen', 'error');
  }
}
