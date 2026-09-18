import fs from 'node:fs';

function stubLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}
globalThis.localStorage = stubLocalStorage();
globalThis.window = globalThis;

const layer = fs.readFileSync('tools/standalone/offline-layer.js', 'utf8');
const db = JSON.parse(fs.readFileSync('server/data/db.json', 'utf8'));
if (!layer.includes('__EMBED_DB_PAYLOAD__')) throw new Error('marker missing');
const src = layer.split('__EMBED_DB_PAYLOAD__').join(JSON.stringify(db).replace(/</g, '\\u003c'));
if (src.includes('= __EMBED_DB_PAYLOAD__;')) throw new Error('replacement failed');
(0, eval)(src);

const api = globalThis.__NP_OFFLINE__;
let pass = 0;
let fail = 0;
let chain = Promise.resolve();
function eq(name, fn) {
  chain = chain.then(async () => {
    try {
      await fn();
      console.log('PASS', name);
      pass++;
    } catch (e) {
      console.log('FAIL', name, '=>', e && e.message, 'status=' + (e && e.status));
      fail++;
    }
  });
}
async function call(path, opts) {
  const data = await api.handle(path, opts || { method: 'GET' });
  return data;
}

(async () => {
  // subjects
  eq('GET /subjects', async () => {
    const d = await call('/subjects');
    if (!Array.isArray(d) || !d.some((s) => s.name === 'Matematika')) throw new Error('bad subjects');
  });
  eq('GET /subjects?popular=true', async () => {
    const d = await call('/subjects?popular=true');
    if (!d.every((s) => s.isPopular)) throw new Error('popular filter broken');
  });
  // tutor list
  eq('GET /tutors', async () => {
    const d = await call('/tutors?perPage=5');
    if (!d.items || !d.total) throw new Error('list shape');
    if (d.items.length !== Math.min(5, d.total)) throw new Error('pagination');
  });
  eq('GET /tutors?subject=Matematika', async () => {
    const d = await call('/tutors?subject=Matematika');
    if (!d.items.every((t) => t.subjects.some((s) => s.toLowerCase() === 'matematika'))) throw new Error('subject filter');
  });
  eq('GET /tutors?q=Dian', async () => {
    const d = await call('/tutors?q=Dian');
    if (!d.items.length) throw new Error('search miss');
  });
  // tutor detail
  eq('GET /tutors/matematika-jakarta-dian-kusuma', async () => {
    const d = await call('/tutors/matematika-jakarta-dian-kusuma');
    if (d.slug !== 'matematika-jakarta-dian-kusuma') throw new Error('wrong slug');
    if (typeof d.reviews === 'undefined') throw new Error('no reviews');
    if (typeof d.whatsappMasked === 'undefined') throw new Error('no wa mask');
  });
  eq('GET /tutors/nope-404', async () => {
    try {
      await call('/tutors/nope-404');
      throw new Error('should 404');
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  });
  // locations
  eq('GET /locations?level=provinsi', async () => {
    const d = await call('/locations?level=provinsi');
    if (!Array.isArray(d) || !d.length) throw new Error('no provinsi');
  });
  eq('GET /locations?parentId=prov1', async () => {
    const tree = await call('/locations/tree');
    const prov = tree[0];
    const d = await call('/locations?parentId=' + prov.id + '&level=kabupaten');
    if (!Array.isArray(d)) throw new Error('no children');
  });
  eq('GET /locations/tree', async () => {
    const t = await call('/locations/tree');
    if (!t.length) throw new Error('empty tree');
  });
  // login student
  let studentTok;
  eq('POST /auth/login student', async () => {
    const d = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'student@tutorlink.id', password: 'password123' }) });
    if (!d.token || d.user.role !== 'student') throw new Error('login fail');
    studentTok = d.token;
  });
  eq('GET /me (auth)', async () => {
    const d = await call('/me', { headers: { Authorization: 'Bearer ' + studentTok } });
    if (d.email !== 'student@tutorlink.id') throw new Error('me fail');
    if (d.passwordHash !== undefined) throw new Error('leaked hash');
  });
  eq('POST /auth/login wrong pw', async () => {
    try {
      await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'student@tutorlink.id', password: 'nope' }) });
      throw new Error('should 401');
    } catch (e) {
      if (e.status !== 401) throw e;
    }
  });
  // register student with phone
  let newStudentTok;
  eq('POST /auth/register student + phone', async () => {
    const d = await call('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Budi Test', email: 'budi.test@example.com', password: 'rahasia123', role: 'student', phone: '081234567890' }) });
    if (d.user.phone !== '081234567890') throw new Error('phone not stored');
    if (!/^S-\d{6}$/.test(d.user.studentCode || '')) throw new Error('studentCode missing');
    newStudentTok = d.token;
  });
  eq('POST /auth/register duplicate', async () => {
    try {
      await call('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'X', email: 'budi.test@example.com', password: 'rahasia123', role: 'student' }) });
      throw new Error('should 409');
    } catch (e) {
      if (e.status !== 409) throw e;
    }
  });
  // student pass checkout
  let spTx;
  let spSession;
  eq('POST /payments/student-pass', async () => {
    const d = await call('/payments/student-pass', {
      method: 'POST',
      body: JSON.stringify({ tutorId: '17', buyer: { name: 'Cici Ani', email: 'cici@example.com', phone: '085612345678' } })
    });
    if (!d.transaction || d.transaction.id !== d.transaction.id) throw new Error('tx missing');
    spTx = d.transaction.id;
    spSession = d.sessionToken;
    if (d.transaction.amount !== 59000) throw new Error('amount wrong: ' + d.transaction.amount);
  });
  // coupon checkout
  eq('POST /payments/student-pass with coupon', async () => {
    const d = await call('/payments/student-pass', {
      method: 'POST',
      body: JSON.stringify({ tutorId: '17', couponCode: 'AHMAD10', buyer: { name: 'Dodi', email: 'dodi@example.com', phone: '081111222333' } })
    });
    if (!d.couponValid || d.transaction.amount !== 49000) throw new Error('coupon not applied');
  });
  // pay mock
  let ciciPass;
  eq('POST /payments/mock/:id/pay', async () => {
    const d = await call('/payments/mock/' + spTx + '/pay', { method: 'POST' });
    if (d.status !== 'success' || d.transaction.paymentStatus !== 'success') throw new Error('settle fail');
    if (!d.transaction.gatewayRef) throw new Error('no ref');
    ciciPass = (d.transaction.autoCredentials && d.transaction.autoCredentials.password) || null;
    if (!ciciPass) throw new Error('auto creds not returned');
  });
  eq('login with auto-created creds', async () => {
    const d = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'cici@example.com', password: ciciPass }) });
    if (!d.token) throw new Error('cannot login with creds');
    const me = await call('/me', { headers: { Authorization: 'Bearer ' + d.token } });
    if (!me.studentPass || !me.studentPass.hasPass) throw new Error('studentPass missing');
  });
  eq('GET /payments/price', async () => {
    const d = await call('/payments/price');
    if (d.studentPassPrice !== 59000) throw new Error('price');
  });
  // tutor login + premium
  let tutorTok;
  eq('POST /auth/login tutor', async () => {
    const d = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'tutor@tutorlink.id', password: 'password123' }) });
    tutorTok = d.token;
    if (d.user.role !== 'tutor') throw new Error('not tutor');
  });
  let dianTutorCode;
  eq('GET /tutors/me', async () => {
    const d = await call('/tutors/me', { headers: { Authorization: 'Bearer ' + tutorTok } });
    if (d.slug !== 'matematika-jakarta-dian-kusuma') throw new Error('me');
    if (!/^T-\d{6}$/.test(d.tutorCode || '')) throw new Error('tutorCode missing');
    dianTutorCode = d.tutorCode;
  });
  eq('POST /payments/premium + pay', async () => {
    const d = await call('/payments/premium', { method: 'POST', headers: { Authorization: 'Bearer ' + tutorTok }, body: '{}' });
    if (d.transaction.type !== 'tutor_premium') throw new Error('premium tx');
    const pay = await call('/payments/mock/' + d.transaction.id + '/pay', { method: 'POST' });
    if (pay.transaction.paymentStatus !== 'success') throw new Error('premium pay fail');
    const me = await call('/tutors/me', { headers: { Authorization: 'Bearer ' + tutorTok } });
    if (!me.isPremium) throw new Error('isPremium not set');
  });
  eq('GET /payments/access student', async () => {
    const d = await call('/payments/access?tutorId=17', { headers: { Authorization: 'Bearer ' + studentTok } });
    if (typeof d.hasAccess !== 'boolean') throw new Error('access shape');
  });
  // session resume
  eq('GET /payments/session/:token', async () => {
    const d = await call('/payments/session/' + spSession);
    if (d.resolved !== true && d.resolved !== false) throw new Error('session shape');
  });
  // bookings
  let bookId;
  eq('POST /bookings', async () => {
    const d = await call('/bookings', {
      method: 'POST', headers: { Authorization: 'Bearer ' + newStudentTok },
      body: JSON.stringify({ tutorId: '17', subject: 'Matematika', date: '2026-09-20', startTime: '08:00', endTime: '09:00', mode: 'online' })
    });
    bookId = d.id;
    if (d.status !== 'pending' || !d.tutorName) throw new Error('booking');
  });
  eq('GET /bookings/mine', async () => {
    const d = await call('/bookings/mine', { headers: { Authorization: 'Bearer ' + newStudentTok } });
    if (!d.some((b) => b.id === bookId)) throw new Error('mine');
  });
  eq('PATCH /bookings cancel by student', async () => {
    const d = await call('/bookings/' + bookId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + newStudentTok }, body: JSON.stringify({ status: 'cancelled' }) });
    if (d.status !== 'cancelled') throw new Error('cancel');
  });
  // affiliates
  eq('GET /affiliates/validate AHMAD10', async () => {
    const d = await call('/affiliates/validate?code=AHMAD10');
    if (!d.valid || d.discount !== 10000) throw new Error('validate');
  });
  eq('GET /affiliates/lookup AHMAD10', async () => {
    const d = await call('/affiliates/lookup?code=AHMAD10');
    if (d.affiliate.couponCode !== 'AHMAD10' || !Array.isArray(d.sales)) throw new Error('lookup');
  });
  // search logs
  eq('POST+GET /search/logs', async () => {
    await call('/search/logs', { method: 'POST', body: JSON.stringify({ subject: 'Matematika', resultCount: 5 }) });
    const d = await call('/search/logs?limit=3');
    if (!d.length) throw new Error('logs');
  });
  // reviews (409 duplicate from completed booking of seeded reviews? need fresh)
  eq('POST /reviews rejects non-completed', async () => {
    try {
      await call('/reviews', { method: 'POST', headers: { Authorization: 'Bearer ' + studentTok }, body: JSON.stringify({ bookingId: '35', rating: 5, comment: 'ok' }) });
    } catch (e) {
      // seeded booking 35 has a review â†’ 409 expected
      if (e.status === 409 || e.status === 400) return;
      throw e;
    }
  });
  let reviewId;
  eq('POST /reviews via tutorCode', async () => {
    const d = await call('/reviews', { method: 'POST', headers: { Authorization: 'Bearer ' + newStudentTok }, body: JSON.stringify({ tutorCode: dianTutorCode, rating: 5, comment: 'Mantap!' }) });
    if (!d.id || d.tutorId !== '17' || d.bookingId !== null) throw new Error('review shape');
    reviewId = d.id;
  });
  eq('POST /reviews via tutorCode duplicate', async () => {
    try {
      await call('/reviews', { method: 'POST', headers: { Authorization: 'Bearer ' + newStudentTok }, body: JSON.stringify({ tutorCode: dianTutorCode, rating: 4, comment: 'lagi' }) });
      throw new Error('should 409');
    } catch (e) {
      if (e.status !== 409) throw e;
    }
  });
  eq('POST /reviews bad tutorCode', async () => {
    try {
      await call('/reviews', { method: 'POST', headers: { Authorization: 'Bearer ' + newStudentTok }, body: JSON.stringify({ tutorCode: 'T-000000', rating: 5, comment: 'x' }) });
      throw new Error('should 404');
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  });
  eq('GET /reviews/mine (student)', async () => {
    const d = await call('/reviews/mine', { headers: { Authorization: 'Bearer ' + newStudentTok } });
    if (!d.some((r) => r.id === reviewId && r.tutorName === 'Dian Kusuma')) throw new Error('mine missing');
  });
  eq('GET /reviews/tutor (tutor)', async () => {
    const d = await call('/reviews/tutor', { headers: { Authorization: 'Bearer ' + tutorTok } });
    if (!d.some((r) => r.studentName === 'Budi Test')) throw new Error('tutor reviews missing');
  });
  eq('GET /tutors/cities', async () => {
    const d = await call('/tutors/cities');
    if (!Array.isArray(d)) throw new Error('cities');
  });
  // uploads (small data url with a tiny base64 payload, no magic check)
  eq('POST /uploads', async () => {
    const d = await call('/uploads', { method: 'POST', body: JSON.stringify({ filename: 'foto.png', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }) });
    if (!d.url || !d.url.startsWith('data:')) throw new Error('upload');
  });
  // admin
  let adminTok;
  eq('POST /admin/login system', async () => {
    const d = await call('/admin/login', { method: 'POST', body: JSON.stringify({ email: 'admin.system@naraprivat.id', password: 'password123' }) });
    adminTok = d.token;
    if (d.admin.role !== 'system') throw new Error('admin role');
  });
  eq('GET /admin/overview', async () => {
    const d = await call('/admin/overview', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (typeof d.students !== 'number') throw new Error('overview');
  });
  eq('GET /admin/transactions', async () => {
    const d = await call('/admin/transactions', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (!Array.isArray(d)) throw new Error('transactions');
  });
  eq('GET /admin/transactions?status=success', async () => {
    const d = await call('/admin/transactions?status=success', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (!d.every((t) => t.paymentStatus === 'success')) throw new Error('filter');
  });
  eq('GET /admin/notifications', async () => {
    const d = await call('/admin/notifications', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (!Array.isArray(d)) throw new Error('notif');
  });
  eq('GET /admin/tutors', async () => {
    const d = await call('/admin/tutors', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (!Array.isArray(d)) throw new Error('tutors admin');
  });
  eq('GET /admin/pass-price + PATCH', async () => {
    const g = await call('/admin/pass-price', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (g.studentPassPrice !== 59000) throw new Error('price');
    const p = await call('/admin/pass-price', { method: 'PATCH', headers: { Authorization: 'Bearer ' + adminTok }, body: JSON.stringify({ studentPassPrice: 61000 }) });
    if (p.studentPassPrice !== 61000) throw new Error('patch price');
    const g2 = await call('/admin/pass-price', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (g2.studentPassPrice !== 61000) throw new Error('price persisted');
    await call('/admin/pass-price', { method: 'PATCH', headers: { Authorization: 'Bearer ' + adminTok }, body: JSON.stringify({ studentPassPrice: 59000 }) });
  });
  eq('GET /admin/search-trends', async () => {
    const d = await call('/admin/search-trends?days=7', { headers: { Authorization: 'Bearer ' + adminTok } });
    if (!Array.isArray(d.subjectTrends)) throw new Error('trends');
  });
  eq('admin permission gate (analytics admin on operasional)', async () => {
    const login = (await call('/admin/login', { method: 'POST', body: JSON.stringify({ email: 'admin.analytics@naraprivat.id', password: 'password123' }) }));
    try {
      await call('/admin/notifications', { headers: { Authorization: 'Bearer ' + login.token } });
      throw new Error('should 403');
    } catch (e) {
      if (e.status !== 403) throw e;
    }
  });
  eq('GET /payments/access rejects tutor', async () => {
    try {
      await call('/payments/access?tutorId=17', { headers: { Authorization: 'Bearer ' + tutorTok } });
      throw new Error('should 403');
    } catch (e) {
      if (e.status !== 403) throw e;
    }
  });
  // forgot + reset password
  let resetTok;
  eq('POST /auth/forgot-password unknown email', async () => {
    const d = await call('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'takada@example.com' }) });
    if (d.resetToken) throw new Error('should not reveal token');
  });
  eq('POST /auth/forgot-password known email', async () => {
    const d = await call('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'budi.test@example.com' }) });
    if (!d.resetToken) throw new Error('no reset token');
    resetTok = d.resetToken;
  });
  eq('POST /auth/reset-password bad token', async () => {
    try {
      await call('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: 'ngasal', password: 'passwordBaru1' }) });
      throw new Error('should 400');
    } catch (e) {
      if (e.status !== 400) throw e;
    }
  });
  eq('POST /auth/reset-password ok', async () => {
    const d = await call('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetTok, password: 'passwordBaru1' }) });
    if (!/berhasil/.test(d.message)) throw new Error('reset not ok');
  });
  eq('login with new password', async () => {
    const d = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'budi.test@example.com', password: 'passwordBaru1' }) });
    if (!d.token) throw new Error('login new pw fail');
  });
  eq('login with old password rejected', async () => {
    try {
      await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'budi.test@example.com', password: 'rahasia123' }) });
      throw new Error('old pw should fail');
    } catch (e) {
      if (e.status !== 401) throw e;
    }
  });

  // support / hubungi CS (round-robin + tiket)
  eq('GET /support/cs round-robin alternates', async () => {
    const a = await call('/support/cs');
    const b = await call('/support/cs');
    if (!a.available || !b.available || !a.cs || !b.cs) throw new Error('cs harus tersedia');
    if (a.cs.id === b.cs.id) throw new Error('round-robin harus bergilir antar CS');
  });
  eq('POST /support/tickets', async () => {
    const d = await call('/support/tickets', { method: 'POST', body: JSON.stringify({ name: 'Andi', email: 'andi@x.com', whatsapp: '0812', subject: 'Pembayaran / Student Pass', message: 'Pass tidak aktif padahal sudah bayar.' }) });
    if (!d.id || !d.assignedToName) throw new Error('tiket harus ter-assign');
  });
  eq('GET /admin/tickets (cs role)', async () => {
    const csLogin = (await call('/admin/login', { method: 'POST', body: JSON.stringify({ email: 'admin.cs@naraprivat.id', password: 'password123' }) }));
    const d = await call('/admin/tickets', { headers: { Authorization: 'Bearer ' + csLogin.token } });
    if (!Array.isArray(d) || d.length === 0) throw new Error('tiket list kosong');
    const last = d[0];
    const r = await call(`/admin/tickets/${last.id}/status`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + csLogin.token }, body: JSON.stringify({ status: 'done' }) });
    if (r.status !== 'done') throw new Error('tandai selesai gagal');
  });

  await chain;
  console.log('\nresult:', pass, 'passed,', fail, 'failed');
  process.exit(fail ? 1 : 0);
})();