const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDb, publicUser, studentPass } = require('./db');
const { authRequired } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const tutorRoutes = require('./routes/tutors');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const locationRoutes = require('./routes/locations');
const subjectRoutes = require('./routes/subjects');
const searchRoutes = require('./routes/search');
const paymentRoutes = require('./routes/payments');
const affiliateRoutes = require('./routes/affiliates');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/uploads');
const supportRoutes = require('./routes/support');
const favoriteRoutes = require('./routes/favorites');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NARAPRIVAT API', time: new Date().toISOString() });
});

app.get('/api/me', authRequired, (req, res) => {
  const user = publicUser(req.user);
  if (user.role === 'student') {
    user.studentPass = studentPass(readDb(), user.id);
  }
  res.json(user);
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));
app.use('/api/auth', authRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/favorites', favoriteRoutes);

if (process.env.NODE_ENV === 'production') {
  const buildDir = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(buildDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(buildDir, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log(`NARAPRIVAT API berjalan di http://localhost:${PORT}`);
  const db = readDb();
  console.log(`Data: ${db.users.length} user, ${db.locations.length} lokasi, ${db.subjects.length} subjek, ${db.transactions.length} transaksi`);
});
