const express = require('express');
const { readDb } = require('../db');

const router = express.Router();

// GET /api/locations?level=provinsi -> daftar provinsi
// GET /api/locations?parentId=X&level=kabupaten -> anak dari X
router.get('/', (req, res) => {
  const db = readDb();
  const { level = '', parentId = '' } = req.query;
  let items = db.locations;
  if (level) items = items.filter((l) => l.level === level);
  if (parentId) items = items.filter((l) => l.parentId === parentId);
  items = items
    .map((l) => ({
      id: l.id,
      name: l.name,
      level: l.level,
      parentId: l.parentId,
      children: db.locations.filter((c) => c.parentId === l.id).length
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  res.json(items);
});

// GET /api/locations/tree -> pohon lengkap (dipakai autocomplete lokasi)
router.get('/tree', (req, res) => {
  const db = readDb();
  const byParent = {};
  db.locations.forEach((l) => {
    const key = l.parentId || 'root';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(l);
  });
  function build(id) {
    return (byParent[id] || [])
      .map((l) => ({ ...l, children: build(l.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }
  res.json(build('root'));
});

// GET /api/locations/path/:id -> jalur "Provinsi > Kab > Kec"
router.get('/path/:id', (req, res) => {
  const db = readDb();
  const byId = {};
  db.locations.forEach((l) => { byId[l.id] = l; });
  const chain = [];
  let cur = byId[req.params.id];
  let guard = 0;
  while (cur && guard++ < 6) {
    chain.unshift(cur);
    cur = cur.parentId ? byId[cur.parentId] : null;
  }
  res.json(chain.map((l) => ({ id: l.id, name: l.name, level: l.level })));
});

module.exports = router;
