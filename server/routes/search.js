const express = require('express');
const { readDb, writeDb, nextId } = require('../db');

const router = express.Router();

function cleanLogs(logs, limit = 30) {
  return logs
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// GET /api/search/logs?limit=30 -> 30 pencarian terakhir (Live Search Feed)
router.get('/logs', (req, res) => {
  const db = readDb();
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 30));
  const logs = cleanLogs(db.searchLogs, limit).map((l) => ({
    id: l.id,
    subject: l.subject,
    locationName: l.locationName,
    resultCount: l.resultCount,
    createdAt: l.createdAt
  }));
  res.json(logs);
});

// POST /api/search/logs -> catat pencarian
router.post('/logs', (req, res) => {
  const { subject = '', locationId = '', locationName = '', resultCount = 0 } = req.body;
  if (!subject) {
    return res.status(400).json({ message: 'Subjek wajib diisi untuk mencatat pencarian.' });
  }
  const db = readDb();
  const subjEntry = db.subjects.find((s) => s.name.toLowerCase() === String(subject).toLowerCase());
  db.searchLogs.push({
    id: nextId(db.searchLogs),
    subject,
    subjectId: subjEntry ? subjEntry.id : null,
    locationId: locationId || null,
    locationName: locationName || '',
    resultCount: Number(resultCount) || 0,
    createdAt: new Date().toISOString()
  });
  db.searchLogs = cleanLogs(db.searchLogs, 50);
  writeDb(db);
  res.status(201).json({ ok: true });
});

// GET /api/search/trends -> tren pencarian untuk Admin Analytics
router.get('/trends', (req, res) => {
  const db = readDb();
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
  const since = Date.now() - days * 86400000;
  const logs = db.searchLogs.filter((l) => new Date(l.createdAt).getTime() >= since);
  const bySubject = {};
  const byLocation = {};
  logs.forEach((l) => {
    bySubject[l.subject] = (bySubject[l.subject] || 0) + 1;
    if (l.locationName) byLocation[l.locationName] = (byLocation[l.locationName] || 0) + 1;
  });
  const subjectTrends = Object.entries(bySubject)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const locationTrends = Object.entries(byLocation)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  res.json({ days, total: logs.length, subjectTrends, locationTrends });
});

module.exports = router;
