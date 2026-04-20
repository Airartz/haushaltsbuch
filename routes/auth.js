const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../database');

const router = express.Router();

router.get('/needs-setup', (_req, res) => {
  const row = db.get('SELECT COUNT(*) as count FROM users');
  res.json({ needsSetup: (row?.count ?? 0) === 0 });
});

router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    id:   req.session.userId,
    name: req.session.userName,
    role: req.session.userRole
  });
});

router.post('/setup', async (req, res) => {
  const row = db.get('SELECT COUNT(*) as count FROM users');
  if ((row?.count ?? 0) > 0) return res.status(403).json({ error: 'Setup bereits abgeschlossen' });

  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
  if (password.length < 8)         return res.status(400).json({ error: 'Passwort mind. 8 Zeichen' });

  const hash   = await bcrypt.hash(password, 10);
  const result = db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name.trim(), email.trim().toLowerCase(), hash, 'admin']);

  req.session.userId   = result.lastInsertRowid;
  req.session.userName = name.trim();
  req.session.userRole = 'admin';

  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session-Fehler' });
    res.json({ success: true });
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Felder erforderlich' });

  const user = db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user)  return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });

  req.session.userId   = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;

  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session-Fehler' });
    res.json({ success: true, name: user.name, role: user.role });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

module.exports = router;
