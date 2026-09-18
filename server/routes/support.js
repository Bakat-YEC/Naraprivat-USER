const express = require('express');
const { readDb, writeDb, uid } = require('../db');

const router = express.Router();

// CS yang bisa dihubungi: role 'cs' dan punya nomor WhatsApp valid
function csAgents(db) {
  return (db.admins || []).filter(
    (a) => a.role === 'cs' && String(a.whatsapp || '').replace(/\D/g, '').length >= 8
  );
}

// Round-robin: majukan kursor secara merata di antara CS yang tersedia
function nextCs(db) {
  const agents = csAgents(db);
  if (!agents.length) return null;
  if (!db.supportRR) db.supportRR = 0;
  const cs = agents[Number(db.supportRR) % agents.length];
  db.supportRR = (Number(db.supportRR) + 1) % agents.length;
  return cs;
}

function publicCs(a) {
  return {
    id: a.id,
    name: a.name,
    photoUrl: a.photoUrl || null,
    whatsapp: String(a.whatsapp || ''),
    greeting: a.csGreeting || 'Halo! Ada yang bisa saya bantu?'
  };
}

// GET /api/support/cs — CS yang sedang jaga (round-robin, tanpa bocorkan semua nomor)
router.get('/cs', (req, res) => {
  const db = readDb();
  const cs = nextCs(db);
  if (!cs) return res.json({ available: false, cs: null });
  writeDb(db);
  res.json({ available: true, cs: publicCs(cs) });
});

// POST /api/support/tickets — fallback tiket bantuan
router.post('/tickets', (req, res) => {
  const { name, email, whatsapp, subject, message } = req.body;
  const nameC = String(name || '').trim();
  const msgC = String(message || '').trim();
  if (!nameC || !msgC) {
    return res.status(400).json({ message: 'Nama dan pesan bantuan wajib diisi.' });
  }
  const db = readDb();
  if (!db.supportTickets) db.supportTickets = [];
  const cs = nextCs(db);
  const ticket = {
    id: uid('ticket'),
    name: nameC,
    email: String(email || '').trim() || null,
    whatsapp: String(whatsapp || '').trim() || null,
    subject: String(subject || '').trim() || 'Bantuan umum',
    message: msgC,
    status: 'open',
    assignedToId: cs ? cs.id : null,
    assignedToName: cs ? cs.name : null,
    createdAt: new Date().toISOString()
  };
  db.supportTickets.push(ticket);
  writeDb(db);
  res.status(201).json({ id: ticket.id, status: ticket.status, assignedToName: ticket.assignedToName });
});

module.exports = router;