import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, setAdminToken, getAdminToken, formatPrice, formatDate, timeAgo } from '../api';
import { useToast } from '../context/ToastContext';
import { AlertIcon, DownloadIcon } from '../components/Icons';
import PasswordField from '../components/PasswordField';

const ROLE_LABEL = {
  system: 'Admin System',
  operasional: 'Admin Operasional',
  cs: 'Admin CS',
  keuangan: 'Admin Keuangan',
  analytics: 'Admin Analytics'
};

const STATUS_BADGE = {
  pending: 'badge--amber',
  success: 'badge--green',
  failed: 'badge--red'
};

function Overview({ admin }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    adminApi.get('/admin/overview').then(setData).catch(() => {});
  }, []);
  if (!data) return <div className="spinner" />;
  return (
    <div className="stat-cards">
      <div className="stat-card"><b>{data.tutors}</b><span>Tutor Aktif</span></div>
      <div className="stat-card"><b>{data.students}</b><span>Murid Terdaftar</span></div>
      <div className="stat-card"><b>{data.passSold}</b><span>Akses Premium Terjual</span></div>
      <div className="stat-card"><b>{formatPrice(data.revenue)}</b><span>Total Pendapatan</span></div>
      <div className="stat-card"><b>{data.todaySold}</b><span>Terjual Hari Ini</span></div>
      <div className="stat-card"><b>{formatPrice(data.todayRevenue)}</b><span>Pendapatan Hari Ini</span></div>
      <div className="stat-card"><b>{data.affiliateSales}</b><span>Transaksi Affiliate</span></div>
      <div className="stat-card"><b>{formatPrice(data.commissionTotal)}</b><span>Komisi Affiliate</span></div>
    </div>
  );
}

function Transactions({ admin }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const load = (s) => {
    adminApi.get(`/admin/transactions?${s ? `status=${s}` : ''}`).then(setItems).catch(() => {});
  };
  useEffect(() => { load(status); }, [status]);

  const exportCsv = async () => {
    const res = await fetch('/api/admin/transactions/export', { headers: { Authorization: `Bearer ${getAdminToken()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transaksi-naraprivat.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-16" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="flex items-center gap-8">
          <label className="text-sm" style={{ fontWeight: 700 }}>Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
            <option value="">Semua</option>
            <option value="success">Sukses</option>
            <option value="pending">Pending</option>
            <option value="failed">Gagal</option>
          </select>
        </div>
        {admin.role === 'keuangan' && (
          <button className="btn btn--secondary btn--sm" onClick={exportCsv}><DownloadIcon size={15} /> Export CSV (Excel)</button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipe</th>
              <th>Murid</th>
              <th>Tutor</th>
              <th>Jumlah</th>
              <th>Kupon</th>
              <th>Status</th>
              <th>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="8" className="center text-muted">Belum ada transaksi.</td></tr>
            ) : items.map((t) => (
              <tr key={t.id}>
                <td className="text-sm">{t.id}</td>
                  <td>{t.type === 'student_pass' ? 'Akses Premium' : 'Premium'}</td>
                <td>{t.studentName}</td>
                <td>{t.tutorName}</td>
                <td><b>{formatPrice(t.amount)}</b></td>
                <td>{t.couponCode || '-'}</td>
                <td><span className={`badge ${STATUS_BADGE[t.paymentStatus]}`}>{t.paymentStatus}</span></td>
                <td className="text-sm">{formatDate(t.paidAt || t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TutorModeration() {
  const [items, setItems] = useState([]);
  const { push } = useToast();
  const load = () => { adminApi.get('/admin/tutors').then(setItems).catch(() => {}); };
  useEffect(load, []);
  const setStatus = async (id, status) => {
    try {
      await adminApi.patch(`/admin/tutors/${id}/status`, { status });
      push(status === 'takedown' ? 'Tutor di-takedown. Data disimpan 90 hari.' : 'Tutor diaktifkan kembali.');
      load();
    } catch (err) { push(err.message, 'error'); }
  };
  const setRatingVisibility = async (id, showRating) => {
    try {
      await adminApi.patch(`/admin/tutors/${id}/rating`, { showRating });
      push(showRating ? 'Rating tutor ditampilkan di halaman publik.' : 'Rating tutor disembunyikan dari halaman publik.');
      load();
    } catch (err) { push(err.message, 'error'); }
  };
  const setAllRatingVisibility = async (showRating) => {
    try {
      const res = await adminApi.patch('/admin/tutors/rating/all', { showRating });
      push(showRating ? `Rating ${res.count} tutor ditampilkan.` : `Rating ${res.count} tutor disembunyikan.`);
      load();
    } catch (err) { push(err.message, 'error'); }
  };
  return (
    <div className="table-wrap">
      <div className="flex items-center justify-between mb-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          Atur tampil/sembunyi rating per tutor di kolom <b>Rating</b>.
        </p>
        <div className="flex gap-8">
          <button className="btn btn--outline btn--sm" onClick={() => setAllRatingVisibility(true)}>Tampilkan Semua</button>
          <button className="btn btn--outline btn--sm" onClick={() => setAllRatingVisibility(false)}>Sembunyikan Semua</button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tutor</th>
            <th>Subjek</th>
            <th>WhatsApp</th>
            <th>Unlock Hari Ini</th>
            <th>Rating</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td><b>{t.name}</b><div className="text-sm text-muted">{t.email}</div></td>
              <td>{(t.subjects || []).slice(0, 2).join(', ')}</td>
              <td className="text-sm">{t.whatsapp}</td>
              <td className="text-sm">{t.unlockCountToday}</td>
              <td>
                <button
                  className={`btn btn--sm ${t.showRating ? 'btn--success' : 'btn--outline'}`}
                  onClick={() => setRatingVisibility(t.id, !t.showRating)}
                  title="Klik untuk tampil/sembunyi rating di halaman publik"
                >
                  {t.showRating ? 'Tampil' : 'Disembunyikan'}
                </button>              </td>
              <td>
                <span className={`badge ${t.status === 'takedown' ? 'badge--red' : 'badge--green'}`}>
                  {t.status === 'takedown' ? 'Takedown' : 'Active'}
                </span>
              </td>
              <td>
                {t.status === 'takedown' ? (
                  <button className="btn btn--success btn--sm" onClick={() => setStatus(t.id, 'active')}>Aktifkan</button>
                ) : (
                  <button className="btn btn--outline btn--sm" onClick={() => setStatus(t.id, 'takedown')}>Takedown</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notifications() {
  const [items, setItems] = useState([]);
  const { push } = useToast();
  const load = () => { adminApi.get('/admin/notifications').then(setItems).catch(() => {}); };
  useEffect(load, []);
  const markRead = async (id) => {
    await adminApi.patch(`/admin/notifications/${id}/read`, {});
    load();
  };
  return (
    <div>
      {items.length === 0 ? (
        <div className="empty"><b>Tidak ada notifikasi</b>Tidak ada peringatan saat ini.</div>
      ) : (
        <div className="notif-list">
          {items.map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
              <span>{n.type === 'tutor_overload' ? <AlertIcon size={18} /> : <AlertIcon size={18} />}</span>
              <div className="notif-item__body">
                <b>{n.message}</b>
                <div className="text-sm text-muted">{formatDate(n.createdAt)}</div>
                {n.note && <div className="text-sm">Catatan: {n.note}</div>}
              </div>
              {!n.read && <button className="btn btn--ghost btn--sm" onClick={() => markRead(n.id)}>Tandai dibaca</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PassPrice({ admin }) {
  const { push } = useToast();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ studentPassPrice: '', tutorPremiumPrice: '' });
  useEffect(() => {
    adminApi.get('/admin/pass-price').then((c) => {
      setConfig(c);
      setForm({ studentPassPrice: c.studentPassPrice, tutorPremiumPrice: c.tutorPremiumPrice });
    }).catch(() => {});
  }, []);
  const save = async () => {
    try {
      await adminApi.patch('/admin/pass-price', {
        studentPassPrice: Number(form.studentPassPrice),
        tutorPremiumPrice: Number(form.tutorPremiumPrice)
      });
      push('Konfigurasi harga diperbarui.');
    } catch (err) { push(err.message, 'error'); }
  };
  if (!config) return <div className="spinner" />;
  return (
    <div className="detail-main" style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Konfigurasi Harga</h2>
      <p className="text-sm text-muted mb-16">Hanya Admin System yang bisa mengubah harga.</p>
      <div className="field"><label>Harga Akses Premium (Rp)</label>
        <input type="number" value={form.studentPassPrice} onChange={(e) => setForm({ ...form, studentPassPrice: e.target.value })} /></div>
      <div className="field"><label>Harga Tutor Premium (Rp)</label>
        <input type="number" value={form.tutorPremiumPrice} onChange={(e) => setForm({ ...form, tutorPremiumPrice: e.target.value })} /></div>
      <button className="btn btn--primary" onClick={save}>Simpan</button>
    </div>
  );
}

function SearchTrends() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  useEffect(() => {
    adminApi.get(`/admin/search-trends?days=${days}`).then(setData).catch(() => {});
  }, [days]);
  if (!data) return <div className="spinner" />;
  return (
    <div>
      <div className="flex items-center gap-8 mb-16">
        <label className="text-sm" style={{ fontWeight: 700 }}>Rentang:</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-strong)' }}>
          <option value={1}>1 hari</option>
          <option value={7}>7 hari</option>
          <option value={30}>30 hari</option>
        </select>
        <span className="text-sm text-muted">Total pencarian: {data.total}</span>
      </div>
      <div className="grid grid--2">
        <div className="detail-main">
          <h3 style={{ fontSize: 17, marginBottom: 12 }}>Tren Subjek</h3>
          {data.subjectTrends.length === 0 ? <p className="text-muted">Belum ada data.</p> : data.subjectTrends.map((s) => (
            <div key={s.name} className="trend-row">
              <span style={{ flex: 1 }}>{s.name}</span>
              <span className="badge badge--blue">{s.count}x</span>
            </div>
          ))}
        </div>
        <div className="detail-main">
          <h3 style={{ fontSize: 17, marginBottom: 12 }}>Tren Lokasi</h3>
          {data.locationTrends.length === 0 ? <p className="text-muted">Belum ada data.</p> : data.locationTrends.map((l) => (
            <div key={l.name} className="trend-row">
              <span style={{ flex: 1 }}>{l.name}</span>
              <span className="badge badge--green">{l.count}x</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SupportTickets() {
  const { push } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    adminApi
      .get('/admin/tickets')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const markDone = async (id) => {
    try {
      await adminApi.patch(`/admin/tickets/${id}/status`, { status: 'done' });
      push('Tiket ditandai selesai.');
      load();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const openCount = items.filter((t) => t.status === 'open').length;

  return (
    <div>
      <div className="flex items-center gap-8 mb-16" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>
          Tiket bantuan <span className="badge badge--amber">{openCount} terbuka</span>
        </b>
        <button className="btn btn--ghost btn--sm" onClick={load}>Muat ulang</button>
      </div>
      {loading ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty"><b>Belum ada tiket</b><span className="text-sm text-muted">Tiket dari form "Hubungi CS" akan muncul di sini.</span></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((t) => (
            <div key={t.id} className="detail-main" style={{ marginTop: 0 }}>
              <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{t.name}</b>
                  <span className={`badge ${t.status === 'open' ? 'badge--amber' : 'badge--green'}`}>
                    {t.status === 'open' ? 'Terbuka' : 'Selesai'}
                  </span>
                  <span className="badge badge--blue">{t.subject}</span>
                  <span className="text-sm text-muted">{timeAgo(t.createdAt)}</span>
                </div>
                {t.status === 'open' && (
                  <button className="btn btn--success btn--sm" onClick={() => markDone(t.id)}>Tandai selesai</button>
                )}
              </div>
              <p className="text-sm" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{t.message}</p>
              <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                <b>Diteruskan ke:</b> {t.assignedToName || 'Belum ditugaskan'} · Kontak: {t.whatsapp || t.email || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { push } = useToast();
  const [admin, setAdmin] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!getAdminToken()) return;
    adminApi.get('/admin/me').then(setAdmin).catch(() => setAdminToken(null));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.post('/admin/login', loginForm);
      setAdminToken(res.token);
      setAdmin(res.admin);
      setTab('overview');
      push(`Selamat datang, ${res.admin.name}!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!admin) {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <h1>Admin NARAPRIVAT</h1>
          <p className="auth-sub">Login dengan akun admin internal.</p>
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
            </div>
            <PasswordField
              label="Password"
              value={loginForm.password}
              onChange={(v) => setLoginForm({ ...loginForm, password: v })}
              required
              autoComplete="current-password"
            />
            {error && <div className="field-error mb-16">{error}</div>}
            <button className="btn btn--primary btn--block btn--lg" disabled={loading}>{loading ? 'Memproses…' : 'Masuk'}</button>
          </form>
          <div className="mt-24" style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px' }}>
            <p className="text-sm text-muted" style={{ fontWeight: 700 }}>Akun demo admin (password: password123):</p>
            <p className="text-sm">System: admin.system@naraprivat.id</p>
            <p className="text-sm">Ops: admin.ops@naraprivat.id</p>
            <p className="text-sm">CS: admin.cs@naraprivat.id</p>
            <p className="text-sm">CS 2: admin.cs2@naraprivat.id</p>
            <p className="text-sm">Keuangan: admin.keuangan@naraprivat.id</p>
            <p className="text-sm">Analytics: admin.analytics@naraprivat.id</p>
          </div>
          <p className="center mt-16 text-sm"><Link to="/">← Kembali ke beranda</Link></p>
        </div>
      </div>
    );
  }

  const menu = [];
  menu.push({ key: 'overview', label: 'Ringkasan', roles: ['system', 'keuangan', 'analytics'] });
  menu.push({ key: 'transaksi', label: 'Transaksi', roles: ['system', 'cs', 'keuangan'] });
  menu.push({ key: 'tiket', label: 'Tiket CS', roles: ['system', 'cs', 'operasional'] });
  menu.push({ key: 'tutor', label: 'Moderasi Tutor', roles: ['system', 'operasional'] });
  menu.push({ key: 'notif', label: 'Notifikasi', roles: ['system', 'operasional'] });
  menu.push({ key: 'harga', label: 'Konfigurasi Harga', roles: ['system'] });
  menu.push({ key: 'tren', label: 'Tren Pencarian', roles: ['system', 'analytics'] });

  const allowed = menu.filter((m) => m.roles.includes(admin.role) || admin.role === 'system');
  const active = allowed.some((m) => m.key === tab) ? tab : allowed[0].key;

  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="container">
        <div className="section__head">
          <div>
            <div className="section__tag">Dashboard Admin</div>
            <h2 className="section__title">{ROLE_LABEL[admin.role]}</h2>
            <p className="section__sub">Hak akses dibatasi sesuai peran.</p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => { setAdminToken(null); setAdmin(null); }}>
            Keluar
          </button>
        </div>

        <div className="dash-grid">
          <aside className="dash-side">
            {allowed.map((m) => (
              <a key={m.key} className={active === m.key ? 'active' : ''} onClick={() => setTab(m.key)}>
                {m.label}
              </a>
            ))}
          </aside>
          <div>
            {active === 'overview' && <Overview admin={admin} />}
            {active === 'transaksi' && <Transactions admin={admin} />}
            {active === 'tiket' && <SupportTickets />}
            {active === 'tutor' && <TutorModeration />}
            {active === 'notif' && <Notifications />}
            {active === 'harga' && <PassPrice admin={admin} />}
            {active === 'tren' && <SearchTrends />}
          </div>
        </div>
      </div>
    </section>
  );
}
