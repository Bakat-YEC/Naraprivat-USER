const express = require('express');
const { readDb } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDb();
  const { popular = '', q = '' } = req.query;
  let items = db.subjects.slice();
  if (popular === 'true' || popular === '1') items = items.filter((s) => s.isPopular);
  if (q) {
    const query = String(q).toLowerCase();
    items = items.filter((s) => s.name.toLowerCase().includes(query));
  }
  res.json(items);
});

module.exports = router;
