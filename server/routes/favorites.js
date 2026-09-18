const express = require('express');
const { readDb, writeDb } = require('../db');
const { authRequired } = require('../middleware/auth');
const { toTutorCard } = require('./tutors');

const router = express.Router();

function studentOnly(req, res, next) {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ message: 'Fitur favorit hanya untuk murid.' });
  }
  next();
}

function normalizeFavorites(user) {
  if (!Array.isArray(user.favorites)) user.favorites = [];
  return user.favorites;
}

router.get('/', authRequired, studentOnly, (req, res) => {
  const db = readDb();
  const ids = normalizeFavorites(req.user);
  const items = ids
    .map((id) => db.users.find((u) => u.id === id && u.role === 'tutor' && u.status !== 'takedown'))
    .filter(Boolean)
    .map((u) => toTutorCard(u, db));
  res.json(items);
});

router.post('/:tutorId', authRequired, studentOnly, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  const tutor = db.users.find((u) => u.id === req.params.tutorId && u.role === 'tutor');
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  const favorites = normalizeFavorites(user);
  if (!favorites.includes(tutor.id)) favorites.push(tutor.id);
  writeDb(db);
  res.json({ ok: true, favorites });
});

router.delete('/:tutorId', authRequired, studentOnly, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  const favorites = normalizeFavorites(user);
  user.favorites = favorites.filter((id) => id !== req.params.tutorId);
  writeDb(db);
  res.json({ ok: true, favorites: user.favorites });
});

module.exports = router;
