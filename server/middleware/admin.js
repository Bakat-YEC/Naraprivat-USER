const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');
const { readDb } = require('../db');

function adminRequired(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Autentikasi admin diperlukan.' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload.adminId) {
        return res.status(403).json({ message: 'Akses hanya untuk admin.' });
      }
      const db = readDb();
      const admin = db.admins.find((a) => a.id === payload.adminId);
      if (!admin) return res.status(401).json({ message: 'Sesi admin tidak valid.' });
      if (roles.length && !roles.includes(admin.role) && admin.role !== 'system') {
        return res.status(403).json({ message: 'Anda tidak punya hak akses untuk aksi ini.' });
      }
      req.admin = admin;
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Token admin tidak valid.' });
    }
  };
}

module.exports = { adminRequired };
