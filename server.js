const express        = require('express');
const http           = require('http');
const { Server }     = require('socket.io');
const session        = require('express-session');
const FileStore      = require('session-file-store')(session);
const path           = require('path');
const crypto         = require('crypto');
const webpush        = require('web-push');
const db             = require('./database');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: false } });

async function start() {
  // Datenbank initialisieren
  await db.init();
  console.log('✓ Datenbank bereit');

  // ─── VAPID Keys ─────────────────────────────────────────────────────────────
  let vapidPublicKey, vapidPrivateKey;
  const pubRow = db.get('SELECT value FROM settings WHERE key = ?', ['vapid_public']);
  if (pubRow) {
    vapidPublicKey  = pubRow.value;
    vapidPrivateKey = db.get('SELECT value FROM settings WHERE key = ?', ['vapid_private']).value;
  } else {
    const keys      = webpush.generateVAPIDKeys();
    vapidPublicKey  = keys.publicKey;
    vapidPrivateKey = keys.privateKey;
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['vapid_public',  vapidPublicKey]);
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['vapid_private', vapidPrivateKey]);
  }

  webpush.setVapidDetails(
    'mailto:admin@zuhause.fgdetailing.site',
    vapidPublicKey,
    vapidPrivateKey
  );

  // ─── Session Secret ──────────────────────────────────────────────────────────
  const secretRow   = db.get('SELECT value FROM settings WHERE key = ?', ['session_secret']);
  const sessionSecret = secretRow
    ? secretRow.value
    : (() => {
        const s = crypto.randomBytes(32).toString('hex');
        db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['session_secret', s]);
        return s;
      })();

  // ─── Middleware ──────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const sessionDir = path.join(__dirname, 'data', 'sessions');
  const sessionMiddleware = session({
    store: new FileStore({
      path:           sessionDir,
      ttl:            365 * 24 * 60 * 60, // 1 Jahr
      retries:        1,
      logFn:          () => {}
    }),
    secret:            sessionSecret,
    resave:            false,
    saveUninitialized: false,
    rolling:           false,
    cookie: {
      maxAge:   365 * 24 * 60 * 60 * 1000, // 1 Jahr – kein Timeout
      httpOnly: true,
      sameSite: 'lax'
    }
  });

  app.use(sessionMiddleware);

  // Session für Socket.io verfügbar machen
  const wrap = mw => (socket, next) => mw(socket.request, {}, next);
  io.use(wrap(sessionMiddleware));

  // App-weite Referenzen
  app.set('io',             io);
  app.set('webpush',        webpush);
  app.set('vapidPublicKey', vapidPublicKey);

  // ─── Routes ─────────────────────────────────────────────────────────────────
  const authMiddleware = require('./middleware/auth');
  app.use('/auth', require('./routes/auth'));
  app.use('/api',  authMiddleware, require('./routes/api'));
  app.use('/push', authMiddleware, require('./routes/push'));

  // Static files & SPA catch-all
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  );

  // ─── Socket.io ──────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.request.session?.userId;
    if (!userId) { socket.disconnect(true); return; }
    socket.join('all');
    socket.join(`user:${userId}`);
    console.log(`[Socket] User ${userId} verbunden`);
  });

  // ─── Push Background Job ────────────────────────────────────────────────────
  const notifiedToday = new Set();
  let   lastNotifDate  = new Date().toDateString();

  // "08:45" + 60 → "09:45"  (klappt auch über 24h hinaus nicht – reicht für den Tagesbetrieb)
  function addMinutes(hhmm, mins) {
    const [h, m] = hhmm.split(':').map(Number);
    const total  = h * 60 + m + mins;
    return `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
  }

  // Sendet payload an eine Liste von subscription-Zeilen; bereinigt abgelaufene
  function sendPush(rows, payload) {
    for (const row of rows) {
      try {
        webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404)
              db.run('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
          });
      } catch (_) {}
    }
  }

  function checkAndSendPushNotifications() {
    const now        = new Date();
    const today      = now.toDateString();
    if (today !== lastNotifDate) { notifiedToday.clear(); lastNotifDate = today; }

    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const todayDate   = now.toISOString().split('T')[0];
    const dayOfWeek   = (now.getDay() + 6) % 7;   // 0=Mo … 6=So
    const dayOfMonth  = now.getDate();

    const in60 = addMinutes(currentTime, 60);   // Uhrzeit in 60 Minuten
    const in1  = addMinutes(currentTime, 1);    // Uhrzeit in 1 Minute

    // ── Aufgaben: 1 Stunde vorher an ALLE ─────────────────────────────────────
    const tasks60 = db.all(`
      SELECT t.id, t.title, t.time_of_day FROM tasks t
      LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.completion_date = ?
      WHERE t.is_active = 1 AND tc.id IS NULL AND t.time_of_day = ?
        AND (t.recurrence = 'daily'
          OR (t.recurrence = 'weekly'  AND t.day_of_week  = ?)
          OR (t.recurrence = 'monthly' AND t.day_of_month = ?))
    `, [todayDate, in60, dayOfWeek, dayOfMonth]);

    for (const task of tasks60) {
      const key = `t60:${task.id}:${todayDate}`;
      if (notifiedToday.has(key)) continue;
      notifiedToday.add(key);
      sendPush(db.all('SELECT id, subscription FROM push_subscriptions'), {
        title:   'Aufgabe in 1 Stunde',
        body:    `"${task.title}" steht um ${task.time_of_day} Uhr an – denk dran!`,
        url:     '/',
        taskId:  task.id,
        actions: [{ action: 'dismiss', title: 'OK' }]
      });
    }

    // ── Aufgaben: 1 Minute vorher an ALLE ─────────────────────────────────────
    const tasks1 = db.all(`
      SELECT t.id, t.title, t.time_of_day FROM tasks t
      LEFT JOIN task_completions tc ON tc.task_id = t.id AND tc.completion_date = ?
      WHERE t.is_active = 1 AND tc.id IS NULL AND t.time_of_day = ?
        AND (t.recurrence = 'daily'
          OR (t.recurrence = 'weekly'  AND t.day_of_week  = ?)
          OR (t.recurrence = 'monthly' AND t.day_of_month = ?))
    `, [todayDate, in1, dayOfWeek, dayOfMonth]);

    for (const task of tasks1) {
      const key = `t1:${task.id}:${todayDate}`;
      if (notifiedToday.has(key)) continue;
      notifiedToday.add(key);
      sendPush(db.all('SELECT id, subscription FROM push_subscriptions'), {
        title:   'Aufgabe in 1 Minute!',
        body:    `"${task.title}" um ${task.time_of_day} Uhr – vergiss sie nicht!`,
        url:     '/',
        taskId:  task.id,
        actions: [
          { action: 'complete', title: 'Erledigt' },
          { action: 'dismiss',  title: 'Schließen' }
        ]
      });
    }

    // ── Kalender-Termine: 1 Stunde vorher NUR an den Ersteller ────────────────
    const calEvents = db.all(`
      SELECT id, title, event_time, created_by FROM calendar_events
      WHERE event_date = ? AND event_time = ?
    `, [todayDate, in60]);

    for (const ev of calEvents) {
      const key = `c60:${ev.id}:${todayDate}`;
      if (notifiedToday.has(key)) continue;
      notifiedToday.add(key);
      sendPush(
        db.all('SELECT id, subscription FROM push_subscriptions WHERE user_id = ?', [ev.created_by]),
        {
          title:   'Termin in 1 Stunde',
          body:    `"${ev.title}" beginnt um ${ev.event_time} Uhr – denk daran!`,
          url:     '/',
          actions: [{ action: 'dismiss', title: 'OK' }]
        }
      );
    }
  }

  // Jede Minute prüfen
  setInterval(checkAndSendPushNotifications, 60 * 1000);
  checkAndSendPushNotifications();


  // ─── Server starten ─────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`\n✓ Haushaltsbuch läuft auf http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('Startup-Fehler:', err);
  process.exit(1);
});
