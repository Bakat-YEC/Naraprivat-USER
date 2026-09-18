const express = require('express');
const { readDb, writeDb, nextId, publicUser, slugify, uid, makeTutorCode } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const STUDENT_PASS_PRICE = 49000;
const TUTOR_PREMIUM_PRICE = 29000;

const SUBJECTS = [
  'Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Inggris', 'Bahasa Indonesia',
  'Bahasa Mandarin', 'Sejarah', 'Geografi', 'Ekonomi', 'Akuntansi',
  'Programming', 'Web Development', 'Musik', 'Gitar', 'Piano'
];

const JENJANG = [
  'PAUD (Pendidikan Anak Usia Dini)', 'TK', 'SD', 'SMP', 'SMA/SMK',
  'UTBK/Persiapan Kuliah', 'Kuliah/Mahasiswa', 'Umum/Profesional'
];

function resolveSubjects(db, rawNames) {
  const ids = [];
  const names = [];
  const known = db.subjects.slice();
  for (const raw of rawNames) {
    const n = String(raw).trim();
    if (!n) continue;
    let s = known.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (!s) {
      s = { id: nextId(db.subjects), name: n, isPopular: false };
      db.subjects.push(s);
      known.push(s);
    }
    if (!ids.includes(s.id)) {
      ids.push(s.id);
      names.push(s.name);
    }
  }
  return { ids, names };
}

function isWhatsappValid(number) {
  const digits = String(number || '').replace(/[^0-9]/g, '');
  const normalized = digits.startsWith('62') ? digits : digits.startsWith('0') ? digits : '';
  if (!normalized) return false;
  return /^(08|62)\d{8,}$/.test(normalized);
}

function locationInfo(db, locationId) {
  const byId = {};
  db.locations.forEach((l) => { byId[l.id] = l; });
  const chain = [];
  let cur = locationId ? byId[locationId] : null;
  let guard = 0;
  while (cur && guard++ < 6) {
    chain.unshift(cur);
    cur = cur.parentId ? byId[cur.parentId] : null;
  }
  return chain.map((l) => ({ id: l.id, name: l.name, level: l.level }));
}

function aliasLocation(name) {
  return String(name).toLowerCase().replace(/^(kabupaten|kota)\s+/, '').trim();
}

function resolveCustomLocation(db, text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return null;
  const order = { provinsi: 0, kabupaten: 1, kecamatan: 2, desa: 3 };
  const matched = db.locations
    .filter((l) => {
      const alias = aliasLocation(l.name);
      return alias.length >= 3 && lower.includes(alias);
    })
    .sort((a, b) => order[b.level] - order[a.level] || aliasLocation(b.name).length - aliasLocation(a.name).length);
  return matched.length ? matched[0].id : null;
}

function tutorStats(tutor, db) {
  const reviews = db.reviews.filter((r) => r.tutorId === tutor.id);
  const total = reviews.length;
  const avg = total
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
    : 0;
  return { rating: avg, reviewCount: total };
}

const VEHICLES = ['Ada (Sepeda Motor)', 'Ada (Mobil)', 'Ada (Motor & Mobil)', 'Tidak Ada'];

function normalizeVehicle(value) {
  if (value === undefined || value === null || String(value).trim() === '') return 'Ada (Sepeda Motor)';
  const v = String(value).trim();
  return VEHICLES.find((x) => x.toLowerCase() === v.toLowerCase()) || 'Ada (Sepeda Motor)';
}

function toTutorCard(user, db) {
  const stats = tutorStats(user, db);
  const bookingCount = db.bookings.filter(
    (b) => b.tutorId === user.id && b.status === 'completed'
  ).length;
  const loc = locationInfo(db, user.locationId);
  return {
    id: user.id,
    slug: user.slug,
    name: user.name,
    headline: user.headline,
    subjects: user.subjects,
    jenjang: user.jenjang || [],
    city: user.city,
    locationId: user.locationId,
    locationName: loc[loc.length - 1] ? loc[loc.length - 1].name : user.city,
    locationPath: loc.map((l) => l.name),
    price: user.price,
    online: user.online,
    verified: user.verified,
    experienceYears: user.experienceYears,
    languages: user.languages,
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    showRating: user.hideRating !== true,
    completedBookings: bookingCount,
    availabilityStatus: user.availabilityStatus || 'available',
    isPremium: Boolean(user.isPremium),
    photoUrl: user.photoUrl || null
  };
}

function isTutorActive(u) {
  return u.role === 'tutor' && u.status !== 'takedown';
}

function isPremiumActive(user) {
  return Boolean(user.isPremium) && Boolean(user.premiumExpiresAt) && new Date(user.premiumExpiresAt) > new Date();
}

// ============ FILTER HELPER ============

function applyHierarchyFilter(tutors, db, loc) {
  if (!loc) return tutors;
  const byId = {};
  db.locations.forEach((l) => { byId[l.id] = l; });
  const target = byId[loc];
  if (!target) return tutors;
  // kumpulkan semua keturunan target
  const descendantSet = new Set([target.id]);
  let changed = true;
  while (changed) {
    changed = false;
    db.locations.forEach((l) => {
      if (l.parentId && descendantSet.has(l.parentId) && !descendantSet.has(l.id)) {
        descendantSet.add(l.id);
        changed = true;
      }
    });
  }
  // jalur nama target (mis. Tulungagung > Jawa Timur) untuk mencocokkan lokasi manual
  const chain = [];
  let cur = target;
  let guard = 0;
  while (cur && guard++ < 6) {
    chain.unshift(String(cur.name).toLowerCase());
    cur = cur.parentId ? byId[cur.parentId] : null;
  }
  return tutors.filter(
    (u) =>
      descendantSet.has(u.locationId) ||
      (u.city && chain.some((n) => String(u.city).toLowerCase().includes(n)))
  );
}

// ============ ROUTES ============

router.get('/subjects', (req, res) => {
  res.json(SUBJECTS);
});

router.get('/cities', (req, res) => {
  const db = readDb();
  const counts = {};
  db.users
    .filter((u) => u.role === 'tutor' && u.city)
    .forEach((u) => {
      counts[u.city] = (counts[u.city] || 0) + 1;
    });
  res.json(
    Object.entries(counts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
  );
});

// GET /api/tutors — pencarian dengan hierarki lokasi + subjek
router.get('/', (req, res) => {
  const db = readDb();
  const {
    q = '',
    subject = '',
    jenjang = '',
    provinsi = '',
    kabupaten = '',
    kecamatan = '',
    desa = '',
    locationId = '',
    minPrice = '',
    maxPrice = '',
    minRating = '',
    online = '',
    availability = '',
    gender = '',
    vehicle = '',
    sort = 'recommended',
    page = '1',
    perPage = '9'
  } = req.query;

  let tutors = db.users.filter(isTutorActive);

  const query = String(q).trim().toLowerCase();
  if (query) {
    tutors = tutors.filter((u) =>
      [u.name, u.headline, u.bio, ...(u.subjects || []), u.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query))
    );
  }
  if (subject) {
    tutors = tutors.filter((u) =>
      (u.subjects || []).some((s) => s.toLowerCase() === String(subject).toLowerCase())
    );
  }
  if (jenjang) {
    const targetJenjang = String(jenjang).toLowerCase();
    tutors = tutors.filter((u) =>
      (u.jenjang || []).some((j) => j.toLowerCase() === targetJenjang)
    );
  }
  // hierarki: pilih id paling spesifik yang diberikan
  const locParam = desa || kecamatan || kabupaten || provinsi || locationId;
  if (locParam) {
    tutors = applyHierarchyFilter(tutors, db, locParam);
  }
  if (minPrice !== '') tutors = tutors.filter((u) => u.price >= Number(minPrice));
  if (maxPrice !== '') tutors = tutors.filter((u) => u.price <= Number(maxPrice));
  if (minRating !== '') {
    const minR = Number(minRating);
    tutors = tutors.filter((u) => u.hideRating !== true && tutorStats(u, db).rating >= minR);
  }
  if (online === 'true' || online === '1') tutors = tutors.filter((u) => u.online);
  if (online === 'false' || online === '0') tutors = tutors.filter((u) => !u.online);
  if (availability === 'available') tutors = tutors.filter((u) => u.availabilityStatus === 'available');
  if (gender) {
    const g = String(gender).toLowerCase();
    tutors = tutors.filter((u) => String(u.gender || '').toLowerCase() === g);
  }
  if (vehicle) {
    const v = VEHICLES.find((x) => x.toLowerCase() === String(vehicle).toLowerCase());
    if (v) tutors = tutors.filter((u) => normalizeVehicle(u.vehicle) === v);
  }
  if (sort === 'rating') tutors = tutors.filter((u) => u.hideRating !== true);

  const withStats = tutors.map((u) => ({
    ...toTutorCard(u, db),
    bio: u.bio
  }));

  const popularity = (t) => t.completedBookings * 10 + t.rating;
  switch (sort) {
    case 'rating':
      withStats.sort((a, b) => b.rating - a.rating || popularity(b) - popularity(a));
      break;
    case 'price_asc':
      withStats.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      withStats.sort((a, b) => b.price - a.price);
      break;
    case 'newest':
      withStats.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'popular':
      withStats.sort((a, b) => popularity(b) - popularity(a));
      break;
    case 'recommended':
    default:
      // Premium mendapat boost urutan pencarian
      withStats.sort(
        (a, b) =>
          (b.isPremium ? 1000 : 0) + popularity(b) -
          ((a.isPremium ? 1000 : 0) + popularity(a))
      );
      break;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(30, Math.max(1, Number(perPage) || 9));
  const start = (pageNum - 1) * size;
  const items = withStats.slice(start, start + size);

  res.json({
    items,
    total: withStats.length,
    page: pageNum,
    perPage: size,
    totalPages: Math.ceil(withStats.length / size) || 1
  });
});

// GET /api/tutors/permalink/:slug — SEO permalink
router.get('/permalink/:slug', (req, res) => {
  const db = readDb();
  const tutor = db.users.find((u) => u.role === 'tutor' && u.slug === req.params.slug && u.status !== 'takedown');
  if (!tutor) {
    return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  }
  return sendTutorDetail(res, db, tutor);
});

// POST /api/tutors — registrasi tutor ringkas (auto-approve)
router.post('/', async (req, res) => {
  const {
    name, email, password, gender,
    whatsapp, educationHistory, certificateUrls, photoUrl,
    subjectIds, subjects: subjectNames, locationId, customLocation, headline, bio, jenjang, vehicle
  } = req.body;

  if (!name || !email || !password || !gender || !whatsapp) {
    return res.status(400).json({ message: 'Lengkapi data wajib: nama, email, password, gender, dan nomor WhatsApp.' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Format email tidak valid.' });
  }
  if (!isWhatsappValid(whatsapp)) {
    return res.status(400).json({ message: 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx (minimal 10 digit).' });
  }
  if (!Array.isArray(educationHistory) || educationHistory.length < 2) {
    return res.status(400).json({ message: 'Minimal 2 riwayat pendidikan wajib diisi.' });
  }
  const db = readDb();
  const cleanJenjang = JENJANG.filter((j) => String(jenjang || '').toLowerCase() === j.toLowerCase() || (Array.isArray(jenjang) && jenjang.some((x) => String(x).toLowerCase() === j.toLowerCase())));
  if (cleanJenjang.length === 0) {
    return res.status(400).json({ message: 'Pilih minimal 1 jenjang sekolah yang diajar.' });
  }
  const rawSubjectNames = Array.isArray(subjectNames) ? subjectNames : Array.isArray(subjectIds) ? subjectIds : [];
  const resolved = resolveSubjects(db, rawSubjectNames);
  if (resolved.ids.length === 0) {
    return res.status(400).json({ message: 'Pilih minimal 1 bidang ajar.' });
  }
  if (resolved.ids.length > 1) {
    return res.status(400).json({ message: 'Tutor baru hanya bisa mengisi 1 bidang ajar dulu. Upgrade ke Premium untuk menambah bidang ajar lain.' });
  }
  if (db.users.some((u) => u.email === cleanEmail && u.role === 'tutor')) {
    return res.status(409).json({ message: 'Email sudah terdaftar sebagai tutor. Silakan login.' });
  }
  let finalLocationId = locationId;
  let city = '';
  if (customLocation && String(customLocation).trim()) {
    city = String(customLocation).trim();
    finalLocationId = resolveCustomLocation(db, city);
  } else {
    const loc = db.locations.find((l) => l.id === finalLocationId);
    if (!loc || loc.level !== 'kecamatan') {
      return res.status(400).json({ message: 'Pilih lokasi mengajar hingga level Kecamatan, atau isi lokasi manual.' });
    }
    city = loc.name;
  }

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(String(password), 10);
  const subjects = resolved.names;
  const baseSlug = slugify(`${subjects[0] || 'tutor'} ${city} ${name}`);
  let slug = baseSlug;
  let n = 2;
  while (db.users.some((u) => u.slug === slug)) slug = `${baseSlug}-${n++}`;

  const tutor = {
    id: nextId(db.users),
    name: String(name).trim(),
    email: cleanEmail,
    passwordHash,
    role: 'tutor',
    gender,
    headline: headline || '',
    bio: bio || '',
    subjects,
    subjectIds: resolved.ids,
    jenjang: cleanJenjang,
    city,
    locationId: finalLocationId,
    price: 0,
    online: true,
    languages: ['Indonesia'],
    experienceYears: 0,
    vehicle: normalizeVehicle(vehicle),
    verified: false,
    availability: [],
    whatsapp: String(whatsapp).trim(),
    educationHistory: educationHistory.slice(0, 5),
    certificates: (certificateUrls || []).map((c, i) => ({
      id: uid('cert'),
      name: typeof c === 'string' ? c : c.name,
      url: typeof c === 'string' ? c : c.url,
      previewUrl: typeof c === 'object' ? c.previewUrl || null : null,
      size: typeof c === 'object' ? c.size : 0,
      verified: false
    })),
    photoUrl: photoUrl || null,
    availabilityStatus: 'available',
    isPremium: false,
    premiumExpiresAt: null,
    status: 'active',
    slug,
    tutorCode: makeTutorCode(db),
    unlockCountToday: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.users.push(tutor);
  writeDb(db);

  const { signToken } = require('../middleware/auth');
  res.status(201).json({
    token: signToken(tutor),
    user: publicUser(tutor),
    message: 'Pendaftaran tutor berhasil. Profil Anda langsung aktif.'
  });
});

router.get('/me', authRequired, (req, res) => {
  if (req.user.role !== 'tutor') {
    return res.status(403).json({ message: 'Hanya untuk akun tutor.' });
  }
  res.json(publicUser(req.user));
});

// GET /api/tutors/contacted — daftar tutor yang pernah dihubungi murid
router.get('/contacted', authRequired, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Hanya untuk akun murid.' });
  }
  const db = readDb();
  const student = db.users.find((u) => u.id === req.user.id);
  const ids = Array.isArray(student && student.contactedTutors) ? student.contactedTutors : [];
  const items = ids
    .map((id) => db.users.find((u) => u.id === id && isTutorActive(u)))
    .filter(Boolean)
    .map((u) => toTutorCard(u, db));
  res.json({ items, total: items.length });
});

router.patch('/me', authRequired, (req, res) => {
  if (req.user.role !== 'tutor') {
    return res.status(403).json({ message: 'Hanya untuk akun tutor.' });
  }
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });

  const premiumActive = isPremiumActive(user);

  // Premium-gated: ganti nama
  if (req.body.name !== undefined) {
    const newName = String(req.body.name).trim();
    if (newName && newName !== user.name && !premiumActive) {
      return res.status(400).json({ message: 'Ubah nama hanya untuk tutor Premium. Upgrade Premium dulu.' });
    }
    if (newName) user.name = newName;
  }

  // Premium-gated: ganti nomor WhatsApp
  if (req.body.whatsapp !== undefined) {
    const newWa = String(req.body.whatsapp).trim();
    if (newWa && newWa !== user.whatsapp && !premiumActive) {
      return res.status(400).json({ message: 'Ubah nomor WhatsApp hanya untuk tutor Premium. Upgrade Premium dulu.' });
    }
    if (newWa) {
      if (!isWhatsappValid(newWa)) {
        return res.status(400).json({ message: 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx (minimal 10 digit).' });
      }
      user.whatsapp = newWa;
    }
  }

  const allowed = ['headline', 'bio', 'jenjang', 'subjects', 'subjectIds', 'city', 'price', 'online', 'languages', 'experienceYears', 'vehicle', 'availability', 'contactEmail', 'photoUrl', 'availabilityStatus', 'educationHistory', 'locationId'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) user[key] = req.body[key];
  });
  if (req.body.vehicle !== undefined) user.vehicle = normalizeVehicle(req.body.vehicle);
  if (req.body.customLocation && String(req.body.customLocation).trim()) {
    const customText = String(req.body.customLocation).trim();
    user.city = customText;
    user.locationId = resolveCustomLocation(db, customText);
  }
  if (req.body.locationId === null || req.body.locationId === '') {
    user.locationId = null;
  }
  const rawNames = Array.isArray(req.body.subjects) ? req.body.subjects : Array.isArray(req.body.subjectIds) ? req.body.subjectIds : null;
  if (rawNames !== null) {
    if (!premiumActive && rawNames.length > 1) {
      return res.status(400).json({ message: 'Akun gratis hanya bisa mengajar 1 bidang ajar. Upgrade ke Premium untuk menambah bidang ajar lain.' });
    }
    const resolved = resolveSubjects(db, rawNames);
    user.subjectIds = resolved.ids;
    user.subjects = resolved.names;
  }
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(publicUser(user));
});

function sendTutorDetail(res, db, tutor) {
  const reviews = db.reviews
    .filter((r) => r.tutorId === tutor.id)
    .map((r) => {
      const student = db.users.find((u) => u.id === r.studentId);
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        studentName: student ? student.name : 'Murid'
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const stats = tutorStats(tutor, db);
  const completedBookings = db.bookings.filter(
    (b) => b.tutorId === tutor.id && b.status === 'completed'
  ).length;

  res.json({
    ...toTutorCard(tutor, db),
    bio: tutor.bio,
    vehicle: tutor.vehicle || 'Ada (Sepeda Motor)',
    languages: tutor.languages,
    availability: tutor.availability,
    email: tutor.email,
    contactEmail: tutor.contactEmail || tutor.email,
    gender: tutor.gender,
    whatsapp: tutor.whatsapp,
    whatsappMasked: maskNumber(tutor.whatsapp),
    educationHistory: tutor.educationHistory || [],
    certificates: (tutor.certificates || []).map((c) => ({
      id: c.id,
      name: c.name,
      url: /\.(png|jpe?g|webp)$/i.test(c.url || '') ? c.url : null,
      previewUrl: c.previewUrl || null
    })),
    memberSince: tutor.createdAt,
    completedBookings,
    rating: stats.rating,
    reviewCount: stats.reviewCount,
    reviews
  });
}

function maskNumber(number = '') {
  const digits = String(number).replace(/[^0-9]/g, '');
  if (digits.length <= 6) return digits.replace(/\d/g, '*');
  return digits.slice(0, 4) + '••••' + digits.slice(-2);
}

// GET /api/tutors/:idOrSlug
router.get('/:idOrSlug', (req, res) => {
  const db = readDb();
  const { idOrSlug } = req.params;
  const tutor = db.users.find(
    (u) =>
      u.role === 'tutor' &&
      u.status !== 'takedown' &&
      (u.id === idOrSlug || u.slug === idOrSlug)
  );
  if (!tutor) {
    return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  }
  return sendTutorDetail(res, db, tutor);
});

// POST /api/tutors/:id/report — lapor nomor tidak aktif
router.post('/:id/report', (req, res) => {
  const db = readDb();
  const tutor = db.users.find((u) => u.id === req.params.id && u.role === 'tutor');
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  const { note = '' } = req.body;
  if (!db.notifications) db.notifications = [];
  db.notifications.push({
    id: uid('notif'),
    type: 'report_invalid_number',
    target: 'operasional',
    message: `Nomor WhatsApp ${tutor.name} dilaporkan tidak aktif.`,
    tutorId: tutor.id,
    note,
    read: false,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.status(201).json({ ok: true, message: 'Terima kasih. Laporan Anda akan ditinjau tim kami.' });
});

// POST /api/tutors/:id/unlock — catat unlock & notifikasi jika >10/hari
router.post('/:id/unlock', authRequired, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Hanya murid yang bisa meng-unlock profil tutor.' });
  }
  const db = readDb();
  const tutor = db.users.find((u) => u.id === req.params.id && u.role === 'tutor');
  if (!tutor) return res.status(404).json({ message: 'Tutor tidak ditemukan.' });
  if (tutor.availabilityStatus === 'full') {
    return res.status(423).json({ message: 'Tutor sedang penuh (Full). Silakan cari tutor lain.' });
  }

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
  const student = db.users.find((u) => u.id === req.user.id);
  if (student) {
    if (!Array.isArray(student.contactedTutors)) student.contactedTutors = [];
    student.contactedTutors = [tutor.id, ...student.contactedTutors.filter((id) => id !== tutor.id)];
  }
  writeDb(db);
  res.json({ ok: true, unlockCountToday: tutor.unlockCountToday });
});

module.exports = router;
module.exports.isWhatsappValid = isWhatsappValid;
module.exports.STUDENT_PASS_PRICE = STUDENT_PASS_PRICE;
module.exports.TUTOR_PREMIUM_PRICE = TUTOR_PREMIUM_PRICE;
module.exports.toTutorCard = toTutorCard;
module.exports.locationInfo = locationInfo;
