const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDb, writeDb, uid } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan login admin. Tunggu 15 menit.'
});

function publicAdmin(admin) {
  if (!admin) return null;
  const { passwordHash, ...safe } = admin;
  return safe;
}

function signAdminToken(admin) {
  return jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '12h' });
}

// POST /api/admin/login
router.post('/login', adminLoginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }
  const db = readDb();
  const admin = db.admins.find((a) => a.email === String(email).trim().toLowerCase());
  if (!admin) return res.status(401).json({ message: 'Email atau password salah.' });
  const ok = await bcrypt.compare(String(password), admin.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Email atau password salah.' });
  res.json({ token: signAdminToken(admin), admin: publicAdmin(admin) });
});

router.get('/me', adminRequired(), (req, res) => res.json(publicAdmin(req.admin)));

// GET /api/admin/overview — statistik umum (system, keuangan, analytics)
router.get('/overview', adminRequired('keuangan', 'analytics', 'system'), (req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const tx = db.transactions.filter((t) => t.type === 'student_pass');
  const success = tx.filter((t) => t.paymentStatus === 'success');
  const todaySuccess = success.filter((t) => (t.paidAt || '').slice(0, 10) === today);
  const revenue = success.reduce((s, t) => s + t.amount, 0);
  const todayRevenue = todaySuccess.reduce((s, t) => s + t.amount, 0);
  const affiliateCommissions = success
    .filter((t) => t.affiliateId)
    .map((t) => {
      const aff = db.affiliates.find((a) => a.id === t.affiliateId);
      return { amount: t.amount, pct: aff ? aff.commissionPct : 0 };
    });
  const commissionTotal = affiliateCommissions.reduce((s, c) => s + (c.amount * c.pct) / 100, 0);
  res.json({
    students: db.users.filter((u) => u.role === 'student').length,
    tutors: db.users.filter((u) => u.role === 'tutor' && u.status !== 'takedown').length,
    passSold: success.length,
    revenue,
    todaySold: todaySuccess.length,
    todayRevenue,
    commissionTotal,
    affiliateSales: affiliateCommissions.length,
    totalTransactions: tx.length
  });
});

// GET /api/admin/transactions?status=&type= — CS & Keuangan
router.get('/transactions', adminRequired('cs', 'keuangan', 'system'), (req, res) => {
  const db = readDb();
  const { status = '', type = '' } = req.query;
  let items = db.transactions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) items = items.filter((t) => t.paymentStatus === status);
  if (type) items = items.filter((t) => t.type === type);
  const result = items.map((t) => {
    const student = t.studentId ? db.users.find((u) => u.id === t.studentId) : null;
    const tutor = db.users.find((u) => u.id === t.tutorId);
    const aff = t.affiliateId ? db.affiliates.find((a) => a.id === t.affiliateId) : null;
    return {
      id: t.id,
      type: t.type,
      amount: t.amount,
      paymentStatus: t.paymentStatus,
      gatewayRef: t.gatewayRef,
      createdAt: t.createdAt,
      paidAt: t.paidAt,
      couponCode: t.couponCode,
      studentName: student ? student.name : '-',
      tutorName: tutor ? tutor.name : '-',
      affiliateName: aff ? aff.name : null
    };
  });
  res.json(result);
});

// GET /api/admin/transactions/export — CSV untuk Admin Keuangan
router.get('/transactions/export', adminRequired('keuangan', 'system'), (req, res) => {
  const db = readDb();
  const items = db.transactions.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const header = ['ID', 'Tipe', 'Murid', 'Tutor', 'Jumlah', 'Status', 'Kupon', 'Affiliate', 'Dibuat', 'Dibayar'];
  const rows = items.map((t) => {
    const student = t.studentId ? db.users.find((u) => u.id === t.studentId) : null;
    const tutor = db.users.find((u) => u.id === t.tutorId);
    const aff = t.affiliateId ? db.affiliates.find((a) => a.id === t.affiliateId) : null;
    return [
      t.id,
      t.type,
      student ? student.name : '-',
      tutor ? tutor.name : '-',
      t.amount,
      t.paymentStatus,
      t.couponCode || '',
      aff ? aff.name : '',
      t.createdAt,
      t.paidAt || ''
    ];
  });
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="transaksi-naraprivat-${timestamp}.csv"`);
  res.send('\uFEFF' + csv);
});

// GET /api/admin/notifications — Admin Operasional
router.get('/notifications', adminRequired('operasional', 'system'), (req, res) => {
  const db = readDb();
  const items = (db.notifications || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

router.patch('/notifications/:id/read', adminRequired('operasional', 'system'), (req, res) => {
  const db = readDb();
  const n = (db.notifications || []).find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ message: 'Notifikasi tidak ditemukan.' });
  n.read = true;
  writeDb(db);
  res.json({ ok: true });
});

// GET /api/admin/tutors — daftar tutor + status (Operasional)
router.get('/tutors', adminRequired('operasional', 'system'), (req, res) => {
  const db = readDb();
  const items = db.users
    .filter((u) => u.role === 'tutor')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      verified: u.verified,
      whatsapp: u.whatsapp,
      subjects: u.subjects,
      locationId: u.locationId,
      createdAt: u.createdAt,
      unlockCountToday: u.unlockCountToday || 0,
      showRating: u.hideRating !== true,
      hasCertificate: (u.certificates || []).some((c) => c.verified)
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

// PATCH /api/admin/tutors/rating/all — tampil/sembunyi rating semua tutor (Operasional)
router.patch('/tutors/rating/all', adminRequired('operasional', 'system'), (req, res) => {
  const { showRating } = req.body;
  if (typeof showRating !== 'boolean') {
    return res.status(400).json({ message: 'showRating harus boolean.' });
  }
  const db = readDb();
  let count = 0;
  db.users.forEach((u) => {
    if (u.role !== 'tutor') return;
    if (showRating) delete u.hideRating;
    else u.hideRating = true;
    u.updatedAt = new Date().toISOString();
    count++;
  });
  writeDb(db);
  res.json({ ok: true, showRating, count });
});

// PATCH /api/admin/tutors/:id/rating — tampil/sembunyi rating tutor (Operasional)
router.patch('/tutors/:id/rating', adminRequired('operasional', 'system'), (req, res) => {
  const { showRating } = req.body;
  if (typeof showRating !== 'boolean') {
    return res.status(400).json({ message: 'showRating harus boolean.' });
  }
  const db = readDb();
  const tutor = db.users.find((u) => u.id === req.params.id && u.role === 'tutor');
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  if (showRating) delete tutor.hideRating;
  else tutor.hideRating = true;
  tutor.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ ok: true, showRating });
});

// PATCH /api/admin/tutors/:id/status — takedown/active (Operasional)
router.patch('/tutors/:id/status', adminRequired('operasional', 'system'), (req, res) => {
  const { status } = req.body;
  if (!['active', 'takedown'].includes(status)) {
    return res.status(400).json({ message: 'Status harus active atau takedown.' });
  }
  const db = readDb();
  const tutor = db.users.find((u) => u.id === req.params.id && u.role === 'tutor');
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  tutor.status = status;
  tutor.updatedAt = new Date().toISOString();
  if (status === 'takedown') {
    const sched = new Date(Date.now() + 90 * 86400000).toISOString();
    tutor.takedownDeletedAt = sched;
  }
  writeDb(db);
  res.json({ ok: true, status: tutor.status });
});

// GET /api/admin/search-trends — Admin Analytics
router.get('/search-trends', adminRequired('analytics', 'system'), (req, res) => {
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
    .sort((a, b) => b.count - a.count);
  const locationTrends = Object.entries(byLocation)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  res.json({ days, total: logs.length, subjectTrends, locationTrends });
});

// GET /api/admin/pass-price — Admin System
router.get('/pass-price', adminRequired('system'), (req, res) => {
  const db = readDb();
  res.json(db.config || {});
});

// PATCH /api/admin/pass-price — ubah harga Student Pass (hanya System)
router.patch('/pass-price', adminRequired('system'), (req, res) => {
  const { studentPassPrice, tutorPremiumPrice } = req.body;
  const db = readDb();
  if (!db.config) db.config = {};
  if (studentPassPrice !== undefined) {
    const n = Number(studentPassPrice);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ message: 'Harga Akses Premium tidak valid.' });
    db.config.studentPassPrice = Math.round(n);
  }
  if (tutorPremiumPrice !== undefined) {
    const n = Number(tutorPremiumPrice);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ message: 'Harga Premium tidak valid.' });
    db.config.tutorPremiumPrice = Math.round(n);
  }
  writeDb(db);
  res.json(db.config);
});

// GET /api/admin/tickets — tiket bantuan user (CS & Operasional)
router.get('/tickets', adminRequired('cs', 'operasional', 'system'), (req, res) => {
  const db = readDb();
  const items = (db.supportTickets || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

// PATCH /api/admin/tickets/:id/status — tandai selesai (CS & Operasional)
router.patch('/tickets/:id/status', adminRequired('cs', 'operasional', 'system'), (req, res) => {
  const { status } = req.body;
  if (!['open', 'done'].includes(status)) {
    return res.status(400).json({ message: 'Status harus open atau done.' });
  }
  const db = readDb();
  const t = (db.supportTickets || []).find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ message: 'Tiket tidak ditemukan.' });
  t.status = status;
  t.handledAt = status === 'done' ? new Date().toISOString() : t.handledAt;
  writeDb(db);
  res.json({ ok: true, status: t.status });
});

// GET /api/admin/affiliates — daftar affiliate (keuangan/system)
router.get('/affiliates', adminRequired('keuangan', 'system'), (req, res) => {
  const db = readDb();
  res.json(db.affiliates.map((a) => ({ ...a })));
});

module.exports = router;
