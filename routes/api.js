const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../database');

const router = express.Router();

// ── Helfer ────────────────────────────────────────────────────────────────────
function today()       { return new Date().toISOString().split('T')[0]; }
function dbDayOfWeek() { return (new Date().getDay() + 6) % 7; }

function requireAdmin(req, res, next) {
  if (req.session.userRole !== 'admin') return res.status(403).json({ error: 'Keine Berechtigung' });
  next();
}

function broadcastShoppingUpdate(io) {
  const items = db.all(`
    SELECT s.*, u.name as added_by_name
    FROM shopping_items s JOIN users u ON u.id = s.added_by
    ORDER BY s.in_cart ASC, s.created_at ASC`);
  io.to('all').emit('shopping:update', items);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TASKS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/tasks/dashboard', (req, res) => {
  const now         = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const plus3h      = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const plus3Time   = `${String(plus3h.getHours()).padStart(2,'0')}:${String(plus3h.getMinutes()).padStart(2,'0')}`;
  const todayDate   = today();
  const dow         = dbDayOfWeek();
  const dom         = now.getDate();

  // Alle Tasks aller Nutzer anzeigen
  const base = db.all(`
    SELECT t.*, u.name as assigned_name
    FROM tasks t
    JOIN users u ON u.id = t.assigned_to
    LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.completion_date = ?
    WHERE t.is_active = 1 AND tc.id IS NULL
      AND (t.recurrence = 'daily'
        OR (t.recurrence = 'weekly'  AND t.day_of_week  = ?)
        OR (t.recurrence = 'monthly' AND t.day_of_month = ?))
    ORDER BY t.time_of_day ASC`,
    [todayDate, dow, dom]);

  const overdue = base.filter(t => t.time_of_day < currentTime);

  // Mitternachts-Überkreuzung korrekt behandeln (z.B. 22:30 + 3h = 01:30)
  const crossesMidnight = plus3Time < currentTime;
  const upcoming = base.filter(t => {
    if (crossesMidnight) return t.time_of_day >= currentTime || t.time_of_day <= plus3Time;
    return t.time_of_day >= currentTime && t.time_of_day <= plus3Time;
  });

  res.json({ overdue, upcoming, currentTime });
});

router.get('/tasks', (req, res) => {
  const todayDate = today();
  const dow       = dbDayOfWeek();
  const dom       = new Date().getDate();

  // Alle Tasks aller Nutzer anzeigen
  const tasks = db.all(`
    SELECT t.*, u.name as assigned_name, tc.id as completion_id, tc.completed_at
    FROM tasks t
    JOIN users u ON u.id = t.assigned_to
    LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.completion_date = ?
    WHERE t.is_active = 1
    ORDER BY t.time_of_day ASC`,
    [todayDate]);

  const result = tasks.map(t => ({
    ...t,
    completion_id: t.completion_id || null,
    due_today:
      t.recurrence === 'daily' ||
      (t.recurrence === 'weekly'  && Number(t.day_of_week)  === dow) ||
      (t.recurrence === 'monthly' && Number(t.day_of_month) === dom)
  }));

  res.json(result);
});

router.post('/tasks', (req, res) => {
  const { title, description, assigned_to, recurrence, time_of_day, day_of_week, day_of_month } = req.body;
  if (!title || !recurrence || !time_of_day) {
    return res.status(400).json({ error: 'Titel, Wiederholung und Uhrzeit erforderlich' });
  }

  const targetUser = (req.session.userRole === 'admin' && assigned_to)
    ? Number(assigned_to) : req.session.userId;

  const result = db.run(`
    INSERT INTO tasks (title, description, assigned_to, recurrence, time_of_day, day_of_week, day_of_month, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title.trim(), (description || '').trim(), targetUser, recurrence, time_of_day,
     recurrence === 'weekly'  ? Number(day_of_week)  : null,
     recurrence === 'monthly' ? Number(day_of_month) : null,
     req.session.userId]);

  const newTask = db.get(`SELECT t.*, u.name as assigned_name FROM tasks t JOIN users u ON u.id = t.assigned_to WHERE t.id = ?`,
    [result.lastInsertRowid]);

  req.app.get('io').to('all').emit('task:created', newTask);
  res.json(newTask);
});

router.put('/tasks/:id', (req, res) => {
  const taskId = Number(req.params.id);
  const task   = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return res.status(404).json({ error: 'Nicht gefunden' });
  // Jeder Nutzer kann Tasks bearbeiten

  const { title, description, recurrence, time_of_day, day_of_week, day_of_month } = req.body;
  db.run(`UPDATE tasks SET title=?, description=?, recurrence=?, time_of_day=?, day_of_week=?, day_of_month=? WHERE id=?`,
    [title.trim(), (description||'').trim(), recurrence, time_of_day,
     recurrence === 'weekly'  ? Number(day_of_week)  : null,
     recurrence === 'monthly' ? Number(day_of_month) : null,
     taskId]);

  const updated = db.get(`SELECT t.*, u.name as assigned_name FROM tasks t JOIN users u ON u.id = t.assigned_to WHERE t.id = ?`, [taskId]);
  req.app.get('io').to('all').emit('task:updated', updated);
  res.json(updated);
});

router.post('/tasks/:id/complete', (req, res) => {
  const taskId    = Number(req.params.id);
  const userId    = req.session.userId;
  const todayDate = today();

  // Jeder Nutzer kann jeden Task abhaken
  const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

  const existing = db.get('SELECT id FROM task_completions WHERE task_id = ? AND completion_date = ?', [taskId, todayDate]);
  if (existing)  return res.status(400).json({ error: 'Bereits als erledigt markiert' });

  db.run('INSERT INTO task_completions (task_id, user_id, completion_date) VALUES (?, ?, ?)', [taskId, userId, todayDate]);

  req.app.get('io').to('all').emit('task:completed', {
    taskId, userId, userName: req.session.userName, taskTitle: task.title
  });
  res.json({ success: true });
});

router.delete('/tasks/:id', (req, res) => {
  const taskId = Number(req.params.id);
  const task   = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return res.status(404).json({ error: 'Nicht gefunden' });
  // Jeder Nutzer kann Tasks löschen
  db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  req.app.get('io').to('all').emit('task:deleted', { taskId });
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SHOPPING
// ─────────────────────────────────────────────────────────────────────────────

router.get('/shopping', (_req, res) => {
  const items = db.all(`SELECT s.*, u.name as added_by_name
    FROM shopping_items s JOIN users u ON u.id = s.added_by
    ORDER BY s.in_cart ASC, s.created_at ASC`);
  res.json(items);
});

router.post('/shopping', (req, res) => {
  const { name, quantity } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  db.run('INSERT INTO shopping_items (name, quantity, added_by) VALUES (?, ?, ?)',
    [name.trim(), (quantity || '').trim(), req.session.userId]);
  broadcastShoppingUpdate(req.app.get('io'));
  res.json({ success: true });
});

// WICHTIG: cart/clear vor /:id
router.delete('/shopping/cart/clear', (req, res) => {
  db.run('DELETE FROM shopping_items WHERE in_cart = 1');
  broadcastShoppingUpdate(req.app.get('io'));
  res.json({ success: true });
});

router.patch('/shopping/:id/cart', (req, res) => {
  const id   = Number(req.params.id);
  const item = db.get('SELECT * FROM shopping_items WHERE id = ?', [id]);
  if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
  db.run('UPDATE shopping_items SET in_cart = ? WHERE id = ?', [item.in_cart ? 0 : 1, id]);
  broadcastShoppingUpdate(req.app.get('io'));
  res.json({ success: true });
});

router.delete('/shopping/:id', (req, res) => {
  db.run('DELETE FROM shopping_items WHERE id = ?', [Number(req.params.id)]);
  broadcastShoppingUpdate(req.app.get('io'));
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

function broadcastCalendarUpdate(io) {
  io.to('all').emit('calendar:update');
}

// Alle Events für einen Monat (oder Zeitraum) laden
router.get('/calendar/events', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from und to Parameter erforderlich' });

  const events = db.all(`
    SELECT c.*, u.name as created_by_name
    FROM calendar_events c
    JOIN users u ON u.id = c.created_by
    WHERE c.event_date >= ? AND c.event_date <= ?
    ORDER BY c.event_date ASC, c.event_time ASC`, [from, to]);
  res.json(events);
});

// Neues Event erstellen
router.post('/calendar/events', (req, res) => {
  const { title, description, event_date, event_time, end_time, color } = req.body;
  if (!title?.trim() || !event_date) {
    return res.status(400).json({ error: 'Titel und Datum erforderlich' });
  }

  const result = db.run(`
    INSERT INTO calendar_events (title, description, event_date, event_time, end_time, color, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title.trim(), (description || '').trim(), event_date,
     event_time || null, end_time || null, color || '#1A56DB',
     req.session.userId]);

  const newEvent = db.get(`
    SELECT c.*, u.name as created_by_name
    FROM calendar_events c JOIN users u ON u.id = c.created_by
    WHERE c.id = ?`, [result.lastInsertRowid]);

  broadcastCalendarUpdate(req.app.get('io'));
  res.json(newEvent);
});

// Event bearbeiten
router.put('/calendar/events/:id', (req, res) => {
  const eventId = Number(req.params.id);
  const event = db.get('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
  if (!event) return res.status(404).json({ error: 'Nicht gefunden' });

  const { title, description, event_date, event_time, end_time, color } = req.body;
  db.run(`UPDATE calendar_events SET title=?, description=?, event_date=?, event_time=?, end_time=?, color=? WHERE id=?`,
    [title.trim(), (description || '').trim(), event_date,
     event_time || null, end_time || null, color || '#1A56DB', eventId]);

  const updated = db.get(`
    SELECT c.*, u.name as created_by_name
    FROM calendar_events c JOIN users u ON u.id = c.created_by
    WHERE c.id = ?`, [eventId]);

  broadcastCalendarUpdate(req.app.get('io'));
  res.json(updated);
});

// Event löschen
router.delete('/calendar/events/:id', (req, res) => {
  const eventId = Number(req.params.id);
  const event = db.get('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
  if (!event) return res.status(404).json({ error: 'Nicht gefunden' });

  db.run('DELETE FROM calendar_events WHERE id = ?', [eventId]);
  broadcastCalendarUpdate(req.app.get('io'));
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  REZEPTE & ESSENSPLAN
// ─────────────────────────────────────────────────────────────────────────────

router.get('/recipes', (_req, res) => {
  res.json(db.all('SELECT * FROM recipes ORDER BY name ASC'));
});

router.post('/recipes', (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  db.run('INSERT INTO recipes (name, description, created_by) VALUES (?, ?, ?)',
    [name.trim(), (description || '').trim(), req.session.userId]);
  const r = db.get('SELECT * FROM recipes WHERE created_by = ? ORDER BY id DESC LIMIT 1', [req.session.userId]);
  req.app.get('io').to('all').emit('recipes:update');
  res.json(r);
});

router.delete('/recipes/:id', (req, res) => {
  db.run('DELETE FROM recipes WHERE id = ?', [Number(req.params.id)]);
  req.app.get('io').to('all').emit('recipes:update');
  res.json({ success: true });
});

router.get('/mealplan', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from und to erforderlich' });
  res.json(db.all(`
    SELECT m.*, r.name as recipe_name, u.name as created_by_name
    FROM meal_plan m
    LEFT JOIN recipes r ON r.id = m.recipe_id
    JOIN users u ON u.id = m.created_by
    WHERE m.meal_date >= ? AND m.meal_date <= ?
    ORDER BY m.meal_date ASC, m.meal_type ASC
  `, [from, to]));
});

router.post('/mealplan', (req, res) => {
  const { meal_date, meal_type, title, recipe_id } = req.body;
  if (!meal_date || !meal_type || !title?.trim())
    return res.status(400).json({ error: 'Datum, Typ und Titel erforderlich' });
  const existing = db.get('SELECT id FROM meal_plan WHERE meal_date = ? AND meal_type = ?', [meal_date, meal_type]);
  if (existing) {
    db.run('UPDATE meal_plan SET title = ?, recipe_id = ?, created_by = ? WHERE id = ?',
      [title.trim(), recipe_id || null, req.session.userId, existing.id]);
  } else {
    db.run('INSERT INTO meal_plan (meal_date, meal_type, title, recipe_id, created_by) VALUES (?, ?, ?, ?, ?)',
      [meal_date, meal_type, title.trim(), recipe_id || null, req.session.userId]);
  }
  const entry = db.get(`
    SELECT m.*, r.name as recipe_name, u.name as created_by_name
    FROM meal_plan m LEFT JOIN recipes r ON r.id = m.recipe_id
    JOIN users u ON u.id = m.created_by
    WHERE m.meal_date = ? AND m.meal_type = ?
  `, [meal_date, meal_type]);
  req.app.get('io').to('all').emit('mealplan:update');
  res.json(entry);
});

router.delete('/mealplan/:id', (req, res) => {
  db.run('DELETE FROM meal_plan WHERE id = ?', [Number(req.params.id)]);
  req.app.get('io').to('all').emit('mealplan:update');
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DIENSTPLAN
// ─────────────────────────────────────────────────────────────────────────────

router.get('/dienstplan/types', (_req, res) => {
  res.json(db.all('SELECT * FROM shift_types ORDER BY name ASC'));
});

router.post('/dienstplan/types', (req, res) => {
  const { name, start_time, end_time, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  db.run(
    'INSERT INTO shift_types (name, start_time, end_time, color, created_by) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), start_time || '', end_time || '', color || '#1A56DB', req.session.userId]
  );
  const newType = db.get(
    'SELECT * FROM shift_types WHERE created_by = ? ORDER BY id DESC LIMIT 1',
    [req.session.userId]
  );
  req.app.get('io').to('all').emit('dienstplan:update');
  res.json(newType);
});

router.delete('/dienstplan/types/:id', (req, res) => {
  db.run('DELETE FROM shift_types WHERE id = ?', [Number(req.params.id)]);
  req.app.get('io').to('all').emit('dienstplan:update');
  res.json({ success: true });
});

router.get('/dienstplan/entries', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from und to erforderlich' });
  const entries = db.all(`
    SELECT e.*, u.name as user_name, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.color as shift_color
    FROM shift_entries e
    JOIN users u ON u.id = e.user_id
    LEFT JOIN shift_types s ON s.id = e.shift_type_id
    WHERE e.entry_date >= ? AND e.entry_date <= ?
    ORDER BY e.entry_date ASC, u.name ASC
  `, [from, to]);
  res.json(entries);
});

router.post('/dienstplan/entries', (req, res) => {
  const { entry_date, entry_type, shift_type_id } = req.body;
  if (!entry_date || !entry_type) return res.status(400).json({ error: 'Datum und Typ erforderlich' });
  if (!['dienst', 'frei', 'urlaub', 'krank'].includes(entry_type))
    return res.status(400).json({ error: 'Ungültiger Typ' });

  const userId = req.session.userId;
  const existing = db.get('SELECT id FROM shift_entries WHERE user_id = ? AND entry_date = ?', [userId, entry_date]);

  const q = `SELECT e.*, u.name as user_name, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.color as shift_color
    FROM shift_entries e JOIN users u ON u.id = e.user_id LEFT JOIN shift_types s ON s.id = e.shift_type_id WHERE e.id = ?`;

  const io = req.app.get('io');
  if (existing) {
    db.run('UPDATE shift_entries SET entry_type = ?, shift_type_id = ? WHERE id = ?',
      [entry_type, shift_type_id || null, existing.id]);
    io.to('all').emit('dienstplan:update');
    return res.json(db.get(q, [existing.id]));
  }
  db.run('INSERT INTO shift_entries (user_id, entry_date, entry_type, shift_type_id) VALUES (?, ?, ?, ?)',
    [userId, entry_date, entry_type, shift_type_id || null]);
  const newEntry = db.get(
    `SELECT e.*, u.name as user_name, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.color as shift_color
     FROM shift_entries e JOIN users u ON u.id = e.user_id LEFT JOIN shift_types s ON s.id = e.shift_type_id
     WHERE e.user_id = ? AND e.entry_date = ?`,
    [userId, entry_date]
  );
  io.to('all').emit('dienstplan:update');
  res.json(newEntry);
});

router.delete('/dienstplan/entries/:id', (req, res) => {
  const entryId = Number(req.params.id);
  const entry = db.get('SELECT * FROM shift_entries WHERE id = ?', [entryId]);
  if (!entry) return res.status(404).json({ error: 'Nicht gefunden' });
  if (entry.user_id !== req.session.userId && req.session.userRole !== 'admin')
    return res.status(403).json({ error: 'Keine Berechtigung' });
  db.run('DELETE FROM shift_entries WHERE id = ?', [entryId]);
  req.app.get('io').to('all').emit('dienstplan:update');
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  USERS & ADMIN
// ─────────────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  res.json(db.all('SELECT id, name FROM users ORDER BY name ASC'));
});

router.get('/admin/users', requireAdmin, (req, res) => {
  res.json(db.all('SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC'));
});

router.post('/admin/users', requireAdmin, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)  return res.status(400).json({ error: 'Alle Felder erforderlich' });
  if (password.length < 8)           return res.status(400).json({ error: 'Passwort mind. 8 Zeichen' });

  const existing = db.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) return res.status(400).json({ error: 'E-Mail bereits vergeben' });

  const hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name.trim(), email.trim().toLowerCase(), hash, 'user']);
  res.json({ success: true });
});

router.patch('/admin/users/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Passwort mind. 8 Zeichen' });
  const hash = await bcrypt.hash(password, 10);
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, Number(req.params.id)]);
  res.json({ success: true });
});

router.delete('/admin/users/:id', requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.session.userId) return res.status(400).json({ error: 'Kannst du nicht selbst löschen' });
  db.run('DELETE FROM users WHERE id = ?', [userId]);
  res.json({ success: true });
});

router.get('/admin/tasks', requireAdmin, (req, res) => {
  const todayDate = today();
  const tasks = db.all(`
    SELECT t.*, u.name as assigned_name, tc.id as completion_id
    FROM tasks t JOIN users u ON u.id = t.assigned_to
    LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.completion_date = ?
    WHERE t.is_active = 1
    ORDER BY u.name ASC, t.time_of_day ASC`, [todayDate]);
  res.json(tasks);
});

// ─── Auto-Update via GitHub ───────────────────────────────────────────────────
const { exec } = require('child_process');

function _githubGet(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     apiPath,
      headers:  { 'User-Agent': 'haushaltsbuch-updater', 'Accept': 'application/vnd.github.v3+json' }
    };
    https.get(options, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

router.get('/admin/update/info', requireAdmin, (req, res) => {
  const pkg  = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'package.json'), 'utf8'));
  const repo = process.env.GITHUB_REPO || db.get('SELECT value FROM settings WHERE key = ?', ['github_repo'])?.value || null;
  res.json({ version: pkg.version, repo });
});

router.post('/admin/update/repo', requireAdmin, (req, res) => {
  const { repo } = req.body;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    return res.status(400).json({ error: 'Format: besitzer/repo-name' });
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['github_repo', repo]);
  res.json({ success: true });
});

router.get('/admin/update/check', requireAdmin, async (req, res) => {
  const repo = process.env.GITHUB_REPO || db.get('SELECT value FROM settings WHERE key = ?', ['github_repo'])?.value;
  if (!repo) return res.status(400).json({ error: 'Kein GitHub-Repository konfiguriert' });
  try {
    const pkg  = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'package.json'), 'utf8'));
    const data = await _githubGet(`/repos/${repo}/releases/latest`);
    if (data.message) return res.status(404).json({ error: 'Repository nicht gefunden oder keine Releases vorhanden' });
    const latestVersion = data.tag_name?.replace(/^v/, '');
    res.json({
      currentVersion: pkg.version,
      latestVersion,
      hasUpdate:      latestVersion !== pkg.version,
      releaseUrl:     data.html_url,
      releaseName:    data.name,
      publishedAt:    data.published_at
    });
  } catch(e) {
    res.status(500).json({ error: 'GitHub nicht erreichbar' });
  }
});

router.post('/admin/update/apply', requireAdmin, (req, res) => {
  const projectDir = require('path').join(__dirname, '..');
  exec('git pull', { cwd: projectDir, timeout: 30000 }, (err, stdout, stderr) => {
    res.json({ success: !err, output: stdout || stderr || err?.message || '' });
  });
});

// ─── Rezept-Bild Proxy ────────────────────────────────────────────────────────
// GET /api/meal-image?q=TERM  →  streamt das Bild direkt durch (kein CORS, kein CSP-Problem)
const https = require('https');
const _mealUrlCache = {};   // q → TheMealDB-Bild-URL

function _httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

router.get('/meal-image', async (req, res) => {
  const q = (req.query.q || '').trim().slice(0, 80);
  if (!q) return res.status(400).end();

  try {
    // Bild-URL ermitteln (gecacht)
    let imgUrl = _mealUrlCache[q];
    if (!imgUrl) {
      const apiUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
      const data   = await _httpsGetJson(apiUrl);
      imgUrl = data.meals?.[0]?.strMealThumb;
      if (!imgUrl) return res.status(404).end();
      _mealUrlCache[q] = imgUrl;
    }

    // Bild durch-pipelinen → kommt von eigener Domain, kein CORS/CSP-Problem
    https.get(imgUrl, imgRes => {
      if (imgRes.statusCode !== 200) return res.status(404).end();
      res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 Tage
      imgRes.pipe(res);
    }).on('error', () => res.status(503).end());

  } catch (e) {
    res.status(500).end();
  }
});

module.exports = router;
