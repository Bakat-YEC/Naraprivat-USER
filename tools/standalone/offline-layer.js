// NARAPRIVAT offline API layer â€” mirrors server/routes/* behavior in pure browser JS.
// The generator (tools/make-standalone.mjs) replaces __EMBED_DB_PAYLOAD__ with the bundled db.json.
window.__NP_OFFLINE__ = (function () {
  'use strict';

  var EMBEDDED_DB = __EMBED_DB_PAYLOAD__;

  var STORE_KEY = 'np_offline_db_v1';
  var SUBJECTS = [
    'Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Inggris', 'Bahasa Indonesia',
    'Bahasa Mandarin', 'Sejarah', 'Geografi', 'Ekonomi', 'Akuntansi',
    'Programming', 'Web Development', 'Musik', 'Gitar', 'Piano'
  ];
  var JENJANG = [
    'PAUD (Pendidikan Anak Usia Dini)', 'TK', 'SD', 'SMP', 'SMA/SMK',
    'UTBK/Persiapan Kuliah', 'Kuliah/Mahasiswa', 'Umum/Profesional'
  ];
  var STUDENT_PASS_PRICE = 59000;
  var TUTOR_PREMIUM_PRICE = 29000;
  var COUPON_DISCOUNT = 10000;
  var SESSION_TTL_MS = 24 * 3600 * 1000;

  // ---------- helpers ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function nextId(collection) {
    var max = collection.reduce(function (m, item) {
      var n = parseInt(String(item.id).replace(/[^0-9]/g, ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return String(max + 1);
  }
  function slugify(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  function randomSix() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  }
  function makeTutorCode() {
    var code = '';
    do {
      code = 'T-' + randomSix();
    } while (db.users.some(function (u) { return u.tutorCode && u.tutorCode.toUpperCase() === code; }));
    return code;
  }
  function makeStudentCode() {
    var code = '';
    do {
      code = 'S-' + randomSix();
    } while (db.users.some(function (u) { return u.studentCode && u.studentCode.toUpperCase() === code; }));
    return code;
  }
  function err(status, message) {
    var e = new Error(message);
    e.status = status;
    return e;
  }
  function publicUser(u) {
    if (!u) return null;
    var c = clone(u);
    delete c.passwordHash;
    return c;
  }
  function studentPass(userId) {
    var paid = (db.transactions || [])
      .filter(function (t) { return t.type === 'student_pass' && String(t.studentId) === String(userId) && t.paymentStatus === 'success'; })
      .sort(function (a, b) { return new Date(b.paidAt || 0) - new Date(a.paidAt || 0); });
    if (!paid.length) return { hasPass: false, passSince: null, passCount: 0 };
    return { hasPass: true, passSince: paid[0].paidAt, passCount: paid.length };
  }
  function parseBody(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
  }
  function parseQuery(qs) {
    var out = {};
    if (!qs) return out;
    qs.replace(/^\?/, '').split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i === -1 ? pair : pair.slice(0, i);
      var v = i === -1 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      if (k) out[k] = v;
    });
    return out;
  }

  function okPassword(stored, pwd) {
    if (!stored) return false;
    if (String(stored).indexOf('plain:') === 0) return stored.slice(6) === String(pwd);
    // Seed accounts all use password123.
    return String(pwd) === 'password123';
  }

  // ---------- db load/persist ----------
  function mergeDb(saved) {
    var base = clone(EMBEDDED_DB);
    if (!saved) return base;
    ['locations', 'subjects', 'admins', 'affiliates'].forEach(function (k) {
      if (saved[k] && saved[k].length) base[k] = clone(saved[k]);
    });
    ['users', 'transactions', 'bookings', 'reviews', 'searchLogs', 'sessions', 'notifications'].forEach(function (k) {
      if (!(saved[k] && saved[k].length)) return;
      var merged = clone(saved[k]);
      (base[k] || []).forEach(function (item) {
        if (!merged.some(function (x) { return String(x.id) === String(item.id); })) merged.push(item);
      });
      base[k] = merged;
    });
    if (saved.config && typeof saved.config === 'object') {
      base.config = Object.assign({}, base.config || {}, saved.config);
    }
    return base;
  }
  function loadDb() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved) return mergeDb(JSON.parse(saved));
    } catch (e) { /* ignore */ }
    return clone(EMBEDDED_DB);
  }
var db = loadDb();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* quota — keep in-memory only */ }
  }

  function neutralAvatarUri(name) {
    var letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
      '<rect width="96" height="96" rx="48" fill="#e9eef2"/>' +
      '<text x="48" y="60" font-family="Nunito,Arial,sans-serif" font-size="40" font-weight="700" fill="#475569" text-anchor="middle">' +
      letter + '</text></svg>';
    try {
      return 'data:image/svg+xml;base64,' +
        (typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64'));
    } catch (e) {
      return '';
    }
  }
  // Seed photoUrl/cert urls may point to the live server (e.g. /uploads/...).
  // Replace with an inline placeholder so the standalone stays self-contained.
  function sanitizeUploadUrls() {
    (db.users || []).forEach(function (u) {
      if (u.photoUrl && String(u.photoUrl).indexOf('/uploads/') === 0) {
        u.photoUrl = neutralAvatarUri(u.name);
      }
      (u.certificates || []).forEach(function (c) {
        if (c.url && String(c.url).indexOf('/uploads/') === 0) c.url = '';
      });
    });
  }
  sanitizeUploadUrls();

  // ---------- auth ----------
  function userTok(id) { return 'np_u.' + id; }
  function adminTok(id) { return 'np_a.' + id; }
  function userFromHeader(header) {
    if (!header) return null;
    var m = /^Bearer\s+(np_u\.)(.+)$/.exec(header);
    if (!m) return null;
    var u = db.users.find(function (x) { return String(x.id) === m[2]; });
    return u && u.status !== 'takedown' ? u : (u || null);
  }
  function adminFromHeader(header) {
    if (!header) return null;
    var m = /^Bearer\s+(np_a\.)(.+)$/.exec(header);
    if (!m) return null;
    return db.admins.find(function (a) { return String(a.id) === m[2]; }) || null;
  }
  function requireAuth(header) {
    var u = userFromHeader(header);
    if (!u) throw err(401, 'Autentikasi diperlukan.');
    return u;
  }
  function requireAdmin(header, roles) {
    var a = adminFromHeader(header);
    if (!a) throw err(401, 'Autentikasi admin diperlukan.');
    if (roles && roles.length && roles.indexOf(a.role) === -1 && a.role !== 'system') {
      throw err(403, 'Anda tidak punya hak akses untuk aksi ini.');
    }
    return a;
  }

  // ---------- tutors helpers (mirror server/routes/tutors.js) ----------
  function isWhatsappValid(number) {
    var digits = String(number || '').replace(/[^0-9]/g, '');
    var normalized = digits.indexOf('62') === 0 ? digits : digits.indexOf('0') === 0 ? digits : '';
    if (!normalized) return false;
    return /^(08|62)\d{8,}$/.test(normalized);
  }
  function resolveSubjects(rawNames) {
    var ids = [];
    var names = [];
    var known = db.subjects.slice();
    (rawNames || []).forEach(function (raw) {
      var n = String(raw).trim();
      if (!n) return;
      var s = known.find(function (x) { return x.name.toLowerCase() === n.toLowerCase(); });
      if (!s) {
        s = { id: nextId(db.subjects), name: n, isPopular: false };
        db.subjects.push(s);
        known.push(s);
      }
      if (ids.indexOf(s.id) === -1) { ids.push(s.id); names.push(s.name); }
    });
    return { ids: ids, names: names };
  }
  function locationInfo(locationId) {
    var byId = {};
    db.locations.forEach(function (l) { byId[l.id] = l; });
    var chain = [];
    var cur = locationId ? byId[locationId] : null;
    var guard = 0;
    while (cur && guard++ < 6) { chain.unshift(cur); cur = cur.parentId ? byId[cur.parentId] : null; }
    return chain.map(function (l) { return { id: l.id, name: l.name, level: l.level }; });
  }
  function aliasLocation(name) {
    return String(name).toLowerCase().replace(/^(kabupaten|kota)\s+/, '').trim();
  }
  function resolveCustomLocation(text) {
    var lower = String(text || '').toLowerCase();
    if (!lower) return null;
    var order = { provinsi: 0, kabupaten: 1, kecamatan: 2, desa: 3 };
    var matched = db.locations
      .filter(function (l) {
        var alias = aliasLocation(l.name);
        return alias.length >= 3 && lower.indexOf(alias) !== -1;
      })
      .sort(function (a, b) {
        return (order[b.level] - order[a.level]) || (aliasLocation(b.name).length - aliasLocation(a.name).length);
      });
    return matched.length ? matched[0].id : null;
  }
  function tutorStats(tutor) {
    var reviews = db.reviews.filter(function (r) { return r.tutorId === tutor.id; });
    var total = reviews.length;
    var avg = total
      ? Math.round((reviews.reduce(function (s, r) { return s + r.rating; }, 0) / total) * 10) / 10
      : 0;
    return { rating: avg, reviewCount: total };
  }
  var VEHICLES = ['Ada (Sepeda Motor)', 'Ada (Mobil)', 'Ada (Motor & Mobil)', 'Tidak Ada'];
  function normalizeVehicle(value) {
    if (value === undefined || value === null || String(value).trim() === '') return 'Ada (Sepeda Motor)';
    var v = String(value).trim();
    for (var i = 0; i < VEHICLES.length; i++) {
      if (VEHICLES[i].toLowerCase() === v.toLowerCase()) return VEHICLES[i];
    }
    return 'Ada (Sepeda Motor)';
  }
  function toTutorCard(user) {
    var stats = tutorStats(user);
    var bookingCount = db.bookings.filter(function (b) { return b.tutorId === user.id && b.status === 'completed'; }).length;
    var loc = locationInfo(user.locationId);
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
      locationPath: loc.map(function (l) { return l.name; }),
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
  function applyHierarchyFilter(tutors, loc) {
    if (!loc) return tutors;
    var byId = {};
    db.locations.forEach(function (l) { byId[l.id] = l; });
    var target = byId[loc];
    if (!target) return tutors;
    var descendantSet = new Set([target.id]);
    var changed = true;
    while (changed) {
      changed = false;
      db.locations.forEach(function (l) {
        if (l.parentId && descendantSet.has(l.parentId) && !descendantSet.has(l.id)) {
          descendantSet.add(l.id);
          changed = true;
        }
      });
    }
    var chain = [];
    var cur = target;
    var guard = 0;
    while (cur && guard++ < 6) { chain.unshift(String(cur.name).toLowerCase()); cur = cur.parentId ? byId[cur.parentId] : null; }
    return tutors.filter(function (u) {
      return descendantSet.has(u.locationId) ||
        (u.city && chain.some(function (n) { return String(u.city).toLowerCase().indexOf(n) !== -1; }));
    });
  }
  function maskNumber(number) {
    var digits = String(number || '').replace(/[^0-9]/g, '');
    if (digits.length <= 6) return digits.replace(/\d/g, '*');
    return digits.slice(0, 4) + '\u2022\u2022\u2022\u2022' + digits.slice(-2);
  }
  function sendTutorDetail(tutor) {
    var reviews = db.reviews
      .filter(function (r) { return r.tutorId === tutor.id; })
      .map(function (r) {
        var student = db.users.find(function (u) { return u.id === r.studentId; });
        return { id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, studentName: student ? student.name : 'Murid' };
      })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var stats = tutorStats(tutor);
    var completedBookings = db.bookings.filter(function (b) { return b.tutorId === tutor.id && b.status === 'completed'; }).length;
    return Object.assign({}, toTutorCard(tutor), {
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
      certificates: (tutor.certificates || []).map(function (c) { return { id: c.id, name: c.name, url: /\.(png|jpe?g|webp)$/i.test(c.url || '') ? c.url : null, previewUrl: c.previewUrl || null }; }),
      memberSince: tutor.createdAt,
      completedBookings: completedBookings,
      rating: stats.rating,
      reviewCount: stats.reviewCount,
      reviews: reviews
    });
  }

  // ---------- payments helpers (mirror server/routes/payments.js) ----------
  function passPrice() { return (db.config && db.config.studentPassPrice) || STUDENT_PASS_PRICE; }
  function premiumPrice() { return (db.config && db.config.tutorPremiumPrice) || TUTOR_PREMIUM_PRICE; }
  function studentHasPass(studentId) {
    return db.transactions.some(function (t) { return t.type === 'student_pass' && t.studentId === studentId && t.paymentStatus === 'success'; });
  }
  function makeUsername(name) {
    var base = (slugify(name).replace(/[^a-z0-9]/g, '') || 'siswa').slice(0, 12);
    var u = base;
    var i = 1;
    while (db.users.some(function (x) { return x.username && x.username.toLowerCase() === u.toLowerCase(); })) {
      i += 1;
      u = base + i;
    }
    return u;
  }
  function randomPassword() {
    var chars = 'abcdef0123456789';
    var out = '';
    for (var i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
  function findOrCreateStudent(buyer) {
    var cleanEmail = String((buyer && buyer.email) || '').trim().toLowerCase();
    var name = String((buyer && buyer.name) || '').trim();
    var phone = String((buyer && buyer.phone) || '').trim();
    if (!name) return { error: 'Nama lengkap wajib diisi.', status: 400 };
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return { error: 'Format email tidak valid.', status: 400 };
    if (!phone) return { error: 'Nomor WhatsApp wajib diisi.', status: 400 };
var existing = db.users.find(function (u) { return u.email === cleanEmail && u.role === 'student'; });
    if (existing) {
      if (!existing.studentCode) existing.studentCode = makeStudentCode(db);
      return { student: existing, created: false };
    }
    var student = {
      id: nextId(db.users),
      name: name,
      email: cleanEmail,
      passwordHash: null,
      username: null,
      role: 'student',
      phoneOrEmail: cleanEmail,
      whatsapp: phone.replace(/[^0-9+]/g, ''),
      phone: phone.replace(/[^0-9]/g, ''),
      sessionToken: null,
      studentCode: makeStudentCode(),
      autoCreated: true,
      createdAt: nowIso()
    };
    db.users.push(student);
    return { student: student, created: true };
  }
  function provisionStudentCreds(student) {
    var username = makeUsername(student.name);
    var password = randomPassword();
    student.username = username;
    student.passwordHash = 'plain:' + password;
    student.credsSentAt = nowIso();
    if (!db.mailOutbox) db.mailOutbox = [];
    db.mailOutbox.push({
      id: uid('mail'),
      to: student.email,
      subject: 'Akun NARAPRIVAT berhasil dibuat',
          body: 'Halo ' + student.name + ',\n\nAkun murid Anda di NARAPRIVAT sudah dibuat otomatis setelah pembayaran Akses Premium.\n\nUsername: ' + username + '\nPassword: ' + password + '\n\nGunakan kredensial ini untuk login dan melihat riwayat Anda.',
      sentAt: nowIso(),
      read: false
    });
    return { username: username, password: password };
  }
  function createSession(studentId, tutorId, transactionId) {
    var token = uid('sess');
    db.sessions.push({
      token: token,
      studentId: studentId,
      tutorId: tutorId,
      transactionId: transactionId,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    });
    return token;
  }
  function bumpUnlockCount(tutorId) {
    var tutor = db.users.find(function (u) { return u.id === tutorId; });
    if (!tutor) return;
    var today = nowIso().slice(0, 10);
    if (tutor.unlockDate !== today) { tutor.unlockDate = today; tutor.unlockCountToday = 0; }
    tutor.unlockCountToday = (tutor.unlockCountToday || 0) + 1;
    if (tutor.unlockCountToday > 10) {
      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: uid('notif'),
        type: 'tutor_overload',
        target: 'operasional',
        message: 'Profil ' + tutor.name + ' di-unlock ' + tutor.unlockCountToday + ' kali hari ini. Cek status ketersediaan tutor.',
        tutorId: tutor.id,
        read: false,
        createdAt: nowIso()
      });
    }
  }
  function orderIdFor(t) {
    if (t.orderId) return t.orderId;
    var d = new Date(t.createdAt || Date.now());
    var ymd = '' + d.getFullYear() + String(d.getMonth() + 1) + String(d.getDate());
    return 'INV-' + ymd + '-' + String(t.id).padStart(4, '0');
  }
  function hasDistinctDigits(n) {
    var a = Math.floor(n / 100);
    var b = Math.floor(n / 10) % 10;
    var c = n % 10;
    return a !== b && b !== c && a !== c;
  }
  function makeUniqueCode() {
    var used = {};
    (db.transactions || []).forEach(function (t) { if (t.uniqueCode != null) used[t.uniqueCode] = true; });
    var candidates = [];
    for (var n = 701; n <= 999; n += 1) {
      if (hasDistinctDigits(n) && !used[n]) candidates.push(n);
    }
    var pool = candidates.length ? candidates : null;
    if (!pool) { pool = []; for (var m = 701; m <= 999; m += 1) pool.push(m); }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function reserveUniqueCode(requested) {
    var n = Number(requested);
    var taken = (db.transactions || []).some(function (t) { return t.uniqueCode === n; });
    if (Number.isInteger(n) && n >= 701 && n <= 999 && hasDistinctDigits(n) && !taken) return n;
    return makeUniqueCode();
  }
  function sanitizeTransaction(t) {
    return {
      id: t.id, orderId: orderIdFor(t), type: t.type, studentId: t.studentId, tutorId: t.tutorId, amount: t.amount,
      uniqueCode: t.uniqueCode != null ? t.uniqueCode : null,
      totalAmount: (t.amount || 0) + (t.uniqueCode || 0),
      couponCode: t.couponCode, affiliateId: t.affiliateId, paymentStatus: t.paymentStatus,
      paymentMethod: t.paymentMethod || null,
      gatewayRef: t.gatewayRef, returnUrl: t.returnUrl, buyerName: t.buyerName,
      buyerEmail: t.buyerEmail, buyerPhone: t.buyerPhone, autoUsername: t.autoUsername,
      createdAt: t.createdAt, paidAt: t.paidAt
    };
  }
  function settleTransaction(id, status, method) {
    var t = db.transactions.find(function (x) { return x.id === id; });
    if (!t) return null;
    if (t.paymentStatus !== 'pending') return sanitizeTransaction(t);
    t.paymentStatus = status;
    if (method) t.paymentMethod = String(method);
    t.gatewayRef = 'MOCK-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    var creds = null;
    if (status === 'success') {
      t.paidAt = nowIso();
      if (t.type === 'student_pass') {
        bumpUnlockCount(t.tutorId);
        var student = db.users.find(function (u) { return u.id === t.studentId; });
        if (student && !student.passwordHash) {
          creds = provisionStudentCreds(student);
          t.autoUsername = creds.username;
          t.autoPassword = creds.password;
        }
      }
      if (t.type === 'tutor_premium') {
        var tutor = db.users.find(function (u) { return u.id === t.tutorId; });
        if (tutor) {
          tutor.isPremium = true;
          tutor.premiumExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
        }
      }
    }
    save();
    var safe = sanitizeTransaction(t);
    if (creds) safe.autoCredentials = creds;
    return safe;
  }

  // ---------- uploads ----------
  var uploads = {};
  function handleUpload(body) {
    var filename = String(body.filename || '');
    var mimeType = String(body.mimeType || '');
    var data = String(body.data || '');
    var ALLOWED = { 'image/jpeg': true, 'image/png': true, 'image/webp': true, 'application/pdf': true };
    if (!filename || !data) throw err(400, 'File wajib diisi.');
    if (!ALLOWED[mimeType]) throw err(415, 'Tipe file tidak diizinkan. Gunakan JPG/PNG/WebP atau PDF.');
    var raw = '';
    try { raw = data.indexOf('base64,') !== -1 ? data.split('base64,')[1] : data; } catch (e) { raw = data; }
    var size;
    try { size = Math.floor((raw.length * 3) / 4) - (raw.indexOf('==') !== -1 ? 2 : raw.indexOf('=') !== -1 ? 1 : 0); }
    catch (e) { size = 0; }
    var maxSize = mimeType === 'application/pdf' ? 3 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!size || size > maxSize) throw err(413, 'Ukuran file terlalu besar atau kosong.');
    var id = uid('f');
    var url = 'data:' + mimeType + ';base64,' + raw;
    uploads[id] = { url: url, size: size, mimeType: mimeType, name: filename };
    var payload = { url: url, size: size, mimeType: mimeType };
    if (mimeType !== 'application/pdf') payload.previewUrl = url;
    return payload;
  }

  // ---------- route dispatcher ----------
  function route(path, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var pathname = path;
    var qs = '';
    var qi = path.indexOf('?');
    if (qi !== -1) { pathname = path.slice(0, qi); qs = path.slice(qi + 1); }
    var q = parseQuery(qs);
    var body = parseBody(options.body);
    var header = (options.headers && options.headers.Authorization) || '';
    var segs = pathname.split('/').filter(Boolean);
    var A = function (i) { return segs[i]; };

    // ----- auth -----
    if (A(0) === 'auth') {
      if (A(1) === 'login' && method === 'POST') {
        var email = String(body.email || '').trim().toLowerCase();
        var pwd = String(body.password || '');
        if (!email || !pwd) throw err(400, 'Email dan password wajib diisi.');
        var admin = db.admins.find(function (a) { return a.email === email; });
        if (admin && admin.passwordHash) {
          if (!okPassword(admin.passwordHash, pwd)) throw err(401, 'Email/username atau password salah.');
          return { adminToken: adminTok(admin.id), admin: publicUser(admin) };
        }
        var wantedRole = body.role === 'tutor' ? 'tutor' : body.role === 'student' ? 'student' : null;
        var matches = db.users.filter(function (u) { return u.email === email || (u.username && u.username.toLowerCase() === email); });
        if (!matches.length) throw err(401, 'Email/username atau password salah.');
        var user = wantedRole ? matches.filter(function (u) { return u.role === wantedRole; })[0] : matches[0];
        if (!user || !user.passwordHash) {
          if (wantedRole && matches.length) {
            var otherRole = matches[0].role === 'student' ? 'Murid' : 'Tutor';
            throw err(401, 'Email ini terdaftar sebagai ' + otherRole + '. Pilih tab "' + otherRole + '" di halaman Masuk.');
          }
          throw err(401, 'Email/username atau password salah.');
        }
        if (!okPassword(user.passwordHash, pwd)) throw err(401, 'Email/username atau password salah.');
        var payload = publicUser(user);
        if (payload.role === 'student') payload.studentPass = studentPass(user.id);
        return { token: userTok(user.id), user: payload };
      }
      if (A(1) === 'register' && method === 'POST') {
        if (!body.name || !body.email || !body.password) throw err(400, 'Nama, email, dan password wajib diisi.');
        var cleanRole = body.role === 'tutor' ? 'tutor' : 'student';
        var cleanEmail = String(body.email).trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw err(400, 'Format email tidak valid.');
        if (String(body.password).length < 6) throw err(400, 'Password minimal 6 karakter.');
        if (db.users.some(function (u) { return u.email === cleanEmail && u.role === cleanRole; })) throw err(409, 'Email sudah terdaftar. Silakan login.');
        var newUser = {
          id: nextId(db.users),
          name: String(body.name).trim(),
          email: cleanEmail,
          passwordHash: 'plain:' + String(body.password),
          role: cleanRole,
          createdAt: nowIso()
        };
        if (cleanRole === 'student') {
          newUser.phoneOrEmail = cleanEmail;
          newUser.sessionToken = null;
          newUser.studentCode = makeStudentCode();
          var cleanPhone = String(body.phone || '').replace(/[^0-9]/g, '');
          if (cleanPhone) newUser.phone = cleanPhone;
        }
        if (cleanRole === 'tutor') {
          newUser.headline = ''; newUser.bio = ''; newUser.subjects = []; newUser.subjectIds = [];
          newUser.city = ''; newUser.price = 0; newUser.online = true; newUser.languages = ['Indonesia'];
          newUser.experienceYears = 0; newUser.verified = false; newUser.availability = [];
          newUser.whatsapp = String(body.whatsapp || ''); newUser.gender = body.gender || '';
          newUser.educationHistory = Array.isArray(body.educationHistory) ? body.educationHistory : [];
          newUser.certificates = []; newUser.availabilityStatus = 'available'; newUser.isPremium = false;
          newUser.premiumExpiresAt = null; newUser.status = 'active';
          newUser.slug = slugify(newUser.name + ' ' + Date.now()); newUser.tutorCode = makeTutorCode(); newUser.unlockCountToday = 0;
        }
        db.users.push(newUser);
        save();
        var regPayload = publicUser(newUser);
        if (cleanRole === 'student') regPayload.studentPass = studentPass(newUser.id);
        return { token: userTok(newUser.id), user: regPayload };
      }
      if (A(1) === 'forgot-password' && method === 'POST') {
        var fpEmail = String(body.email || '').trim().toLowerCase();
        if (!fpEmail) throw err(400, 'Email wajib diisi.');
        var fpUser = db.users.find(function (u) { return u.email === fpEmail || (u.username && u.username.toLowerCase() === fpEmail); });
        if (!fpUser) return { message: 'Jika email terdaftar, instruksi reset password terkirim ke email Anda.' };
        var fpToken = uid('pwreset');
        if (!db.passwordResets) db.passwordResets = [];
        db.passwordResets = db.passwordResets.filter(function (r) { return r.userId !== fpUser.id; });
        db.passwordResets.push({
          id: fpToken,
          userId: fpUser.id,
          createdAt: nowIso(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });
        if (!db.mailOutbox) db.mailOutbox = [];
        db.mailOutbox.push({
          id: uid('mail'),
          to: fpUser.email,
          subject: 'Reset password NARAPRIVAT',
          body: 'Halo ' + fpUser.name + ',\n\nKode reset Anda (berlaku 30 menit): ' + fpToken,
          sentAt: nowIso(),
          read: false
        });
        save();
        return { message: 'Instruksi reset password terkirim ke email Anda.', resetToken: fpToken, expiresInMinutes: 30 };
      }
      if (A(1) === 'reset-password' && method === 'POST') {
        var rpToken = String(body.token || '').trim();
        var rpPwd = String(body.password || '');
        if (!rpToken) throw err(400, 'Kode reset wajib diisi.');
        if (rpPwd.length < 6) throw err(400, 'Password baru minimal 6 karakter.');
        var rpRec = (db.passwordResets || []).find(function (r) { return r.id === rpToken; });
        if (!rpRec) throw err(400, 'Kode reset tidak valid.');
        if (new Date(rpRec.expiresAt).getTime() < Date.now()) {
          db.passwordResets = db.passwordResets.filter(function (r) { return r.id !== rpToken; });
          save();
          throw err(410, 'Kode reset sudah kedaluwarsa. Silakan minta ulang.');
        }
        var rpUser = db.users.find(function (u) { return u.id === rpRec.userId; });
        if (!rpUser) throw err(400, 'Akun tidak ditemukan.');
        rpUser.passwordHash = 'plain:' + rpPwd;
        db.passwordResets = db.passwordResets.filter(function (r) { return r.id !== rpToken; });
        save();
        return { message: 'Password berhasil diperbarui. Silakan login.' };
      }
    }

    if (A(0) === 'me' && method === 'GET') {
      var mePayload = publicUser(requireAuth(header));
      if (mePayload && mePayload.role === 'student') {
        mePayload.studentPass = studentPass(mePayload.id);
      }
      return mePayload;
    }

    // ----- favorites (mirror server/routes/favorites.js) -----
    if (A(0) === 'favorites') {
      var favUser = requireAuth(header);
      if (favUser.role !== 'student') throw err(403, 'Fitur favorit hanya untuk murid.');
      if (!Array.isArray(favUser.favorites)) favUser.favorites = [];
      if (segs.length === 1 && method === 'GET') {
        return favUser.favorites
          .map(function (id) { return db.users.filter(function (u) { return u.id === id && u.role === 'tutor' && u.status !== 'takedown'; })[0]; })
          .filter(Boolean)
          .map(toTutorCard);
      }
      if (segs.length === 2 && method === 'POST') {
        var favTutor = db.users.filter(function (u) { return u.id === A(1) && u.role === 'tutor'; })[0];
        if (!favTutor) throw err(404, 'Tutor tidak ditemukan.');
        if (favUser.favorites.indexOf(favTutor.id) === -1) favUser.favorites.push(favTutor.id);
        save();
        return { ok: true, favorites: favUser.favorites };
      }
      if (segs.length === 2 && method === 'DELETE') {
        favUser.favorites = favUser.favorites.filter(function (id) { return id !== A(1); });
        save();
        return { ok: true, favorites: favUser.favorites };
      }
    }

    // ----- support (hubungi CS, round-robin) -----
    if (A(0) === 'support') {
      if (A(1) === 'cs' && method === 'GET') {
        var csAgents = db.admins.filter(function (a) { return a.role === 'cs' && String(a.whatsapp || '').replace(/\D/g, '').length >= 8; });
        if (!csAgents.length) return { available: false, cs: null };
        if (!db.supportRR) db.supportRR = 0;
        var cs = csAgents[Number(db.supportRR) % csAgents.length];
        db.supportRR = (Number(db.supportRR) + 1) % csAgents.length;
        save();
        return {
          available: true,
          cs: {
            id: cs.id, name: cs.name, photoUrl: cs.photoUrl || null,
            whatsapp: String(cs.whatsapp || ''),
            greeting: cs.csGreeting || 'Halo! Ada yang bisa saya bantu?'
          }
        };
      }
      if (A(1) === 'tickets' && method === 'POST') {
        var tName = String(body.name || '').trim();
        var tMsg = String(body.message || '').trim();
        if (!tName || !tMsg) throw err(400, 'Nama dan pesan bantuan wajib diisi.');
        if (!db.supportTickets) db.supportTickets = [];
        var csAg2 = db.admins.filter(function (a) { return a.role === 'cs' && String(a.whatsapp || '').replace(/\D/g, '').length >= 8; });
        var cs2 = null;
        if (csAg2.length) {
          if (!db.supportRR) db.supportRR = 0;
          cs2 = csAg2[Number(db.supportRR) % csAg2.length];
          db.supportRR = (Number(db.supportRR) + 1) % csAg2.length;
        }
        var ticket = {
          id: uid('ticket'),
          name: tName,
          email: String(body.email || '').trim() || null,
          whatsapp: String(body.whatsapp || '').trim() || null,
          subject: String(body.subject || '').trim() || 'Bantuan umum',
          message: tMsg,
          status: 'open',
          assignedToId: cs2 ? cs2.id : null,
          assignedToName: cs2 ? cs2.name : null,
          createdAt: nowIso()
        };
        db.supportTickets.push(ticket);
        save();
        return { id: ticket.id, status: ticket.status, assignedToName: ticket.assignedToName };
      }
    }

    // ----- admin -----
    if (A(0) === 'admin') {
      if (A(1) === 'login' && method === 'POST') {
        var aEmail = String(body.email || '').trim().toLowerCase();
        var aPwd = String(body.password || '');
        if (!aEmail || !aPwd) throw err(400, 'Email dan password wajib diisi.');
        var admin = db.admins.find(function (a) { return a.email === aEmail; });
        if (!admin || !okPassword(admin.passwordHash, aPwd)) throw err(401, 'Email atau password salah.');
        return { token: adminTok(admin.id), admin: publicUser(admin) };
      }
      if (A(1) === 'me' && method === 'GET') {
        return publicUser(requireAdmin(header, []));
      }
      if (A(1) === 'overview' && method === 'GET') {
        requireAdmin(header, ['keuangan', 'analytics', 'system']);
        var today = nowIso().slice(0, 10);
        var tx = db.transactions.filter(function (t) { return t.type === 'student_pass'; });
        var success = tx.filter(function (t) { return t.paymentStatus === 'success'; });
        var todaySuccess = success.filter(function (t) { return (t.paidAt || '').slice(0, 10) === today; });
        var revenue = success.reduce(function (s, t) { return s + t.amount; }, 0);
        var todayRevenue = todaySuccess.reduce(function (s, t) { return s + t.amount; }, 0);
        var affiliateCommissions = success
          .filter(function (t) { return t.affiliateId; })
          .map(function (t) {
            var aff = db.affiliates.find(function (a) { return a.id === t.affiliateId; });
            return { amount: t.amount, pct: aff ? aff.commissionPct : 0 };
          });
        var commissionTotal = affiliateCommissions.reduce(function (s, c) { return s + (c.amount * c.pct) / 100; }, 0);
        return {
          students: db.users.filter(function (u) { return u.role === 'student'; }).length,
          tutors: db.users.filter(function (u) { return u.role === 'tutor' && u.status !== 'takedown'; }).length,
          passSold: success.length,
          revenue: revenue,
          todaySold: todaySuccess.length,
          todayRevenue: todayRevenue,
          commissionTotal: commissionTotal,
          affiliateSales: affiliateCommissions.length,
          totalTransactions: tx.length
        };
      }
      if (A(1) === 'transactions' && method === 'GET') {
        requireAdmin(header, ['cs', 'keuangan', 'system']);
        var items = db.transactions.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        if (q.status) items = items.filter(function (t) { return t.paymentStatus === q.status; });
        if (q.type) items = items.filter(function (t) { return t.type === q.type; });
        return items.map(function (t) {
          var student = t.studentId ? db.users.find(function (u) { return u.id === t.studentId; }) : null;
          var tutor = db.users.find(function (u) { return u.id === t.tutorId; });
          var aff = t.affiliateId ? db.affiliates.find(function (a) { return a.id === t.affiliateId; }) : null;
          return {
            id: t.id, type: t.type, amount: t.amount, paymentStatus: t.paymentStatus,
            gatewayRef: t.gatewayRef, createdAt: t.createdAt, paidAt: t.paidAt,
            couponCode: t.couponCode, studentName: student ? student.name : '-',
            tutorName: tutor ? tutor.name : '-', affiliateName: aff ? aff.name : null
          };
        });
      }
      if (A(1) === 'notifications' && method === 'GET') {
        requireAdmin(header, ['operasional', 'system']);
        return (db.notifications || []).slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      }
      if (A(1) === 'notifications' && A(2) && A(3) === 'read' && method === 'PATCH') {
        requireAdmin(header, ['operasional', 'system']);
        var n = (db.notifications || []).find(function (x) { return x.id === A(2); });
        if (!n) throw err(404, 'Notifikasi tidak ditemukan.');
        n.read = true;
        save();
        return { ok: true };
      }
      if (A(1) === 'tutors' && method === 'GET') {
        requireAdmin(header, ['operasional', 'system']);
        return db.users
          .filter(function (u) { return u.role === 'tutor'; })
          .map(function (u) {
            return {
              id: u.id, name: u.name, email: u.email, status: u.status, verified: u.verified,
              whatsapp: u.whatsapp, subjects: u.subjects, locationId: u.locationId,
              createdAt: u.createdAt, unlockCountToday: u.unlockCountToday || 0,
              showRating: u.hideRating !== true,
              hasCertificate: (u.certificates || []).some(function (c) { return c.verified; })
            };
          })
          .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      }
      if (A(1) === 'tutors' && A(2) === 'rating' && A(3) === 'all' && method === 'PATCH') {
        requireAdmin(header, ['operasional', 'system']);
        if (typeof body.showRating !== 'boolean') throw err(400, 'showRating harus boolean.');
        var bulkCount = 0;
        db.users.forEach(function (u) {
          if (u.role !== 'tutor') return;
          if (body.showRating) delete u.hideRating; else u.hideRating = true;
          u.updatedAt = nowIso();
          bulkCount++;
        });
        save();
        return { ok: true, showRating: body.showRating, count: bulkCount };
      }
      if (A(1) === 'tutors' && A(2) && A(3) === 'rating' && method === 'PATCH') {
        requireAdmin(header, ['operasional', 'system']);
        if (typeof body.showRating !== 'boolean') throw err(400, 'showRating harus boolean.');
        var rt = db.users.find(function (u) { return u.id === A(2) && u.role === 'tutor'; });
        if (!rt) throw err(404, 'Tutor tidak ditemukan.');
        if (body.showRating) delete rt.hideRating; else rt.hideRating = true;
        rt.updatedAt = nowIso();
        save();
        return { ok: true, showRating: body.showRating };
      }
      if (A(1) === 'tutors' && A(2) && A(3) === 'status' && method === 'PATCH') {
        requireAdmin(header, ['operasional', 'system']);
        if (['active', 'takedown'].indexOf(body.status) === -1) throw err(400, 'Status harus active atau takedown.');
        var ut = db.users.find(function (u) { return u.id === A(2) && u.role === 'tutor'; });
        if (!ut) throw err(404, 'Tutor tidak ditemukan.');
        ut.status = body.status;
        ut.updatedAt = nowIso();
        if (body.status === 'takedown') ut.takedownDeletedAt = new Date(Date.now() + 90 * 86400000).toISOString();
        save();
        return { ok: true, status: ut.status };
      }
      if (A(1) === 'search-trends' && method === 'GET') {
        requireAdmin(header, ['analytics', 'system']);
        var days = Math.min(30, Math.max(1, Number(q.days) || 7));
        var since = Date.now() - days * 86400000;
        var logs = db.searchLogs.filter(function (l) { return new Date(l.createdAt).getTime() >= since; });
        var bySubject = {};
        var byLocation = {};
        logs.forEach(function (l) {
          bySubject[l.subject] = (bySubject[l.subject] || 0) + 1;
          if (l.locationName) byLocation[l.locationName] = (byLocation[l.locationName] || 0) + 1;
        });
        var subjectTrends = Object.keys(bySubject).map(function (k) { return { name: k, count: bySubject[k] }; })
          .sort(function (a, b) { return b.count - a.count; });
        var locationTrends = Object.keys(byLocation).map(function (k) { return { name: k, count: byLocation[k] }; })
          .sort(function (a, b) { return b.count - a.count; });
        return { days: days, total: logs.length, subjectTrends: subjectTrends, locationTrends: locationTrends };
      }
      if (A(1) === 'pass-price' && method === 'GET') {
        requireAdmin(header, ['system']);
        return db.config || {};
      }
      if (A(1) === 'pass-price' && method === 'PATCH') {
        requireAdmin(header, ['system']);
        if (!db.config) db.config = {};
        if (body.studentPassPrice !== undefined) {
          var n = Number(body.studentPassPrice);
          if (!Number.isFinite(n) || n <= 0) throw err(400, 'Harga Akses Premium tidak valid.');
          db.config.studentPassPrice = Math.round(n);
        }
        if (body.tutorPremiumPrice !== undefined) {
          var n2 = Number(body.tutorPremiumPrice);
          if (!Number.isFinite(n2) || n2 <= 0) throw err(400, 'Harga Premium tidak valid.');
          db.config.tutorPremiumPrice = Math.round(n2);
        }
        save();
        return db.config;
      }
      if (A(1) === 'settings' && method === 'GET') {
        requireAdmin(header, ['system']);
        return db.config || {};
      }
      if (A(1) === 'settings' && method === 'PATCH') {
        requireAdmin(header, ['system']);
        if (!db.config) db.config = {};
        if (typeof body.showRating === 'boolean') db.config.showRating = body.showRating;
        save();
        return db.config;
      }
      if (A(1) === 'tickets' && method === 'GET') {
        requireAdmin(header, ['cs', 'operasional', 'system']);
        return (db.supportTickets || []).slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      }
      if (A(1) === 'tickets' && A(2) && A(3) === 'status' && method === 'PATCH') {
        requireAdmin(header, ['cs', 'operasional', 'system']);
        if (['open', 'done'].indexOf(body.status) === -1) throw err(400, 'Status harus open atau done.');
        var tk = (db.supportTickets || []).find(function (x) { return x.id === A(2); });
        if (!tk) throw err(404, 'Tiket tidak ditemukan.');
        tk.status = body.status;
        tk.handledAt = body.status === 'done' ? nowIso() : tk.handledAt;
        save();
        return { ok: true, status: tk.status };
      }
      if (A(1) === 'affiliates' && method === 'GET') {
        requireAdmin(header, ['keuangan', 'system']);
        return db.affiliates.map(function (a) { return clone(a); });
      }
    }

    // ----- payments -----
    if (A(0) === 'payments') {
      if (A(1) === 'price' && method === 'GET') {
        return { studentPassPrice: passPrice(), tutorPremiumPrice: premiumPrice(), couponDiscount: COUPON_DISCOUNT };
      }
      if (A(1) === 'mine' && method === 'GET') {
        var mineUser = requireAuth(header);
        return db.transactions
          .filter(function (t) {
            if (mineUser.role === 'student') return t.type === 'student_pass' && t.studentId === mineUser.id;
            if (mineUser.role === 'tutor') return t.type === 'tutor_premium' && t.tutorId === mineUser.id;
            return false;
          })
          .sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); })
          .map(sanitizeTransaction);
      }
      if (A(1) === 'access' && method === 'GET') {
        var accUser = requireAuth(header);
        if (accUser.role !== 'student') throw err(403, 'Hanya untuk akun murid.');
        var accTutor = db.users.find(function (u) {
          return u.role === 'tutor' && u.status !== 'takedown' && (u.id === q.tutorId || u.slug === q.tutorId);
        });
        if (!accTutor) throw err(404, 'Tutor tidak ditemukan.');
        var hasPass = studentHasPass(accUser.id);
        var successTx = db.transactions.find(function (t) {
          return t.type === 'student_pass' && t.studentId === accUser.id && t.paymentStatus === 'success';
        });
        return {
          hasAccess: hasPass,
          passPrice: passPrice(),
          tutor: toTutorCard(accTutor),
          lastPass: successTx ? sanitizeTransaction(successTx) : null
        };
      }
      if (A(1) === 'student-pass' && method === 'POST') {
        var spTutorId = String(body.tutorId || '');
        var spTutor = db.users.find(function (u) { return u.id === spTutorId && u.role === 'tutor'; });
        if (!spTutor) throw err(404, 'Tutor tidak ditemukan.');
        if (spTutor.availabilityStatus === 'full') throw err(423, 'Tutor sedang penuh (Full). Silakan cari tutor lain.');
        var buyerResult = findOrCreateStudent(body.buyer || {});
        if (buyerResult.error) throw err(buyerResult.status, buyerResult.error);
        var student = buyerResult.student;
        if (studentHasPass(student.id)) {
          return { alreadyHasAccess: true, tutorSlug: spTutor.slug };
        }
        var affiliateId = null;
        var appliedCoupon = null;
        if (body.couponCode) {
          var aff = db.affiliates.find(function (a) {
            return a.couponCode.toLowerCase() === String(body.couponCode).trim().toLowerCase();
          });
          if (aff) { affiliateId = aff.id; appliedCoupon = aff.couponCode; }
        }
        var transaction = {
          id: nextId(db.transactions, 'tx'),
          type: 'student_pass',
          studentId: student.id,
          tutorId: spTutor.id,
          amount: appliedCoupon ? Math.max(0, passPrice() - COUPON_DISCOUNT) : passPrice(),
          uniqueCode: reserveUniqueCode(body.uniqueCode),
          couponCode: appliedCoupon,
          affiliateId: affiliateId,
          paymentStatus: 'pending',
          gatewayRef: null,
          returnUrl: '/tutor/' + spTutor.slug,
          buyerName: student.name,
          buyerEmail: student.email,
          buyerPhone: student.whatsapp || '',
          createdAt: nowIso(),
          paidAt: null
        };
        db.transactions.push(transaction);
        var sessionToken = createSession(student.id, spTutor.id, transaction.id);
        save();
        return {
          transaction: sanitizeTransaction(transaction),
          sessionToken: sessionToken,
          paymentUrl: '/payments/mock/' + transaction.id,
          couponValid: Boolean(appliedCoupon),
          couponDiscount: appliedCoupon ? COUPON_DISCOUNT : 0,
          originalAmount: passPrice(),
          couponError: body.couponCode && !appliedCoupon ? 'Kode kupon tidak valid. Transaksi tetap bisa dilanjutkan.' : null
        };
      }
      if (A(1) === 'premium' && method === 'POST') {
        var pUser = requireAuth(header);
        if (pUser.role !== 'tutor') throw err(403, 'Hanya tutor yang bisa membeli paket Premium.');
        var pTutor = db.users.find(function (u) { return u.id === pUser.id; });
        var pAffiliateId = null;
        if (body.couponCode) {
          var pAff = db.affiliates.find(function (a) {
            return a.couponCode.toLowerCase() === String(body.couponCode).trim().toLowerCase();
          });
          if (pAff) pAffiliateId = pAff.id;
        }
        var pTransaction = {
          id: nextId(db.transactions, 'tx'),
          type: 'tutor_premium',
          studentId: null,
          tutorId: pTutor.id,
          amount: premiumPrice(),
          couponCode: pAffiliateId ? String(body.couponCode) : null,
          affiliateId: pAffiliateId,
          paymentStatus: 'pending',
          gatewayRef: null,
          returnUrl: '/dashboard?tab=profil',
          createdAt: nowIso(),
          paidAt: null
        };
        db.transactions.push(pTransaction);
        save();
        return { transaction: sanitizeTransaction(pTransaction), paymentUrl: '/payments/mock/' + pTransaction.id };
      }
      if (A(1) === 'transaction' && A(2) && method === 'GET') {
        var tFound = db.transactions.find(function (x) { return x.id === A(2); });
        if (!tFound) throw err(404, 'Transaksi tidak ditemukan.');
        return sanitizeTransaction(tFound);
      }
      if (A(1) === 'session' && A(2) && method === 'GET') {
        var session = db.sessions.find(function (s) { return s.token === A(2); });
        if (!session) throw err(404, 'Sesi tidak ditemukan.');
        if (new Date(session.expiresAt).getTime() < Date.now()) throw err(410, 'Sesi pembayaran sudah kedaluwarsa (lebih dari 24 jam).');
        var sessTx = db.transactions.find(function (t) { return t.id === session.transactionId; });
        var sessTutor = db.users.find(function (u) { return u.id === session.tutorId; });
        if (sessTx && sessTx.paymentStatus !== 'pending') {
          return { session: session, transaction: sanitizeTransaction(sessTx), tutor: sessTutor ? toTutorCard(sessTutor) : null, resolved: true };
        }
        return {
          session: session,
          transaction: sessTx ? sanitizeTransaction(sessTx) : null,
          tutor: sessTutor ? toTutorCard(sessTutor) : null,
          resolved: false,
          expiresAt: session.expiresAt
        };
      }
      if (A(1) === 'mock' && A(2) && A(3) === 'pay' && method === 'POST') {
        var okT = settleTransaction(A(2), 'success', body && body.method);
        if (!okT) throw err(404, 'Transaksi tidak ditemukan.');
        return { status: 'success', transaction: okT };
      }
      if (A(1) === 'mock' && A(2) && A(3) === 'fail' && method === 'POST') {
        var failT = settleTransaction(A(2), 'failed');
        if (!failT) throw err(404, 'Transaksi tidak ditemukan.');
        return { status: 'failed', transaction: failT };
      }
    }

    // ----- tutors -----
    if (A(0) === 'tutors') {
      if (A(1) === 'subjects' && method === 'GET') return SUBJECTS;
      if (A(1) === 'cities') {
        if (method !== 'GET') throw err(404, 'Tidak ditemukan.');
        var counts = {};
        db.users.filter(function (u) { return u.role === 'tutor' && u.city; })
          .forEach(function (u) { counts[u.city] = (counts[u.city] || 0) + 1; });
        return Object.keys(counts).map(function (city) { return { city: city, count: counts[city] }; })
          .sort(function (a, b) { return b.count - a.count; });
      }
      if (A(1) === 'me') {
        var meUser = requireAuth(header);
        if (meUser.role !== 'tutor') throw err(403, 'Hanya untuk akun tutor.');
        if (method === 'GET') return publicUser(meUser);
        if (method === 'PATCH') {
          var fresh = db.users.find(function (u) { return u.id === meUser.id; });
          if (!fresh) throw err(404, 'Tutor tidak ditemukan.');
          var premiumActive = Boolean(fresh.isPremium) && Boolean(fresh.premiumExpiresAt) && new Date(fresh.premiumExpiresAt) > new Date();
          if (body.name !== undefined) {
            var newName = String(body.name).trim();
            if (newName && newName !== fresh.name && !premiumActive) throw err(400, 'Ubah nama hanya untuk tutor Premium. Upgrade Premium dulu.');
            if (newName) fresh.name = newName;
          }
          if (body.whatsapp !== undefined) {
            var newWa = String(body.whatsapp).trim();
            if (newWa && newWa !== fresh.whatsapp && !premiumActive) throw err(400, 'Ubah nomor WhatsApp hanya untuk tutor Premium. Upgrade Premium dulu.');
            if (newWa) {
              if (!isWhatsappValid(newWa)) throw err(400, 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx (minimal 10 digit).');
              fresh.whatsapp = newWa;
            }
          }
          var allowed = ['headline', 'bio', 'jenjang', 'subjects', 'subjectIds', 'city', 'price', 'online', 'languages', 'experienceYears', 'vehicle', 'availability', 'contactEmail', 'photoUrl', 'availabilityStatus', 'educationHistory', 'locationId'];
          allowed.forEach(function (key) {
            if (body[key] !== undefined) fresh[key] = body[key];
          });
          if (body.vehicle !== undefined) fresh.vehicle = normalizeVehicle(body.vehicle);
          if (body.customLocation && String(body.customLocation).trim()) {
            var customText = String(body.customLocation).trim();
            fresh.city = customText;
            fresh.locationId = resolveCustomLocation(customText);
          }
          if (body.locationId === null || body.locationId === '') fresh.locationId = null;
          var rawNames = Array.isArray(body.subjects) ? body.subjects : Array.isArray(body.subjectIds) ? body.subjectIds : null;
          if (rawNames !== null) {
            if (!premiumActive && rawNames.length > 1) throw err(400, 'Akun gratis hanya bisa mengajar 1 bidang ajar. Upgrade ke Premium untuk menambah bidang ajar lain.');
            var resolved = resolveSubjects(rawNames);
            fresh.subjectIds = resolved.ids;
            fresh.subjects = resolved.names;
          }
          fresh.updatedAt = nowIso();
          save();
          return publicUser(fresh);
        }
        throw err(404, 'Tidak ditemukan.');
      }
      if (A(1) === 'permalink' && A(2) && method === 'GET') {
        var permaTutor = db.users.find(function (u) { return u.role === 'tutor' && u.slug === A(2) && u.status !== 'takedown'; });
        if (!permaTutor) throw err(404, 'Tutor tidak ditemukan.');
        return sendTutorDetail(permaTutor);
      }
      if (A(1) === 'contacted' && method === 'GET') {
        var ctUser = requireAuth(header);
        if (ctUser.role !== 'student') throw err(403, 'Hanya untuk akun murid.');
        var ctStudent = db.users.find(function (u) { return u.id === ctUser.id; });
        var ctIds = ctStudent && Array.isArray(ctStudent.contactedTutors) ? ctStudent.contactedTutors : [];
        var ctItems = ctIds.map(function (id) {
          return db.users.find(function (u) { return u.id === id && u.role === 'tutor' && u.status !== 'takedown'; });
        }).filter(Boolean).map(function (u) { return toTutorCard(u, db); });
        return { items: ctItems, total: ctItems.length };
      }
      if (segs.length === 1 && method === 'GET') {
        var logQuery = String(q.q || '').trim().toLowerCase();
        var list = db.users.filter(isTutorActive);
        if (logQuery) {
          list = list.filter(function (u) {
            return [u.name, u.headline, u.bio].concat(u.subjects || []).concat([u.city])
              .filter(Boolean)
              .some(function (field) { return String(field).toLowerCase().indexOf(logQuery) !== -1; });
          });
        }
        if (q.subject) {
          list = list.filter(function (u) {
            return (u.subjects || []).some(function (s) { return s.toLowerCase() === String(q.subject).toLowerCase(); });
          });
        }
        if (q.jenjang) {
          var targetJenjang = String(q.jenjang).toLowerCase();
          list = list.filter(function (u) {
            return (u.jenjang || []).some(function (j) { return j.toLowerCase() === targetJenjang; });
          });
        }
        var locParam = q.desa || q.kecamatan || q.kabupaten || q.provinsi || q.locationId;
        if (locParam) list = applyHierarchyFilter(list, locParam);
        var minPrice = q.minPrice === undefined ? '' : String(q.minPrice);
        var maxPrice = q.maxPrice === undefined ? '' : String(q.maxPrice);
        var minRating = q.minRating === undefined ? '' : String(q.minRating);
        if (minPrice !== '') list = list.filter(function (u) { return u.price >= Number(minPrice); });
        if (maxPrice !== '') list = list.filter(function (u) { return u.price <= Number(maxPrice); });
        if (minRating !== '') {
          var minR = Number(minRating);
          list = list.filter(function (u) { return u.hideRating !== true && tutorStats(u).rating >= minR; });
        }
        if (q.online === 'true' || q.online === '1') list = list.filter(function (u) { return u.online; });
        if (q.online === 'false' || q.online === '0') list = list.filter(function (u) { return !u.online; });
        if (q.availability === 'available') list = list.filter(function (u) { return u.availabilityStatus === 'available'; });
        if (q.gender) {
          var gFilter = String(q.gender).toLowerCase();
          list = list.filter(function (u) { return String(u.gender || '').toLowerCase() === gFilter; });
        }
        if (q.vehicle) {
          var vFilter = VEHICLES.filter(function (x) { return x.toLowerCase() === String(q.vehicle).toLowerCase(); })[0];
          if (vFilter) list = list.filter(function (u) { return normalizeVehicle(u.vehicle) === vFilter; });
        }
        if (String(q.sort || '') === 'rating') list = list.filter(function (u) { return u.hideRating !== true; });

        var withStats = list.map(function (u) { return Object.assign({}, toTutorCard(u), { bio: u.bio }); });
        var popularity = function (t) { return t.completedBookings * 10 + t.rating; };
        var sortKey = q.sort || 'recommended';
        if (sortKey === 'rating') withStats.sort(function (a, b) { return (b.rating - a.rating) || (popularity(b) - popularity(a)); });
        else if (sortKey === 'price_asc') withStats.sort(function (a, b) { return a.price - b.price; });
        else if (sortKey === 'price_desc') withStats.sort(function (a, b) { return b.price - a.price; });
        else if (sortKey === 'newest') withStats.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
        else if (sortKey === 'popular') withStats.sort(function (a, b) { return popularity(b) - popularity(a); });
        else withStats.sort(function (a, b) {
          return ((b.isPremium ? 1000 : 0) + popularity(b)) - ((a.isPremium ? 1000 : 0) + popularity(a));
        });

        var pageNum = Math.max(1, Number(q.page) || 1);
        var size = Math.min(30, Math.max(1, Number(q.perPage) || 9));
        var start = (pageNum - 1) * size;
        var items = withStats.slice(start, start + size);
        return {
          items: items,
          total: withStats.length,
          page: pageNum,
          perPage: size,
          totalPages: Math.ceil(withStats.length / size) || 1
        };
      }
      if (segs.length === 1 && method === 'POST') {
        if (!body.name || !body.email || !body.password || !body.gender || !body.whatsapp) {
          throw err(400, 'Lengkapi data wajib: nama, email, password, gender, dan nomor WhatsApp.');
        }
        var tEmail = String(body.email).trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(tEmail)) throw err(400, 'Format email tidak valid.');
        if (!isWhatsappValid(body.whatsapp)) throw err(400, 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx (minimal 10 digit).');
        if (!Array.isArray(body.educationHistory) || body.educationHistory.length < 2) throw err(400, 'Minimal 2 riwayat pendidikan wajib diisi.');
        var rawJenjang = JENJANG.filter(function (j) {
          return String(body.jenjang || '').toLowerCase() === j.toLowerCase() ||
            (Array.isArray(body.jenjang) && body.jenjang.some(function (x) { return String(x).toLowerCase() === j.toLowerCase(); }));
        });
        if (rawJenjang.length === 0) throw err(400, 'Pilih minimal 1 jenjang sekolah yang diajar.');
        var rawSubjects = Array.isArray(body.subjects) ? body.subjects : Array.isArray(body.subjectIds) ? body.subjectIds : [];
        var resolved = resolveSubjects(rawSubjects);
        if (resolved.ids.length === 0) throw err(400, 'Pilih minimal 1 bidang ajar.');
        if (resolved.ids.length > 1) throw err(400, 'Tutor baru hanya bisa mengisi 1 bidang ajar dulu. Upgrade ke Premium untuk menambah bidang ajar lain.');
        if (db.users.some(function (u) { return u.email === tEmail && u.role === 'tutor'; })) throw err(409, 'Email sudah terdaftar sebagai tutor. Silakan login.');
        var finalLocationId = body.locationId;
        var city = '';
        if (body.customLocation && String(body.customLocation).trim()) {
          city = String(body.customLocation).trim();
          finalLocationId = resolveCustomLocation(city);
        } else {
          var loc = db.locations.find(function (l) { return l.id === finalLocationId; });
          if (!loc || loc.level !== 'kecamatan') throw err(400, 'Pilih lokasi mengajar hingga level Kecamatan, atau isi lokasi manual.');
          city = loc.name;
        }
        var baseSlug = slugify((resolved.names[0] || 'tutor') + ' ' + city + ' ' + body.name);
        var slug = baseSlug;
        var n = 2;
        while (db.users.some(function (u) { return u.slug === slug; })) slug = baseSlug + '-' + (n++);
        var tutor = {
          id: nextId(db.users),
          name: String(body.name).trim(),
          email: tEmail,
          passwordHash: 'plain:' + String(body.password),
          role: 'tutor',
          gender: body.gender,
          headline: body.headline || '',
          bio: body.bio || '',
          subjects: resolved.names,
          subjectIds: resolved.ids,
          jenjang: rawJenjang,
          city: city,
          locationId: finalLocationId,
          price: 0,
          online: true,
          languages: ['Indonesia'],
          experienceYears: 0,
          vehicle: normalizeVehicle(body.vehicle),
          verified: false,
          availability: [],
          whatsapp: String(body.whatsapp).trim(),
          educationHistory: body.educationHistory.slice(0, 5),
          certificates: (body.certificateUrls || []).map(function (c, i) {
            return {
              id: uid('cert'),
              name: typeof c === 'string' ? c : c.name,
              url: typeof c === 'string' ? c : c.url,
              previewUrl: typeof c === 'object' ? c.previewUrl || null : null,
              size: typeof c === 'object' ? c.size : 0,
              verified: false
            };
          }),
          photoUrl: body.photoUrl || null,
          availabilityStatus: 'available',
          isPremium: false,
          premiumExpiresAt: null,
          status: 'active',
          slug: slug,
          tutorCode: makeTutorCode(),
          unlockCountToday: 0,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        db.users.push(tutor);
        save();
        return {
          token: userTok(tutor.id),
          user: publicUser(tutor),
          message: 'Pendaftaran tutor berhasil. Profil Anda langsung aktif.'
        };
      }
      if (A(1) && A(2) === 'report' && method === 'POST') {
        var repTutor = db.users.find(function (u) { return u.id === A(1) && u.role === 'tutor'; });
        if (!repTutor) throw err(404, 'Tutor tidak ditemukan.');
        if (!db.notifications) db.notifications = [];
        db.notifications.push({
          id: uid('notif'),
          type: 'report_invalid_number',
          target: 'operasional',
          message: 'Nomor WhatsApp ' + repTutor.name + ' dilaporkan tidak aktif.',
          tutorId: repTutor.id,
          note: body.note || '',
          read: false,
          createdAt: nowIso()
        });
        save();
        return { ok: true, message: 'Terima kasih. Laporan Anda akan ditinjau tim kami.' };
      }
      if (A(1) && A(2) === 'unlock' && method === 'POST') {
        var ulUser = requireAuth(header);
        if (ulUser.role !== 'student') throw err(403, 'Hanya murid yang bisa meng-unlock profil tutor.');
        var ulTutor = db.users.find(function (u) { return u.id === A(1) && u.role === 'tutor'; });
        if (!ulTutor) throw err(404, 'Tutor tidak ditemukan.');
        if (ulTutor.availabilityStatus === 'full') throw err(423, 'Tutor sedang penuh (Full). Silakan cari tutor lain.');
        var ulToday = nowIso().slice(0, 10);
        if (ulTutor.unlockDate !== ulToday) { ulTutor.unlockDate = ulToday; ulTutor.unlockCountToday = 0; }
        ulTutor.unlockCountToday = (ulTutor.unlockCountToday || 0) + 1;
        if (ulTutor.unlockCountToday > 10) {
          if (!db.notifications) db.notifications = [];
          db.notifications.push({
            id: uid('notif'),
            type: 'tutor_overload',
            target: 'operasional',
            message: 'Profil ' + ulTutor.name + ' di-unlock ' + ulTutor.unlockCountToday + ' kali hari ini. Cek status ketersediaan tutor.',
            tutorId: ulTutor.id,
            read: false,
            createdAt: nowIso()
          });
        }
        var ulStudent = db.users.find(function (u) { return u.id === ulUser.id; });
        if (ulStudent) {
          if (!Array.isArray(ulStudent.contactedTutors)) ulStudent.contactedTutors = [];
          ulStudent.contactedTutors = [ulTutor.id].concat(ulStudent.contactedTutors.filter(function (id) { return id !== ulTutor.id; }));
        }
        save();
        return { ok: true, unlockCountToday: ulTutor.unlockCountToday };
      }
      if (A(1) && A(2) === undefined && method === 'GET') {
        var detailTutor = db.users.find(function (u) {
          return u.role === 'tutor' && u.status !== 'takedown' && (u.id === A(1) || u.slug === A(1));
        });
        if (!detailTutor) throw err(404, 'Tutor tidak ditemukan.');
        return sendTutorDetail(detailTutor);
      }
    }

    // ----- locations -----
    if (A(0) === 'locations') {
      if (A(1) === 'tree' && method === 'GET') {
        var byParent = {};
        db.locations.forEach(function (l) {
          var key = l.parentId || 'root';
          if (!byParent[key]) byParent[key] = [];
          byParent[key].push(l);
        });
        function build(id) {
          return (byParent[id] || []).map(function (l) {
            return Object.assign({}, l, { children: build(l.id) });
          }).sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
        }
        return build('root');
      }
      if (A(1) === 'path' && A(2) && method === 'GET') {
        var byId = {};
        db.locations.forEach(function (l) { byId[l.id] = l; });
        var chain = [];
        var cur = byId[A(2)];
        var guard = 0;
        while (cur && guard++ < 6) { chain.unshift(cur); cur = cur.parentId ? byId[cur.parentId] : null; }
        return chain.map(function (l) { return { id: l.id, name: l.name, level: l.level }; });
      }
      if (segs.length === 1 && method === 'GET') {
        var level = q.level || '';
        var parentId = q.parentId || '';
        var locItems = db.locations;
        if (level) locItems = locItems.filter(function (l) { return l.level === level; });
        if (parentId) locItems = locItems.filter(function (l) { return l.parentId === parentId; });
        return locItems.map(function (l) {
          return {
            id: l.id, name: l.name, level: l.level, parentId: l.parentId,
            children: db.locations.filter(function (c) { return c.parentId === l.id; }).length
          };
        }).sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
      }
    }

    // ----- subjects -----
    if (A(0) === 'subjects' && segs.length === 1 && method === 'GET') {
      var subItems = db.subjects.slice();
      if (q.popular === 'true' || q.popular === '1') subItems = subItems.filter(function (s) { return s.isPopular; });
      if (q.q) {
        var sq = String(q.q).toLowerCase();
        subItems = subItems.filter(function (s) { return s.name.toLowerCase().indexOf(sq) !== -1; });
      }
      return subItems;
    }

    // ----- search -----
    if (A(0) === 'search' && A(1) === 'logs') {
      if (method === 'GET') {
        var limit = Math.min(30, Math.max(1, Number(q.limit) || 30));
        return db.searchLogs.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, limit)
          .map(function (l) { return { id: l.id, subject: l.subject, locationName: l.locationName, resultCount: l.resultCount, createdAt: l.createdAt }; });
      }
      if (method === 'POST') {
        if (!body.subject) throw err(400, 'Subjek wajib diisi untuk mencatat pencarian.');
        var subjEntry = db.subjects.find(function (s) { return s.name.toLowerCase() === String(body.subject).toLowerCase(); });
        db.searchLogs.push({
          id: nextId(db.searchLogs),
          subject: body.subject,
          subjectId: subjEntry ? subjEntry.id : null,
          locationId: body.locationId || null,
          locationName: body.locationName || '',
          resultCount: Number(body.resultCount) || 0,
          createdAt: nowIso()
        });
        db.searchLogs = db.searchLogs.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 50);
        save();
        return { ok: true };
      }
    }

    // ----- affiliates -----
    if (A(0) === 'affiliates') {
      if (A(1) === 'validate' && method === 'GET') {
        if (!q.code) return { valid: false, message: 'Masukkan kode kupon.' };
        var affV = db.affiliates.find(function (a) { return a.couponCode.toLowerCase() === String(q.code).trim().toLowerCase(); });
        if (!affV) return { valid: false, message: 'Kode kupon tidak valid.' };
        return { valid: true, discount: COUPON_DISCOUNT, affiliate: { id: affV.id, name: affV.name, couponCode: affV.couponCode, commissionPct: affV.commissionPct } };
      }
      if (A(1) === 'lookup' && method === 'GET') {
        if (!q.code) throw err(400, 'Masukkan kode kupon.');
        var affL = db.affiliates.find(function (a) { return a.couponCode.toLowerCase() === String(q.code).trim().toLowerCase(); });
        if (!affL) throw err(404, 'Kode kupon tidak ditemukan.');
        var sales = db.transactions
          .filter(function (t) { return t.affiliateId === affL.id && t.paymentStatus === 'success'; })
          .map(function (t) {
            var tutor = db.users.find(function (u) { return u.id === t.tutorId; });
            return {
              id: t.id, type: t.type, amount: t.amount,
              commission: Math.round((t.amount * affL.commissionPct) / 100),
              tutorName: tutor ? tutor.name : '-',
              createdAt: t.paidAt || t.createdAt
            };
          })
          .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        var totalCommission = sales.reduce(function (s, x) { return s + x.commission; }, 0);
        return {
          affiliate: { id: affL.id, name: affL.name, couponCode: affL.couponCode, commissionPct: affL.commissionPct },
          totalSales: sales.length,
          totalCommission: totalCommission,
          sales: sales
        };
      }
    }

    // ----- bookings -----
    if (A(0) === 'bookings') {
      if (A(1) === 'mine' && method === 'GET') {
        var bUser = requireAuth(header);
        var mine = db.bookings.filter(function (b) {
          return bUser.role === 'student' ? b.studentId === bUser.id : b.tutorId === bUser.id;
        });
        return mine.map(function (b) { return attachNames(b); })
          .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      }
      if (A(1) === 'stats' && method === 'GET') {
        var sUser = requireAuth(header);
        var mineStats = db.bookings.filter(function (b) {
          return sUser.role === 'student' ? b.studentId === sUser.id : b.tutorId === sUser.id;
        });
        var countBy = function (status) { return mineStats.filter(function (b) { return b.status === status; }).length; };
        return {
          total: mineStats.length, pending: countBy('pending'), accepted: countBy('accepted'),
          completed: countBy('completed'), cancelled: countBy('cancelled'), rejected: countBy('rejected')
        };
      }
      if (segs.length === 1 && method === 'POST') {
        var nbUser = requireAuth(header);
        if (nbUser.role !== 'student') throw err(403, 'Hanya murid yang bisa membuat pemesanan.');
        if (!body.tutorId || !body.subject || !body.date || !body.startTime || !body.endTime) {
          throw err(400, 'Data pemesanan tidak lengkap.');
        }
        var nbTutor = db.users.find(function (u) { return u.id === String(body.tutorId) && u.role === 'tutor'; });
        if (!nbTutor) throw err(404, 'Tutor tidak ditemukan.');
        var bPrice = Number(nbTutor.price) || 0;
        var booking = {
          id: nextId(db.bookings),
          tutorId: nbTutor.id,
          studentId: nbUser.id,
          subject: body.subject,
          date: body.date,
          startTime: body.startTime,
          endTime: body.endTime,
          mode: body.mode === 'offline' ? 'offline' : 'online',
          price: bPrice,
          status: 'pending',
          note: body.note || '',
          createdAt: nowIso()
        };
        db.bookings.push(booking);
        save();
        return attachNames(booking);
      }
      if (A(1) && method === 'PATCH') {
        var pbUser = requireAuth(header);
        var pBooking = db.bookings.find(function (b) { return b.id === A(1); });
        if (!pBooking) throw err(404, 'Pemesanan tidak ditemukan.');
        var isTutor = pbUser.id === pBooking.tutorId;
        var isStudent = pbUser.id === pBooking.studentId;
        if (!isTutor && !isStudent) throw err(403, 'Anda tidak berhak mengubah pemesanan ini.');
        var transitions = {
          pending: ['accepted', 'rejected', 'cancelled'],
          accepted: ['completed', 'cancelled'],
          completed: [], cancelled: [], rejected: []
        };
        if (body.status && transitions[pBooking.status].indexOf(body.status) === -1) {
          throw err(400, 'Status tidak dapat berubah dari "' + pBooking.status + '" menjadi "' + body.status + '".');
        }
        if (body.status && (body.status === 'accepted' || body.status === 'rejected' || body.status === 'completed')) {
          if (!isTutor) throw err(403, 'Hanya tutor yang dapat melakukan aksi ini.');
        }
        if (body.status === 'cancelled' && !isStudent) throw err(403, 'Hanya murid yang dapat membatalkan pemesanan.');
        if (body.status) pBooking.status = body.status;
        if (body.note !== undefined) pBooking.note = body.note;
        save();
        return attachNames(pBooking);
      }
    }

    // ----- reviews -----
    if (A(0) === 'reviews' && segs.length === 1 && method === 'POST') {
      var rUser = requireAuth(header);
      if (rUser.role !== 'student') throw err(403, 'Hanya murid yang bisa memberikan ulasan.');
      if (!body.rating || body.rating < 1 || body.rating > 5) throw err(400, 'Rating harus antara 1 sampai 5.');
      if (!body.bookingId && !body.tutorCode) throw err(400, 'ID Tutor atau pemesanan wajib diisi.');
      var rTutorId = null;
      var rBooking = null;
      if (body.tutorCode) {
        var byCode = db.users.find(function (u) { return u.role === 'tutor' && u.tutorCode && String(u.tutorCode).toUpperCase() === String(body.tutorCode).trim().toUpperCase(); });
        if (!byCode || byCode.status === 'takedown') throw err(404, 'ID Tutor tidak ditemukan. Periksa kembali kode yang diberikan tutor.');
        rTutorId = byCode.id;
      } else {
        rBooking = db.bookings.find(function (b) { return b.id === String(body.bookingId); });
        if (!rBooking) throw err(404, 'Pemesanan tidak ditemukan.');
        if (rBooking.studentId !== rUser.id) throw err(403, 'Anda hanya bisa menilai pemesanan Anda sendiri.');
        if (rBooking.status !== 'completed') throw err(400, 'Ulasan hanya bisa diberikan setelah kelas selesai.');
        rTutorId = rBooking.tutorId;
      }
      var dup = db.reviews.find(function (r) { return String(r.studentId) === String(rUser.id) && String(r.tutorId) === String(rTutorId); });
      if (dup) {
        var dupTutor = db.users.find(function (u) { return u.id === rTutorId; });
        throw err(409, 'Anda sudah memberikan ulasan untuk ' + (dupTutor ? dupTutor.name : 'tutor ini') + '.');
      }
      var review = {
        id: nextId(db.reviews),
        bookingId: rBooking ? rBooking.id : null,
        tutorId: rTutorId,
        studentId: rUser.id,
        rating: Number(body.rating),
        comment: String(body.comment || '').trim(),
        createdAt: nowIso()
      };
      db.reviews.push(review);
      save();
      return review;
    }
    if (A(0) === 'reviews' && A(1) === 'mine' && method === 'GET') {
      var mUser = requireAuth(header);
      if (mUser.role !== 'student') throw err(403, 'Hanya untuk akun murid.');
      return db.reviews
        .filter(function (r) { return String(r.studentId) === String(mUser.id); })
        .map(function (r) {
          var t = db.users.find(function (u) { return u.id === r.tutorId; });
          return {
            id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt,
            tutorId: r.tutorId, tutorName: t ? t.name : 'Tutor', tutorSlug: t ? t.slug : ''
          };
        })
        .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    }
    if (A(0) === 'reviews' && A(1) === 'tutor' && method === 'GET') {
      var tUser = requireAuth(header);
      if (tUser.role !== 'tutor') throw err(403, 'Hanya untuk akun tutor.');
      return db.reviews
        .filter(function (r) { return String(r.tutorId) === String(tUser.id); })
        .map(function (r) {
          var s = db.users.find(function (u) { return u.id === r.studentId; });
          return { id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, studentId: r.studentId, studentName: s ? s.name : 'Murid' };
        })
        .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    }

    // ----- uploads -----
    if (A(0) === 'uploads' && segs.length === 1 && method === 'POST') {
      return handleUpload(body);
    }

    throw err(404, 'Tidak ditemukan.');
  }

  function attachNames(booking) {
    var tutor = db.users.find(function (u) { return u.id === booking.tutorId; });
    var student = db.users.find(function (u) { return u.id === booking.studentId; });
    return Object.assign({}, booking, {
      tutorName: tutor ? tutor.name : 'Tutor',
      tutorHeadline: tutor ? tutor.headline : '',
      tutorCity: tutor ? tutor.city : '',
      studentName: student ? student.name : 'Murid',
      reviewed: db.reviews.some(function (r) { return r.bookingId === booking.id; })
    });
  }

  function handle(path, options) {
    try {
      return Promise.resolve(route(path, options));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  return { handle: handle };
})();