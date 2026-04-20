const express = require('express');
const db      = require('../database');
const router  = express.Router();

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: req.app.get('vapidPublicKey') });
});

router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription fehlt' });

  const userId  = req.session.userId;
  const subJson = JSON.stringify(subscription);

  db.run('INSERT OR IGNORE INTO push_subscriptions (user_id, subscription) VALUES (?, ?)', [userId, subJson]);
  res.json({ success: true });
});

router.post('/test', async (req, res) => {
  const userId  = req.session.userId;
  const webpush = req.app.get('webpush');
  const subs    = db.all('SELECT id, subscription FROM push_subscriptions WHERE user_id = ?', [userId]);

  if (subs.length === 0) return res.status(400).json({ error: 'Keine Subscription gefunden. Bitte erst Benachrichtigungen aktivieren.' });

  let sent = 0, failed = 0;
  for (const row of subs) {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), JSON.stringify({
        title:  'Test-Benachrichtigung',
        body:   'Push-Benachrichtigungen funktionieren!',
        url:    '/'
      }));
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.run('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
      }
    }
  }
  res.json({ success: true, sent, failed });
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  const userId       = req.session.userId;
  const subs         = db.all('SELECT id, subscription FROM push_subscriptions WHERE user_id = ?', [userId]);

  for (const row of subs) {
    try {
      if (JSON.parse(row.subscription).endpoint === endpoint) {
        db.run('DELETE FROM push_subscriptions WHERE id = ?', [row.id]);
      }
    } catch (_) {}
  }
  res.json({ success: true });
});

module.exports = router;
