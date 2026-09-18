const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { readDb, findUser } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET tidak diset. Memakai secret acak — semua token akan tidak valid saat server restart. Set env JWT_SECRET untuk produksi.');
}

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Autentikasi diperlukan.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = readDb();
    const user = findUser(db, (u) => u.id === payload.id);
    if (!user) {
      return res.status(401).json({ message: 'Sesi tidak valid.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa.' });
  }
}

module.exports = { JWT_SECRET, signToken, authRequired };
