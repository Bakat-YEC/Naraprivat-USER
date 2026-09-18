const express = require('express');
const { readDb, writeDb, nextId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews
// Review via ID Tutor (tutorCode) — siswa memasukkan ID yang dibagikan tutor
// setelah les sungguhan selesai. Jalur lama (bookingId) tetap didukung.
router.post('/', authRequired, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Hanya murid yang bisa memberikan ulasan.' });
  }
  const { bookingId, tutorCode, rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating harus antara 1 sampai 5.' });
  }
  if (!bookingId && !tutorCode) {
    return res.status(400).json({ message: 'ID Tutor atau pemesanan wajib diisi.' });
  }

  const db = readDb();
  let tutorId = null;
  let booking = null;

  if (tutorCode) {
    const tutor = db.users.find(
      (u) =>
        u.role === 'tutor' &&
        u.tutorCode &&
        String(u.tutorCode).toUpperCase() === String(tutorCode).trim().toUpperCase()
    );
    if (!tutor || tutor.status === 'takedown') {
      return res.status(404).json({ message: 'ID Tutor tidak ditemukan. Periksa kembali kode yang diberikan tutor.' });
    }
    tutorId = tutor.id;
  } else {
    booking = db.bookings.find((b) => b.id === String(bookingId));
    if (!booking) {
      return res.status(404).json({ message: 'Pemesanan tidak ditemukan.' });
    }
    if (booking.studentId !== req.user.id) {
      return res.status(403).json({ message: 'Anda hanya bisa menilai pemesanan Anda sendiri.' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Ulasan hanya bisa diberikan setelah kelas selesai.' });
    }
    tutorId = booking.tutorId;
  }

  const existing = db.reviews.find((r) => r.studentId === req.user.id && r.tutorId === tutorId);
  if (existing) {
    const tutor = db.users.find((u) => u.id === tutorId);
    return res.status(409).json({
      message: `Anda sudah memberikan ulasan untuk ${tutor ? tutor.name : 'tutor ini'}.`
    });
  }

  const review = {
    id: nextId(db.reviews),
    bookingId: booking ? booking.id : null,
    tutorId,
    studentId: req.user.id,
    rating: Number(rating),
    comment: String(comment || '').trim(),
    createdAt: new Date().toISOString()
  };
  db.reviews.push(review);
  writeDb(db);

  res.status(201).json(review);
});

// GET /api/reviews/mine — ulasan yang ditulis siswa (dengan nama tutor)
router.get('/mine', authRequired, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Hanya untuk akun murid.' });
  }
  const db = readDb();
  const items = db.reviews
    .filter((r) => r.studentId === req.user.id)
    .map((r) => {
      const tutor = db.users.find((u) => u.id === r.tutorId);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        tutorId: r.tutorId,
        tutorName: tutor ? tutor.name : 'Tutor',
        tutorSlug: tutor ? tutor.slug : ''
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

// GET /api/reviews/tutor — ulasan yang diterima tutor (dengan nama siswa)
router.get('/tutor', authRequired, (req, res) => {
  if (req.user.role !== 'tutor') {
    return res.status(403).json({ message: 'Hanya untuk akun tutor.' });
  }
  const db = readDb();
  const items = db.reviews
    .filter((r) => r.tutorId === req.user.id)
    .map((r) => {
      const student = db.users.find((u) => u.id === r.studentId);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        studentId: r.studentId,
        studentName: student ? student.name : 'Murid'
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

module.exports = router;