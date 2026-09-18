const TOKEN_KEY = 'tutorlink_token';
const PENDING_KEY = 'np_pending_payment';
const ADMIN_TOKEN_KEY = 'np_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function savePendingPayment(data) {
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ ...data, createdAt: Date.now() })
  );
}

export function getPendingPayment() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.createdAt || Date.now() - data.createdAt > 24 * 3600 * 1000) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  localStorage.removeItem(PENDING_KEY);
}

function offlineRequest(path, options = {}) {
  const offline = globalThis.__NP_OFFLINE__;
  if (!offline || typeof offline.handle !== 'function') return null;
  return offline.handle(path, options);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const offline = offlineRequest(path, { ...options, headers });
  if (offline) {
    try {
      return await offline;
    } catch (err) {
      const status = err && typeof err.status === 'number' ? err.status : 500;
      const e = new Error((err && err.message) || 'Terjadi kesalahan.');
      e.status = status;
      throw e;
    }
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = new Error(data.message || 'Terjadi kesalahan.');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function adminRequest(path, options = {}) {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const offline = offlineRequest(path, { ...options, headers });
  if (offline) {
    try {
      return await offline;
    } catch (err) {
      const status = err && typeof err.status === 'number' ? err.status : 500;
      const e = new Error((err && err.message) || 'Terjadi kesalahan.');
      e.status = status;
      throw e;
    }
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data.message || 'Terjadi kesalahan.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  delete: (path) => request(path, { method: 'DELETE' })
};

export const adminApi = {
  get: (path) => adminRequest(path),
  post: (path, body) => adminRequest(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (path, body) => adminRequest(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  delete: (path) => adminRequest(path, { method: 'DELETE' }),
  raw: (path) => adminRequest(path)
};

export const formatPrice = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
};

export const timeAgo = (iso) => {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'baru saja';
    if (min < 60) return `${min} menit lalu`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} jam lalu`;
    return `${Math.floor(hr / 24)} hari lalu`;
  } catch {
    return '';
  }
};

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file) {
  const dataUrl = await readFileAsBase64(file);
  const mimeType = file.type || '';
  const data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return api.post('/uploads', { filename: file.name, mimeType, data });
}

export function buildWhatsappLink(number, message) {
  const digits = String(number || '').replace(/[^0-9]/g, '');
  const international = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

export function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const PALETTE = [
  '#ff6a3d', '#e0558c', '#12a594', '#f5a623', '#3f7df6',
  '#8e5cf7', '#1fb56b', '#ef4b4b', '#d97706', '#0d9488'
];

export function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
