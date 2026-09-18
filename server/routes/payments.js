const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { readDb, writeDb, nextId, uid, slugify, makeStudentCode } = require('../db');
const { authRequired } = require('../middleware/auth');
const { toTutorCard } = require('./tutors');

const router = express.Router();

const STUDENT_PASS_PRICE = 59000;
const TUTOR_PREMIUM_PRICE = 29000;
const COUPON_DISCOUNT = 10000;
const SESSION_TTL_MS = 24 * 3600 * 1000;

function passPrice(db) {
  return (db.config && db.config.studentPassPrice) || STUDENT_PASS_PRICE;
}
function premiumPrice(db) {
  return (db.config && db.config.tutorPremiumPrice) || TUTOR_PREMIUM_PRICE;
}

function orderIdFor(t) {
  if (t.orderId) return t.orderId;
  const d = new Date(t.createdAt || Date.now());
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `INV-${ymd}-${String(t.id).padStart(4, '0')}`;
}

function studentHasPass(db, studentId) {
  return db.transactions.some(
    (t) => t.type === 'student_pass' && t.studentId === studentId && t.paymentStatus === 'success'
  );
}

function makeUsername(name, db) {
  const base = (slugify(name).replace(/[^a-z0-9]/g, '') || 'siswa').slice(0, 12);
  let u = base;
  let i = 1;
  while (db.users.some((x) => x.username && x.username.toLowerCase() === u.toLowerCase())) {
    i += 1;
    u = `${base}${i}`;
  }
  return u;
}

function randomPassword() {
  return crypto.randomBytes(5).toString('hex');
}

// Kode unik 3 digit (> 700, ketiga digitnya berbeda) untuk nominal pembayaran.
function hasDistinctDigits(n) {
  const a = Math.floor(n / 100);
  const b = Math.floor(n / 10) % 10;
  const c = n % 10;
  return a !== b && b !== c && a !== c;
}

function makeUniqueCode(db) {
  const used = new Set(
    (db.transactions || []).filter((t) => t.uniqueCode != null).map((t) => Number(t.uniqueCode))
  );
  const candidates = [];
  for (let n = 701; n <= 999; n += 1) {
    if (hasDistinctDigits(n) && !used.has(n)) candidates.push(n);
  }
  const pool = candidates.length ? candidates : Array.from({ length: 299 }, (_, i) => 701 + i);
  return pool[Math.floor(Math.random() * pool.length)];
}

function reserveUniqueCode(db, requested) {
  const n = Number(requested);
  if (
    Number.isInteger(n) && n >= 701 && n <= 999 && hasDistinctDigits(n) &&
    !(db.transactions || []).some((t) => t.uniqueCode === n)
  ) {
    return n;
  }
  return makeUniqueCode(db);
}

// Pakai data diri yang diisi di checkout; kalau email sudah ada sebagai siswa, dipakai kembali.
function findOrCreateStudent(db, buyer) {
  const cleanEmail = String((buyer && buyer.email) || '').trim().toLowerCase();
  const name = String((buyer && buyer.name) || '').trim();
  const phone = String((buyer && buyer.phone) || '').trim();
  if (!name) return { error: 'Nama lengkap wajib diisi.', status: 400 };
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return { error: 'Format email tidak valid.', status: 400 };
  if (!phone) return { error: 'Nomor WhatsApp wajib diisi.', status: 400 };

  const existing = db.users.find((u) => u.email === cleanEmail && u.role === 'student');
  if (existing) {
    if (!existing.studentCode) existing.studentCode = makeStudentCode(db);
    return { student: existing, created: false };
  }

  const student = {
    id: nextId(db.users),
    name,
    email: cleanEmail,
    passwordHash: null,
    username: null,
    role: 'student',
    phoneOrEmail: cleanEmail,
    whatsapp: phone.replace(/[^0-9+]/g, ''),
    sessionToken: null,
    studentCode: makeStudentCode(db),
    autoCreated: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(student);
  return { student, created: true };
}

// Bikin kredensial (username+password) setelah pembayaran sukses, "kirim" ke email.
function provisionStudentCreds(db, student) {
  const username = makeUsername(student.name, db);
  const password = randomPassword();
  student.username = username;
  student.passwordHash = bcrypt.hashSync(password, 10);
  student.credsSentAt = new Date().toISOString();
  if (!db.mailOutbox) db.mailOutbox = [];
  db.mailOutbox.push({
    id: uid('mail'),
    to: student.email,
    subject: 'Akun NARAPRIVAT berhasil dibuat',
    body:
      `Halo ${student.name},\n\n` +
      `Akun murid Anda di NARAPRIVAT sudah dibuat otomatis setelah pembayaran Akses Premium.\n\n` +
      `Username: ${username}\nPassword: ${password}\n\n` +
      `Gunakan kredensial ini untuk login dan melihat riwayat Anda.`,
    sentAt: new Date().toISOString(),
    read: false
  });
  return { username, password };
}

function createSession(db, studentId, tutorId, transactionId) {
  const token = uid('sess');
  db.sessions.push({
    token,
    studentId,
    tutorId,
    transactionId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  });
  return token;
}

function bumpUnlockCount(db, tutorId) {
  const tutor = db.users.find((u) => u.id === tutorId);
  if (!tutor) return;
  const today = new Date().toISOString().slice(0, 10);
  if (tutor.unlockDate !== today) {
    tutor.unlockDate = today;
    tutor.unlockCountToday = 0;
  }
  tutor.unlockCountToday = (tutor.unlockCountToday || 0) + 1;
  if (tutor.unlockCountToday > 10) {
    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: uid('notif'),
      type: 'tutor_overload',
      target: 'operasional',
      message: `Profil ${tutor.name} di-unlock ${tutor.unlockCountToday} kali hari ini. Cek status ketersediaan tutor.`,
      tutorId: tutor.id,
      read: false,
      createdAt: new Date().toISOString()
    });
  }
}

function sanitizeTransaction(t) {
  return {
    id: t.id,
    orderId: orderIdFor(t),
    type: t.type,
    studentId: t.studentId,
    tutorId: t.tutorId,
    amount: t.amount,
    uniqueCode: t.uniqueCode != null ? t.uniqueCode : null,
    totalAmount: (t.amount || 0) + (t.uniqueCode || 0),
    couponCode: t.couponCode,
    affiliateId: t.affiliateId,
    paymentStatus: t.paymentStatus,
    paymentMethod: t.paymentMethod || null,
    gatewayRef: t.gatewayRef,
    returnUrl: t.returnUrl,
    buyerName: t.buyerName,
    buyerEmail: t.buyerEmail,
    buyerPhone: t.buyerPhone,
    autoUsername: t.autoUsername,
    createdAt: t.createdAt,
    paidAt: t.paidAt
  };
}

// GET /api/payments/mine — riwayat pembayaran siswa (Student Pass) / tutor (Premium)
router.get('/mine', authRequired, (req, res) => {
  const db = readDb();
  const items = db.transactions
    .filter((t) => {
      if (req.user.role === 'student') return t.type === 'student_pass' && t.studentId === req.user.id;
      if (req.user.role === 'tutor') return t.type === 'tutor_premium' && t.tutorId === req.user.id;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(sanitizeTransaction);
  res.json(items);
});

// GET /api/payments/price — harga publik (tanpa login)
router.get('/price', (req, res) => {
  const db = readDb();
  res.json({
    studentPassPrice: passPrice(db),
    tutorPremiumPrice: premiumPrice(db),
    couponDiscount: COUPON_DISCOUNT
  });
});

// GET /api/payments/access?tutorId=X — cek akses siswa (untuk tombol Hubungi/WA)
router.get('/access', authRequired, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Hanya untuk akun murid.' });
  }
  const db = readDb();
  const tutor = db.users.find(
    (u) => u.role === 'tutor' && u.status !== 'takedown' && (u.id === req.query.tutorId || u.slug === req.query.tutorId)
  );
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  const hasPass = studentHasPass(db, req.user.id);
  const successTx = db.transactions.find(
    (t) => t.type === 'student_pass' && t.studentId === req.user.id && t.paymentStatus === 'success'
  );
  res.json({
    hasAccess: hasPass,
    passPrice: passPrice(db),
    tutor: toTutorCard(tutor, db),
    lastPass: successTx ? sanitizeTransaction(successTx) : null
  });
});

// POST /api/payments/student-pass — buat transaksi Student Pass (pending) + session.
// Tanpa login: pakai data diri (nama, email, WA) yang diisi di checkout.
// Akun siswa otomatis dibuat/dipakai; password baru dibuat setelah pembayaran sukses.
router.post('/student-pass', (req, res) => {
  const { tutorId: rawTutorId, couponCode, buyer } = req.body;
  const tutorId = String(rawTutorId);
  const db = readDb();
  const tutor = db.users.find((u) => u.id === tutorId && u.role === 'tutor');
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  if (tutor.availabilityStatus === 'full') {
    return res.status(423).json({ message: 'Tutor sedang penuh (Full). Silakan cari tutor lain.' });
  }

  const buyerResult = findOrCreateStudent(db, buyer || {});
  if (buyerResult.error) return res.status(buyerResult.status).json({ message: buyerResult.error });
  const student = buyerResult.student;

  if (studentHasPass(db, student.id)) {
    res.status(200).json({ alreadyHasAccess: true, tutorSlug: tutor.slug });
    return;
  }

  let affiliateId = null;
  let appliedCoupon = null;
  if (couponCode) {
    const aff = db.affiliates.find(
      (a) => a.couponCode.toLowerCase() === String(couponCode).trim().toLowerCase()
    );
    if (aff) {
      affiliateId = aff.id;
      appliedCoupon = aff.couponCode;
    }
  }

  const transaction = {
    id: nextId(db.transactions, 'tx'),
    type: 'student_pass',
    studentId: student.id,
    tutorId: tutor.id,
    amount: appliedCoupon ? Math.max(0, passPrice(db) - COUPON_DISCOUNT) : passPrice(db),
    uniqueCode: reserveUniqueCode(db, req.body && req.body.uniqueCode),
    couponCode: appliedCoupon,
    affiliateId,
    paymentStatus: 'pending',
    gatewayRef: null,
    returnUrl: `/tutor/${tutor.slug}`,
    buyerName: student.name,
    buyerEmail: student.email,
    buyerPhone: student.whatsapp || '',
    createdAt: new Date().toISOString(),
    paidAt: null
  };
  transaction.orderId = orderIdFor(transaction);
  db.transactions.push(transaction);
  const sessionToken = createSession(db, student.id, tutor.id, transaction.id);
  writeDb(db);

  res.status(201).json({
    transaction: sanitizeTransaction(transaction),
    sessionToken,
    paymentUrl: `/payments/mock/${transaction.id}`,
    couponValid: Boolean(appliedCoupon),
    couponDiscount: appliedCoupon ? COUPON_DISCOUNT : 0,
    originalAmount: passPrice(db),
    couponError: couponCode && !appliedCoupon ? 'Kode kupon tidak valid. Transaksi tetap bisa dilanjutkan.' : null
  });
});

// POST /api/payments/premium — tutor beli paket Premium
router.post('/premium', authRequired, (req, res) => {
  if (req.user.role !== 'tutor') {
    return res.status(403).json({ message: 'Hanya tutor yang bisa membeli paket Premium.' });
  }
  const { couponCode } = req.body;
  const db = readDb();
  const tutor = db.users.find((u) => u.id === req.user.id);
  let affiliateId = null;
  if (couponCode) {
    const aff = db.affiliates.find(
      (a) => a.couponCode.toLowerCase() === String(couponCode).trim().toLowerCase()
    );
    if (aff) affiliateId = aff.id;
  }
  const transaction = {
    id: nextId(db.transactions, 'tx'),
    type: 'tutor_premium',
    studentId: null,
    tutorId: tutor.id,
    amount: premiumPrice(db),
    couponCode: affiliateId ? String(couponCode) : null,
    affiliateId,
    paymentStatus: 'pending',
    gatewayRef: null,
    returnUrl: '/dashboard?tab=profil',
    createdAt: new Date().toISOString(),
    paidAt: null
  };
  transaction.orderId = orderIdFor(transaction);
  db.transactions.push(transaction);
  writeDb(db);
  res.status(201).json({ transaction: sanitizeTransaction(transaction), paymentUrl: `/payments/mock/${transaction.id}` });
});

// GET /api/payments/transaction/:id — polling status
router.get('/transaction/:id', (req, res) => {
  const db = readDb();
  const t = db.transactions.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  res.json(sanitizeTransaction(t));
});

// GET /api/payments/session/:token — resume sesi pembayaran (24 jam)
router.get('/session/:token', (req, res) => {
  const db = readDb();
  const session = db.sessions.find((s) => s.token === req.params.token);
  if (!session) return res.status(404).json({ message: 'Sesi tidak ditemukan.' });
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return res.status(410).json({ message: 'Sesi pembayaran sudah kedaluwarsa (lebih dari 24 jam).' });
  }
  const transaction = db.transactions.find((t) => t.id === session.transactionId);
  const tutor = db.users.find((u) => u.id === session.tutorId);
  if (transaction && transaction.paymentStatus !== 'pending') {
    return res.json({ session, transaction: sanitizeTransaction(transaction), tutor: tutor ? toTutorCard(tutor, db) : null, resolved: true });
  }
  res.json({
    session,
    transaction: transaction ? sanitizeTransaction(transaction) : null,
    tutor: tutor ? toTutorCard(tutor, db) : null,
    resolved: false,
    expiresAt: session.expiresAt
  });
});

// --- MOCK PAYMENT GATEWAY ---

function settleTransaction(db, id, status, method) {
  const t = db.transactions.find((x) => x.id === id);
  if (!t) return null;
  if (t.paymentStatus !== 'pending') return sanitizeTransaction(t);
  t.paymentStatus = status;
  if (method) t.paymentMethod = String(method);
  t.gatewayRef = 'MOCK-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  let creds = null;
  if (status === 'success') {
    t.paidAt = new Date().toISOString();
    if (t.type === 'student_pass') {
      bumpUnlockCount(db, t.tutorId);
      const student = db.users.find((u) => u.id === t.studentId);
      if (student && !student.passwordHash) {
        creds = provisionStudentCreds(db, student);
        t.autoUsername = creds.username;
        t.autoPassword = creds.password;
      }
    }
    if (t.type === 'tutor_premium') {
      const tutor = db.users.find((u) => u.id === t.tutorId);
      if (tutor) {
        tutor.isPremium = true;
        tutor.premiumExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      }
    }
  }
  writeDb(db);
  const safe = sanitizeTransaction(t);
  if (creds) safe.autoCredentials = creds;
  return safe;
}

// POST /api/payments/mock/:id/pay — simulasikan sukses
router.post('/mock/:id/pay', (req, res) => {
  const db = readDb();
  const t = settleTransaction(db, req.params.id, 'success', req.body && req.body.method);
  if (!t) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  res.json({ status: 'success', transaction: t });
});

// POST /api/payments/mock/:id/fail — simulasikan gagal
router.post('/mock/:id/fail', (req, res) => {
  const db = readDb();
  const t = settleTransaction(db, req.params.id, 'failed');
  if (!t) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  res.json({ status: 'failed', transaction: t });
});

module.exports = router;
module.exports.STUDENT_PASS_PRICE = STUDENT_PASS_PRICE;
module.exports.TUTOR_PREMIUM_PRICE = TUTOR_PREMIUM_PRICE;
