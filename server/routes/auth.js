const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDb, writeDb, nextId, publicUser, studentPass, makeTutorCode, makeStudentCode, uid } = require('../db');
const { signToken, JWT_SECRET } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.'
});

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
  }
  const cleanRole = role === 'tutor' ? 'tutor' : 'student';
  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Format email tidak valid.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password minimal 6 karakter.' });
  }

  const db = readDb();
  const exists = db.users.find((u) => u.email === cleanEmail);
  if (exists && exists.role === cleanRole) {
    return res.status(409).json({ message: 'Email sudah terdaftar. Silakan login.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id: nextId(db.users),
    name: String(name).trim(),
    email: cleanEmail,
    passwordHash,
    role: cleanRole,
    createdAt: new Date().toISOString()
  };
  if (cleanRole === 'student') {
    Object.assign(user, {
      phoneOrEmail: cleanEmail,
      sessionToken: null,
      studentCode: makeStudentCode(db)
    });
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone) user.phone = cleanPhone;
  }
  if (cleanRole === 'tutor') {
    const { slugify } = require('../db');
    Object.assign(user, {
      headline: '',
      bio: '',
      subjects: [],
      subjectIds: [],
      city: '',
      price: 0,
      online: true,
      languages: ['Indonesia'],
      experienceYears: 0,
      verified: false,
      availability: [],
      whatsapp: '',
      gender: '',
      educationHistory: [],
      certificates: [],
      availabilityStatus: 'available',
      isPremium: false,
      premiumExpiresAt: null,
      status: 'active',
      slug: slugify(`${name} ${Date.now()}`),
      tutorCode: makeTutorCode(db),
      unlockCountToday: 0
    });
  }
  db.users.push(user);
  writeDb(db);

  const payload = publicUser(user);
  if (cleanRole === 'student') payload.studentPass = studentPass(db, user.id);

  res.status(201).json({
    token: signToken(user),
    user: payload
  });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const db = readDb();

  const admin = (db.admins || []).find((a) => a.email === cleanEmail);
  if (admin && admin.passwordHash) {
    const adminOk = await bcrypt.compare(String(password), admin.passwordHash);
    if (!adminOk) {
      return res.status(401).json({ message: 'Email/username atau password salah.' });
    }
    const { passwordHash, ...safeAdmin } = admin;
    return res.json({
      adminToken: jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '12h' }),
      admin: safeAdmin
    });
  }

  const wantedRole = req.body.role === 'tutor' ? 'tutor' : req.body.role === 'student' ? 'student' : null;
  const matches = db.users.filter(
    (u) => u.email === cleanEmail || (u.username && u.username.toLowerCase() === cleanEmail)
  );
  if (!matches.length) {
    return res.status(401).json({ message: 'Email/username atau password salah.' });
  }
  const user = wantedRole ? matches.find((u) => u.role === wantedRole) : matches[0];
  if (!user || !user.passwordHash) {
    if (wantedRole && matches.length) {
      const otherRole = matches[0].role === 'student' ? 'Murid' : 'Tutor';
      return res.status(401).json({
        message: `Email ini terdaftar sebagai ${otherRole}. Pilih tab "${otherRole}" di halaman Masuk.`
      });
    }
    return res.status(401).json({ message: 'Email/username atau password salah.' });
  }
  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Email/username atau password salah.' });
  }
  const payload = publicUser(user);
  if (payload.role === 'student') payload.studentPass = studentPass(db, user.id);
  res.json({
    token: signToken(user),
    user: payload
  });
});

// POST /auth/forgot-password — minta reset password.
// Demo tanpa server email: token reset disimpan + "dikirim" ke mailOutbox,
// dan ikut dikembalikan lewat respons agar alur bisa dicoba end-to-end.
router.post('/forgot-password', authLimiter, (req, res) => {
  const cleanEmail = String(req.body.email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return res.status(400).json({ message: 'Email wajib diisi.' });
  }
  const db = readDb();
  const user = db.users.find(
    (u) => u.email === cleanEmail || (u.username && u.username.toLowerCase() === cleanEmail)
  );
  if (!user) {
    return res.status(200).json({ message: 'Jika email terdaftar, instruksi reset password terkirim ke email Anda.' });
  }

  const token = uid('pwreset');
  if (!db.passwordResets) db.passwordResets = [];
  db.passwordResets = db.passwordResets.filter((r) => r.userId !== user.id);
  db.passwordResets.push({
    id: token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  });

  if (!db.mailOutbox) db.mailOutbox = [];
  db.mailOutbox.push({
    id: uid('mail'),
    to: user.email,
    subject: 'Reset password NARAPRIVAT',
    body:
      `Halo ${user.name},\n\n` +
      `Anda meminta reset password.\n\n` +
      `Kode reset Anda (berlaku 30 menit): ${token}\n\n` +
      `Jika bukan Anda yang meminta, abaikan email ini.`,
    sentAt: new Date().toISOString(),
    read: false
  });
  writeDb(db);

  res.json({
    message: 'Instruksi reset password terkirim ke email Anda.',
    resetToken: token,
    expiresInMinutes: 30
  });
});

// POST /auth/reset-password — set password baru memakai token reset
router.post('/reset-password', authLimiter, async (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (!token) {
    return res.status(400).json({ message: 'Kode reset wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
  }
  const db = readDb();
  const record = (db.passwordResets || []).find((r) => r.id === token);
  if (!record) {
    return res.status(400).json({ message: 'Kode reset tidak valid.' });
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    db.passwordResets = db.passwordResets.filter((r) => r.id !== token);
    writeDb(db);
    return res.status(410).json({ message: 'Kode reset sudah kedaluwarsa. Silakan minta ulang.' });
  }
  const user = db.users.find((u) => u.id === record.userId);
  if (!user) {
    return res.status(400).json({ message: 'Akun tidak ditemukan.' });
  }
  const bcrypt = require('bcryptjs');
  user.passwordHash = await bcrypt.hash(password, 10);
  if (!user.updatedAt) user.updatedAt = new Date().toISOString();
  db.passwordResets = db.passwordResets.filter((r) => r.id !== token);
  writeDb(db);

  res.json({ message: 'Password berhasil diperbarui. Silakan login.' });
});

module.exports = router;
