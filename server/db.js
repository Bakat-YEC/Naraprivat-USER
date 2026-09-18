const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DB = {
  users: [],
  bookings: [],
  reviews: [],
  locations: [],
  subjects: [],
  transactions: [],
  affiliates: [],
  searchLogs: [],
  admins: [],
  sessions: [],
  notifications: [],
  passwordResets: [],
  config: {
    studentPassPrice: 59000,
    tutorPremiumPrice: 29000
  }
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DB, ...parsed };
  } catch (err) {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function nextId(collection) {
  const max = collection.reduce((m, item) => {
    const n = parseInt(String(item.id).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return String(max + 1);
}

function findUser(db, predicate) {
  return db.users.find(predicate);
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function uid(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}

function randomSix() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}
function makeTutorCode(db) {
  let code = '';
  do {
    code = 'T-' + randomSix();
  } while (db.users.some((u) => u.tutorCode && u.tutorCode.toUpperCase() === code));
  return code;
}
function makeStudentCode(db) {
  let code = '';
  do {
    code = 'S-' + randomSix();
  } while (db.users.some((u) => u.studentCode && u.studentCode.toUpperCase() === code));
  return code;
}

function studentPass(db, studentId) {
  const paid = (db.transactions || [])
    .filter((t) => t.type === 'student_pass' && String(t.studentId) === String(studentId) && t.paymentStatus === 'success')
    .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  if (!paid.length) return { hasPass: false, passSince: null, passCount: 0 };
  return { hasPass: true, passSince: paid[0].paidAt, passCount: paid.length };
}

module.exports = { readDb, writeDb, nextId, findUser, publicUser, slugify, uid, studentPass, makeTutorCode, makeStudentCode, DB_FILE };
