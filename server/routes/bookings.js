const express = require('express');
const { readDb, writeDb, nextId } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function attachNames(db, booking) {
  const tutor = db.users.find((u) => u.id === booking.tutorId);
  const student = db.users.find((u) => u.id === booking.studentId);
  return {
    ...booking,
    tutorName: tutor ? tutor.name : 'Tutor',
    tutorHeadline: tutor ? tutor.headline : '',
    tutorCity: tutor ? tutor.city : '',
    studentName: student ? student.name : 'Murid',
    reviewed: db.reviews.some((r) => r.bookingId === booking.id)
  };
}

router.post('/', authRequired, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Hanya murid yang bisa membuat pemesanan.' });
  }
  const { tutorId, subject, date, startTime, endTime, mode, note = '' } = req.body;
  if (!tutorId || !subject || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'Data pemesanan tidak lengkap.' });
  }
  const db = readDb();
  const tutor = db.users.find((u) => u.id === String(tutorId) && u.role === 'tutor');
  if (!tutor) {
    return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  }

  const price = Number(tutor.price) || 0;
  const booking = {
    id: nextId(db.bookings),
    tutorId: tutor.id,
    studentId: req.user.id,
    subject,
    date,
    startTime,
    endTime,
    mode: mode === 'offline' ? 'offline' : 'online',
    price,
    status: 'pending',
    note,
    createdAt: new Date().toISOString()
  };
  db.bookings.push(booking);
  writeDb(db);

  res.status(201).json(attachNames(db, booking));
});

router.get('/mine', authRequired, (req, res) => {
  const db = readDb();
  let bookings;
  if (req.user.role === 'student') {
    bookings = db.bookings.filter((b) => b.studentId === req.user.id);
  } else {
    bookings = db.bookings.filter((b) => b.tutorId === req.user.id);
  }
  bookings = bookings
    .map((b) => attachNames(db, b))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(bookings);
});

router.get('/stats', authRequired, (req, res) => {
  const db = readDb();
  const mine = db.bookings.filter((b) =>
    req.user.role === 'student' ? b.studentId === req.user.id : b.tutorId === req.user.id
  );
  const countBy = (status) => mine.filter((b) => b.status === status).length;
  res.json({
    total: mine.length,
    pending: countBy('pending'),
    accepted: countBy('accepted'),
    completed: countBy('completed'),
    cancelled: countBy('cancelled'),
    rejected: countBy('rejected')
  });
});

router.patch('/:id', authRequired, (req, res) => {
  const { status, note } = req.body;
  const db = readDb();
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ message: 'Pemesanan tidak ditemukan.' });
  }

  const isTutor = req.user.id === booking.tutorId;
  const isStudent = req.user.id === booking.studentId;
  if (!isTutor && !isStudent) {
    return res.status(403).json({ message: 'Anda tidak berhak mengubah pemesanan ini.' });
  }

  const transitions = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    rejected: []
  };

  if (status && !transitions[booking.status].includes(status)) {
    return res.status(400).json({
      message: `Status tidak dapat berubah dari "${booking.status}" menjadi "${status}".`
    });
  }

  if (status === 'accepted' || status === 'rejected' || status === 'completed') {
    if (!isTutor) {
      return res.status(403).json({ message: 'Hanya tutor yang dapat melakukan aksi ini.' });
    }
  }
  if (status === 'cancelled' && !isStudent) {
    return res.status(403).json({ message: 'Hanya murid yang dapat membatalkan pemesanan.' });
  }

  if (status) booking.status = status;
  if (note !== undefined) booking.note = note;
  writeDb(db);

  res.json(attachNames(db, booking));
});

module.exports = router;
