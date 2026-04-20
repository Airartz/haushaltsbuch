// Schützt alle API-Routen – leitet nicht-authentifizierte Anfragen ab
module.exports = function authMiddleware(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }
  next();
};
