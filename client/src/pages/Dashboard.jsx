import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, formatDate, formatPrice, avatarColor, initials, uploadFile } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarRating from '../components/StarRating';
import TutorCard from '../components/TutorCard';
import { JENJANG } from '../options';
import { BuildingIcon, CrownIcon, DiamondIcon, ImageIcon, LockIcon, LogOutIcon, MonitorIcon, TicketIcon, XIcon } from '../components/Icons';

const STATUS_BADGE = {
  pending: ['badge--amber', 'Menunggu'],
  accepted: ['badge--blue', 'Dijadwalkan'],
  completed: ['badge--green', 'Selesai'],
  cancelled: ['badge--red', 'Dibatalkan'],
  rejected: ['badge--gray', 'Ditolak']
};

const PAYMENT_BADGE = {
  pending: ['badge--amber', 'Menunggu Pembayaran'],
  success: ['badge--green', 'Berhasil'],
  failed: ['badge--red', 'Gagal']
};

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function ReviewCard({ item, kind }) {
  return (
    <div className="detail-main" style={{ marginTop: 0 }}>
      <div className="flex items-center" style={{ gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>{kind === 'student' ? item.tutorName : item.studentName}</b>
        <StarRating rating={item.rating} />
        <span className="text-sm text-muted">{formatDate(item.createdAt)}</span>
      </div>
      {item.comment && (
        <p className="text-sm" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
          {item.comment}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') || 'ringkasan';
  const tab = user?.role === 'student' && rawTab === 'pesanan' ? 'pembayaran' : rawTab;
  const [menuOpen, setMenuOpen] = useState(false);
  const { push } = useToast();

  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revs, setRevs] = useState([]);
  const [revLoading, setRevLoading] = useState(true);
  const [revCode, setRevCode] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revSaving, setRevSaving] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const [contacted, setContacted] = useState([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [payLoading, setPayLoading] = useState(false);

  const loadPayments = () => {
    if (user?.role !== 'student') return;
    setPayLoading(true);
    api.get('/payments/mine')
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPayLoading(false));
  };

  const loadFavorites = () => {
    if (user?.role !== 'student') return;
    setFavLoading(true);
    api.get('/favorites')
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setFavLoading(false));
  };

  const loadContacted = () => {
    if (user?.role !== 'student') return;
    setContactLoading(true);
    api.get('/tutors/contacted')
      .then((res) => setContacted(Array.isArray(res) ? res : res.items || []))
      .catch(() => setContacted([]))
      .finally(() => setContactLoading(false));
  };

  const loadBookings = () => {
    api.get('/bookings/mine')
      .then((data) => {
        setBookings(data);
        setStats({
          total: data.length,
          pending: data.filter((b) => b.status === 'pending').length,
          accepted: data.filter((b) => b.status === 'accepted').length,
          completed: data.filter((b) => b.status === 'completed').length,
          cancelled: data.filter((b) => b.status === 'cancelled' || b.status === 'rejected').length
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    const url = user?.role === 'student' ? '/reviews/mine' : user?.role === 'tutor' ? '/reviews/tutor' : null;
    if (!url) return;
    setRevLoading(true);
    api.get(url)
      .then(setRevs)
      .catch(() => setRevs([]))
      .finally(() => setRevLoading(false));
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (tab === 'favorit') loadFavorites();
  }, [tab, user?.role]);

  useEffect(() => {
    if (tab === 'dihubungi') loadContacted();
  }, [tab, user?.role]);

  useEffect(() => {
    if (tab === 'pembayaran') loadPayments();
  }, [tab, user?.role]);

  const setTab = (t) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next);
  };

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}`, { status });
      const labels = {
        accepted: 'Permintaan les diterima!',
        rejected: 'Permintaan les ditolak.',
        completed: 'Kelas ditandai selesai.',
        cancelled: 'Pemesanan dibatalkan.'
      };
      push(labels[status] || 'Status diperbarui.');
      loadBookings();
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!revCode.trim()) {
      push('Masukkan ID Tutor terlebih dahulu.', 'error');
      return;
    }
    setRevSaving(true);
    try {
      await api.post('/reviews', { tutorCode: revCode.trim().toUpperCase(), rating: revRating, comment: revComment });
      push('Terima kasih atas ulasan Anda!');
      setRevCode('');
      setRevRating(5);
      setRevComment('');
      api.get('/reviews/mine').then(setRevs).catch(() => {});
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setRevSaving(false);
    }
  };

  const copyTutorCode = async () => {
    try {
      await navigator.clipboard.writeText(user?.tutorCode || '');
      push('ID Tutor disalin.');
    } catch (err) {
      push('Gagal menyalin otomatis. ID Tutor: ' + (user?.tutorCode || ''), 'error');
    }
  };

  const copyOrderId = async (orderId) => {
    try {
      await navigator.clipboard.writeText(orderId);
      push('ID Order disalin.');
    } catch (err) {
      push('Gagal menyalin. ID Order: ' + orderId, 'error');
    }
  };

  const sideItems = [
    { key: 'ringkasan', label: 'Ringkasan' },
    ...(user?.role === 'tutor'
      ? [{ key: 'pesanan', label: 'Pesanan' }]
      : [
          { key: 'favorit', label: 'Tutor Favorit' },
          { key: 'dihubungi', label: 'Tutor Dihubungi' },
          { key: 'pembayaran', label: 'Riwayat Pembayaran' }
        ]),
    ...(user?.role === 'tutor'
      ? [
          { key: 'status', label: 'Status & Premium' },
          { key: 'profil', label: 'Profil Tutor' }
        ]
      : []),
    ...(user?.role === 'tutor' ? [{ key: 'ulasan', label: 'Ulasan' }] : [])
  ];

  const handleLogout = () => {
    logout();
    push('Sampai jumpa lagi!');
    navigate('/');
  };

  return (
    <section className="section dash-main" style={{ paddingTop: 40 }}>
      <div className="container">
        <div className="section__head">
          <div>
            <div className="section__tag">Dashboard</div>
            <h2 className="section__title">Halo, {user?.name?.split(' ')[0]}!</h2>
            <p className="section__sub">
              {user?.role === 'tutor'
                ? 'Kelola profil, jadwal les, dan ulasan dari murid Anda.'
                : 'Kelola tutor favorit, tutor yang dihubungi, dan riwayat pembayaranmu.'}
            </p>
          </div>
        </div>

        <div className="dash-topbar">
          <b style={{ fontSize: 16 }}>
            {sideItems.find((i) => i.key === tab)?.label || 'Ringkasan'}
          </b>
          <div className="dash-topbar__actions">
            <button
              className="btn btn--outline btn--sm"
              onClick={() => setMenuOpen((o) => !o)}
              style={{ whiteSpace: 'nowrap' }}
            >
              Menu {menuOpen ? '▲' : '▼'}
            </button>
            <button
              className="dash-topbar__profile"
              aria-label="Profil peserta"
              title="Profil peserta"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {user?.photoUrl ? (
                <img className="avatar avatar--img" src={user.photoUrl} alt={user?.name} />
              ) : (
                <span className="avatar" style={{ backgroundColor: avatarColor(user?.name) }}>
                  {initials(user?.name)}
                </span>
              )}
            </button>
          </div>
          {menuOpen && (
            <div className="dash-mobile-menu">
              <div className="dash-mobile-menu__user">
                {user?.photoUrl ? (
                  <img className="avatar avatar--img" src={user.photoUrl} alt={user?.name} />
                ) : (
                  <span className="avatar" style={{ backgroundColor: avatarColor(user?.name) }}>
                    {initials(user?.name)}
                  </span>
                )}
                <div>
                  <b style={{ fontSize: 14 }}>{user?.name}</b>
                  <div className="text-sm text-muted">
                    {user?.role === 'tutor'
                      ? user?.tutorCode
                        ? `Tutor - ${user.tutorCode}`
                        : 'Tutor'
                      : user?.studentCode
                        ? `Murid - ${user.studentCode}`
                        : 'Murid'}
                  </div>
                </div>
              </div>
              {sideItems.map((item) => (
                <a
                  key={item.key}
                  className={tab === item.key ? 'active' : ''}
                  onClick={() => {
                    setTab(item.key);
                    setMenuOpen(false);
                  }}
                >
                  {item.label}
                </a>
              ))}
              <button
                className="dash-logout"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
              >
                <LogOutIcon size={16} /> Keluar
              </button>
            </div>
          )}
        </div>

        <div className="dash-grid">
          <aside className="dash-side">
            <div className="flex items-center gap-12 mb-16" style={{ padding: '4px 8px' }}>
              {user?.photoUrl ? (
                <img className="avatar avatar--img" src={user.photoUrl} alt={user?.name} />
              ) : (
                <span className="avatar" style={{ backgroundColor: avatarColor(user?.name) }}>
                  {initials(user?.name)}
                </span>
              )}
              <div>
                <b style={{ fontSize: 14 }}>{user?.name}</b>
                <div className="text-sm text-muted">
                  {user?.role === 'tutor'
                    ? user?.tutorCode
                      ? `Tutor - ${user.tutorCode}`
                      : 'Tutor'
                    : user?.studentCode
                      ? `Murid - ${user.studentCode}`
                      : 'Murid'}
                </div>
              </div>
            </div>
            {sideItems.map((item) => (
              <a
                key={item.key}
                className={tab === item.key ? 'active' : ''}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </a>
            ))}
            <button className="dash-logout" onClick={handleLogout}>
              <LogOutIcon size={16} /> Keluar
            </button>
          </aside>

          <div>
            {/* ---------- RINGKASAN ---------- */}
            {tab === 'ringkasan' && (
              <>
                {user?.role === 'student' && (
                  <div className="pass-card">
                    <div className="pass-card__icon"><TicketIcon size={22} /></div>
                    <div className="pass-card__body">
                      {user.studentPass?.hasPass ? (
                        <>
                          <b>Akses Premium Aktif — Anda Premium</b>
                          <p>
                            Akses nomor WhatsApp semua tutor sudah terbuka.
                            {user.studentPass.passCount > 1 ? ` Diperbarui ${new Date(user.studentPass.passSince).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ` Terhitung sejak ${new Date(user.studentPass.passSince).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
                          </p>
                        </>
                      ) : (
                        <>
                          <b>Kamu belum premium</b>
                          <p>
                            Bayar Akses Premium sekali, lalu bebas kontak WhatsApp tutor mana pun.
                            <Link to="/tutors" className="btn btn--primary btn--sm" style={{ marginLeft: 12 }}>Pilih Tutor &amp; Bayar →</Link>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="stat-cards">
                  <StatCard label="Total Pesanan" value={loading ? '…' : stats?.total ?? 0} />
                  <StatCard label="Menunggu" value={loading ? '…' : stats?.pending ?? 0} />
                  <StatCard label="Dijadwalkan" value={loading ? '…' : stats?.accepted ?? 0} />
                  <StatCard label="Selesai" value={loading ? '…' : stats?.completed ?? 0} />
                  <StatCard label="Batal/Ditolak" value={loading ? '…' : stats?.cancelled ?? 0} />
                </div>
                <div className="empty">
                  <b>
                    {user?.role === 'tutor'
                      ? 'Mulai terima murid dengan melengkapi profil'
                      : 'Temukan tutor pertamamu sekarang!'}
                  </b>
                  {user?.role === 'tutor' ? (
                    <Link to="/tutors">Cari inspirasi dari tutor lain</Link>
                  ) : (
                    <Link to="/tutors">Jelajahi daftar tutor →</Link>
                  )}
                </div>
              </>
            )}

            {/* ---------- PESANAN ---------- */}
            {tab === 'pesanan' && (
              <>
                {loading ? (
                  <div className="spinner" />
                ) : bookings.length === 0 ? (
                  <div className="empty">
                    <b>Belum ada pesanan</b>
                    {user?.role === 'tutor'
                      ? 'Permintaan les dari murid akan muncul di sini.'
                      : <Link to="/tutors">Cari tutor sekarang →</Link>}
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{user?.role === 'tutor' ? 'Murid' : 'Tutor'}</th>
                          <th>Mata Pelajaran</th>
                          <th>Jadwal</th>
                          <th>Metode</th>
                          <th>Harga</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b) => {
                          const [cls, label] = STATUS_BADGE[b.status];
                          const isStudent = user?.role === 'student';
                          const reviewed = b.reviewed;
                          return (
                            <tr key={b.id}>
                              <td>
                                <b>{isStudent ? b.tutorName : b.studentName}</b>
                              </td>
                              <td>{b.subject}</td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {b.date} <span className="text-muted text-sm">{b.startTime}–{b.endTime}</span>
                              </td>
                              <td>
                                <span className="tag">{b.mode === 'online' ? <><MonitorIcon size={13} /> Online</> : <><BuildingIcon size={13} /> Tatap muka</>}</span>
                              </td>
                              <td><b>{formatPrice(b.price)}</b></td>
                              <td><span className={`badge ${cls}`}>{label}</span></td>
                              <td>
                                {isStudent && b.status === 'pending' && (
                                  <button className="btn btn--outline btn--sm" onClick={() => changeStatus(b.id, 'cancelled')}>
                                    Batalkan
                                  </button>
                                )}
                                {isStudent && b.status === 'completed' && (
                                  reviewed ? (
                                    <span className="badge badge--green">Sudah diulas</span>
                                  ) : (
                                    <button className="btn btn--secondary btn--sm" onClick={() => setTab('ulasan')}>
                                      Ulas tutor →
                                    </button>
                                  )
                                )}
                                {!isStudent && b.status === 'pending' && (
                                  <div className="flex gap-8">
                                    <button className="btn btn--primary btn--sm" onClick={() => changeStatus(b.id, 'accepted')}>
                                      Terima
                                    </button>
                                    <button className="btn btn--outline btn--sm" onClick={() => changeStatus(b.id, 'rejected')}>
                                      Tolak
                                    </button>
                                  </div>
                                )}
                                {!isStudent && b.status === 'accepted' && (
                                  <button className="btn btn--success btn--sm" onClick={() => changeStatus(b.id, 'completed')}>
                                    Selesaikan
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ---------- RIWAYAT PEMBAYARAN (murid) ---------- */}
            {tab === 'pembayaran' && (
              <>
                {payLoading ? (
                  <div className="spinner" />
                ) : payments.length === 0 ? (
                  <div className="empty">
                    <b>Belum ada riwayat pembayaran</b>
                    Pembelian Akses Premium Anda akan muncul di sini beserta ID Order dan metode pembayarannya.
                    <Link to="/tutors">Pilih Tutor &amp; Aktifkan Akses Premium →</Link>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID Order</th>
                          <th>Paket</th>
                          <th>Tanggal</th>
                          <th>Nominal</th>
                          <th>Metode Pembayaran</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((t) => {
                          const [cls, label] = PAYMENT_BADGE[t.paymentStatus] || ['badge--gray', t.paymentStatus];
                          return (
                            <tr key={t.id}>
                              <td>
                                <div className="flex items-center gap-8">
                                  <code className="code" style={{ fontSize: 13 }}>{t.orderId}</code>
                                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => copyOrderId(t.orderId)}>
                                    Salin
                                  </button>
                                </div>
                              </td>
                              <td>
                                <b>{t.type === 'tutor_premium' ? 'Tutor Premium' : 'Akses Premium'}</b>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.paidAt || t.createdAt)}</td>
                              <td><b>{formatPrice(t.totalAmount != null ? t.totalAmount : t.amount)}</b></td>
                              <td>{t.paymentMethod || 'Midtrans (Sandbox)'}</td>
                              <td><span className={`badge ${cls}`}>{label}</span></td>
                              <td>
                                {t.paymentStatus === 'pending' ? (
                                  <Link to={`/payments/mock/${t.id}`} className="btn btn--primary btn--sm">Bayar</Link>
                                ) : t.gatewayRef ? (
                                  <span className="text-sm text-muted">{t.gatewayRef}</span>
                                ) : (
                                  <span className="text-sm text-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ---------- PROFIL TUTOR ---------- */}
            {tab === 'profil' && <TutorProfileForm onSaved={loadBookings} />}

            {/* ---------- STATUS & PREMIUM ---------- */}
            {tab === 'status' && <TutorStatusPanel />}

            {/* ---------- FAVORIT ---------- */}
            {tab === 'favorit' && (
              <>
                {favLoading ? (
                  <div className="spinner" />
                ) : favorites.length === 0 ? (
                  <div className="empty">
                    <b>Belum ada tutor favorit</b>
                    Tekan ikon hati pada kartu tutor untuk menyimpannya di sini.
                    <Link to="/tutors">Cari tutor sekarang →</Link>
                  </div>
                ) : (
                  <>
                    <div className="section__head" style={{ marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 20 }}>Tutor Favorit ({favorites.length})</h2>
                        <p className="text-sm text-muted">Tutor yang kamu simpan untuk dilihat lagi nanti.</p>
                      </div>
                    </div>
                    <div className="grid grid--tutors">
                      {favorites.map((t) => (
                        <TutorCard key={t.id} tutor={t} onFavoriteChange={() => loadFavorites()} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ---------- TUTOR DIHUBUNGI ---------- */}
            {tab === 'dihubungi' && (
              <>
                {contactLoading ? (
                  <div className="spinner" />
                ) : contacted.length === 0 ? (
                  <div className="empty">
                    <b>Belum ada tutor yang dihubungi</b>
                    Buka profil tutor lalu tekan tombol WhatsApp untuk menghubunginya. Tutor yang kamu hubungi akan muncul di sini.
                    <Link to="/tutors">Cari tutor sekarang →</Link>
                  </div>
                ) : (
                  <>
                    <div className="section__head" style={{ marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 20 }}>Tutor Dihubungi ({contacted.length})</h2>
                        <p className="text-sm text-muted">Tutor yang pernah kamu hubungi via WhatsApp.</p>
                      </div>
                    </div>
                    <div className="grid grid--tutors">
                      {contacted.map((t) => (
                        <TutorCard key={t.id} tutor={t} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ---------- ULASAN ---------- */}
            {tab === 'ulasan' && (
              <>
                {user?.role === 'tutor' ? (
                  <>
                    <div className="detail-main">
                      <h2 style={{ fontSize: 20, marginBottom: 8 }}>ID Tutor Kamu</h2>
                      <p className="text-sm text-muted mb-16">
                        Bagikan ID ini ke murid <b>setelah les selesai</b> agar mereka bisa memberi ulasan untukmu.
                      </p>
                      <div className="flex items-center" style={{ gap: 10 }}>
                        <code
                          className="code"
                          style={{
                            fontSize: 20,
                            padding: '8px 14px',
                            background: 'var(--bg-soft)',
                            borderRadius: 8,
                            letterSpacing: 1
                          }}
                        >
                          {user?.tutorCode || 'NP-XXXXX'}
                        </code>
                        <button type="button" className="btn btn--outline btn--sm" onClick={copyTutorCode}>
                          Salin
                        </button>
                      </div>
                    </div>
                    <div className="detail-main mt-16">
                      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Ulasan yang diterima ({revs.length})</h2>
                      {revLoading ? (
                        <div className="spinner" />
                      ) : revs.length === 0 ? (
                        <p className="text-muted">Belum ada ulasan. Bagikan ID Tutor kamu ke murid setelah kelas selesai.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          {revs.map((r) => <ReviewCard key={r.id} item={r} kind="tutor" />)}
                        </div>
                      )}
                    </div>
                    <div className="mt-16 detail-main">
                      <Link to={`/tutors/${user.id}`} className="btn btn--outline">
                        Lihat profil publik saya
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="empty mb-16" style={{ padding: 14 }}>
                        <b style={{ fontSize: 14 }}>ID Muridmu: {user?.studentCode || 'S-XXXXXX'}</b>
                        <span className="text-sm text-muted">Tunjukkan ID ini ke tutor sebagai identitasmu.</span>
                      </div>
                      <form className="detail-main" onSubmit={submitReview}>
                      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Beri Ulasan</h2>
                      <p className="text-sm text-muted mb-16">
                        Minta <b>ID Tutor</b> dari tutor setelah kelas selesai, lalu masukkan di sini untuk memberikan ulasan.
                      </p>
                      <div className="field">
                        <label>ID Tutor</label>
                        <input
                          placeholder="cth: T-778736"
                          value={revCode}
                          onChange={(e) => setRevCode(e.target.value.toUpperCase())}
                        />
                        <div className="hint">
                          ID Tutor diberikan langsung oleh tutor. Jika kode tidak terdaftar, ulasan tidak akan terkirim.
                        </div>
                      </div>
                      <div className="field">
                        <label>Rating</label>
                        <div style={{ fontSize: 30, lineHeight: 1.2 }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setRevRating(n)}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: 30,
                                cursor: 'pointer',
                                color: n <= revRating ? '#f5a623' : 'var(--border-strong)',
                                padding: 0,
                                marginRight: 2
                              }}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Deskripsi Review</label>
                        <textarea
                          rows={4}
                          placeholder="Ceritakan pengalaman belajarmu dengan tutor ini..."
                          value={revComment}
                          onChange={(e) => setRevComment(e.target.value)}
                        />
                      </div>
                      <button className="btn btn--primary btn--lg" disabled={revSaving}>
                        {revSaving ? 'Mengirim...' : 'Kirim Ulasan'}
                      </button>
                    </form>
                    <div className="detail-main mt-16">
                      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Ulasanku ({revs.length})</h2>
                      {revLoading ? (
                        <div className="spinner" />
                      ) : revs.length === 0 ? (
                        <p className="text-muted">Belum ada ulasan yang Anda tulis.</p>
                      ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          {revs.map((r) => <ReviewCard key={r.id} item={r} kind="student" />)}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TutorStatusPanel() {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [buying, setBuying] = useState(false);

  const toggle = async (status) => {
    setSaving(true);
    try {
      const updated = await api.patch('/tutors/me', { availabilityStatus: status });
      updateUser(updated);
      push(status === 'available' ? 'Status diubah menjadi Tersedia.' : 'Status diubah menjadi Penuh.');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const buyPremium = async () => {
    setBuying(true);
    try {
      const res = await api.post('/payments/premium', {});
      push('Mengarahkan ke pembayaran Tutor Premium…');
      navigate(res.paymentUrl);
    } catch (err) {
      push(err.message, 'error');
      setBuying(false);
    }
  };

  const status = user?.availabilityStatus || 'available';
  const premiumActive = user?.isPremium && new Date(user.premiumExpiresAt) > new Date();

  return (
    <div>
      <div className="detail-main">
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Status Ketersediaan</h2>
        <p className="text-sm text-muted mb-16">
                Murid hanya bisa menghubungi Anda saat status <b><span className="status-dot-dot status-dot--green" />Tersedia</b>. Ubah ke Penuh jika jadwal sudah padat.
        </p>
        <div className="status-toggle">
          <button
            type="button"
            className={`btn ${status === 'available' ? 'btn--success' : 'btn--outline'}`}
            style={{ flex: 1 }}
            disabled={saving || status === 'available'}
            onClick={() => toggle('available')}
          >
            <span className="status-dot-dot status-dot--green" /> Tersedia
          </button>
          <button
            type="button"
            className={`btn ${status === 'full' ? 'btn--red' : 'btn--outline'}`}
            style={{ flex: 1 }}
            disabled={saving || status === 'full'}
            onClick={() => toggle('full')}
          >
            <span className="status-dot-dot status-dot--red" /> Penuh
          </button>
        </div>
      </div>

      <div className="detail-main mt-16">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Paket Tutor Premium</h2>
        {premiumActive ? (
          <div className="premium-active">
            <div style={{ fontSize: 30, lineHeight: 1 }}><CrownIcon size={30} /></div>
            <div>
              <b>Premium Aktif</b>
              <div className="text-sm text-muted">Berlaku sampai {formatDate(user.premiumExpiresAt)}. Posisi Anda di-boost di hasil pencarian, boleh ubah nama & nomor WhatsApp, serta mengajar banyak bidang.</div>
            </div>
          </div>
        ) : (
          <div className="premium-card">
            <div className="flex items-center gap-12">
              <div>
                <b>Boost urutan pencarian</b>
                <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                  Muncul lebih atas di hasil pencarian, boleh ubah nama &amp; nomor WhatsApp, dan mengajar lebih dari 1 bidang ajar. Harga <b>{formatPrice(29000)}</b> / 30 hari.
                </p>
              </div>
              <button className="btn btn--gold" style={{ whiteSpace: 'nowrap' }} disabled={buying} onClick={buyPremium}>
                {buying ? '…' : 'Beli Premium'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TutorProfileForm({ onSaved }) {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [cities, setCities] = useState([]);
  const [customSubject, setCustomSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(user?.photoUrl || '');
  const [form, setForm] = useState({
    name: user?.name || '',
    whatsapp: user?.whatsapp || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    subjects: user?.subjects || [],
    jenjang: user?.jenjang || [],
    city: user?.city || '',
    price: user?.price || '',
    online: user?.online ?? true,
    languages: (user?.languages || []).join(', '),
    experienceYears: user?.experienceYears || '',
    vehicle: user?.vehicle || 'Ada (Sepeda Motor)',
    contactEmail: user?.contactEmail || '',
    availability: (user?.availability || []).join('\n')
  });

  useEffect(() => {
    api.get('/tutors/subjects').then(setSubjects).catch(() => {});
    api.get('/tutors/cities').then((c) => {
      setCities(c.map((item) => item.city));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setForm((f) => ({
      ...f,
      name: user.name || '',
      whatsapp: user.whatsapp || '',
      headline: user.headline || '',
      bio: user.bio || '',
      subjects: user.subjects || [],
      jenjang: user.jenjang || [],
      city: user.city || '',
      price: user.price || '',
      online: user.online ?? true,
      languages: (user.languages || []).join(', '),
      experienceYears: user.experienceYears || '',
      contactEmail: user.contactEmail || '',
      availability: (user.availability || []).join('\n')
    }));
    setPhoto(user.photoUrl || '');
  }, [user?.id]);

  const premiumActive = user?.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date();
  const subjectLimit = premiumActive ? 99 : 1;

  const handlePhoto = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      push('Foto profil harus berupa gambar (JPG/PNG/WebP).', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await uploadFile(file);
      setPhoto(res.url);
      push('Foto diunggah. Klik Simpan Profil untuk menyimpan.');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSubject = (s) => {
    const has = form.subjects.includes(s);
    if (!has && form.subjects.length >= subjectLimit) {
      push('Akun gratis hanya bisa mengajar 1 bidang ajar. Upgrade ke Premium untuk menambah bidang ajar lain.', 'error');
      return;
    }
    setForm((f) => ({
      ...f,
      subjects: has ? f.subjects.filter((x) => x !== s) : [...f.subjects, s]
    }));
  };

  const addCustomSubject = () => {
    const name = customSubject.trim();
    if (!name) return;
    if (form.subjects.includes(name)) {
      push('Bidang ajar itu sudah dipilih.', 'error');
      return;
    }
    if (form.subjects.length >= subjectLimit) {
      push('Akun gratis hanya bisa mengajar 1 bidang ajar. Upgrade ke Premium untuk menambah bidang ajar lain.', 'error');
      return;
    }
    setForm((f) => ({ ...f, subjects: [...f.subjects, name] }));
    setCustomSubject('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.headline || !form.bio || form.subjects.length === 0 || form.jenjang.length === 0 || !form.city || !form.price) {
      push('Lengkapi headline, bio, mata pelajaran, jenjang, kota, dan harga.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        whatsapp: form.whatsapp.trim(),
        headline: form.headline,
        bio: form.bio,
        subjects: form.subjects,
        jenjang: form.jenjang,
        city: form.city,
        price: Number(form.price),
        online: form.online,
        languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
        experienceYears: Number(form.experienceYears) || 0,
        vehicle: form.vehicle,
        contactEmail: form.contactEmail.trim() || null,
        availability: form.availability.split('\n').map((s) => s.trim()).filter(Boolean),
        photoUrl: photo || null
      };
      const updated = await api.patch('/tutors/me', payload);
      updateUser(updated);
      push('Profil tutor berhasil diperbarui!');
      if (onSaved) onSaved();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="detail-main" onSubmit={submit}>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Profil Publik Tutor</h2>
      <p className="text-sm text-muted mb-24">
                  Profil ini akan ditampilkan kepada murid yang mencari tutor. Lengkapi dengan baik agar lebih banyak murid.
      </p>

      {!premiumActive && (
        <div className="premium-card" style={{ marginBottom: 24 }}>
          <div className="flex items-center gap-12">
            <div style={{ fontSize: 28, lineHeight: 1 }}><DiamondIcon size={28} /></div>
            <div style={{ flex: 1 }}>
              <b>Keuntungan Tutor Premium (Rp29.000/bln)</b>
              <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                1) Posisi naik di hasil pencarian &nbsp; 2) Ubah nama &amp; nomor WhatsApp &nbsp;
                3) Mengajar lebih dari 1 bidang ajar.
              </p>
            </div>
            <Link to="/dashboard?tab=status" className="btn btn--gold" style={{ whiteSpace: 'nowrap' }}>
              Upgrade Premium
            </Link>
          </div>
        </div>
      )}

      <div className="field">
        <label>Foto profil</label>
        <div className="flex items-center gap-12">
          {photo ? (
            <img className="photo-preview" style={{ width: 72, height: 72, borderRadius: 20 }} src={photo} alt="Foto profil" />
          ) : (
            <span className="avatar" style={{ width: 72, height: 72, fontSize: 26, backgroundColor: avatarColor(form.name) }}>
              {initials(form.name)}
            </span>
          )}
          <div>
            <label className="file-input">
              <ImageIcon size={15} /> {photo ? 'Ganti foto' : 'Unggah foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handlePhoto(e.target.files[0])} />
            </label>
            <div className="hint">JPG/PNG/WebP. Foto tampil di kartu &amp; halaman profil publik.</div>
          </div>
        </div>
      </div>

      <div className="flex gap-12">
        <div className="field" style={{ flex: 1 }}>
          <label>Nama lengkap {!premiumActive && <span className="text-muted">(Premium)</span>}</label>
          <input
            placeholder="Nama tampil di profil"
            value={form.name}
            disabled={!premiumActive}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {!premiumActive && <div className="hint"><LockIcon size={12} /> Ubah nama hanya untuk tutor Premium.</div>}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Nomor WhatsApp {!premiumActive && <span className="text-muted">(Premium)</span>}</label>
          <input
            inputMode="numeric"
            placeholder="081234567890"
            value={form.whatsapp}
            disabled={!premiumActive}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, '') })}
          />
          {!premiumActive && <div className="hint">🔒 Ubah nomor WhatsApp hanya untuk tutor Premium.</div>}
        </div>
      </div>

      <div className="field">
        <label>Judul / Headline</label>
        <input
                  placeholder="cth: Tutor Matematika SMP-SMA, 10 tahun pengalaman"
          value={form.headline}
          onChange={(e) => setForm({ ...form, headline: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Bio / Deskripsi</label>
        <textarea
          rows={5}
          placeholder="Ceritakan pengalaman, metode mengajar, dan keahlian Anda..."
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Mata pelajaran yang diajarkan</label>
        <div className="hint" style={{ marginBottom: 8 }}>
          {premiumActive
            ? 'Akun Premium: boleh mengajar lebih dari satu bidang.'
            : `Akun gratis: ${form.subjects.length}/1 bidang ajar. Upgrade Premium untuk mengajar lebih banyak bidang.`}
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {form.subjects
            .filter((s) => !subjects.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                className="tag badge--primary"
                style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', border: '1px solid var(--primary)' }}
                onClick={() => toggleSubject(s)}
              >
                {s} <XIcon size={12} />
              </button>
            ))}
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              className={`tag ${form.subjects.includes(s) ? 'badge--primary' : ''}`}
              style={{
                padding: '7px 14px',
                fontSize: 13,
                cursor: 'pointer',
                border: form.subjects.includes(s) ? '1px solid var(--primary)' : '1px solid var(--border)',
                fontWeight: form.subjects.includes(s) ? 700 : 600
              }}
              onClick={() => toggleSubject(s)}
            >
              {form.subjects.includes(s) ? '✓ ' : '+ '}{s}
            </button>
          ))}
        </div>
        <div className="flex gap-8" style={{ marginTop: 10 }}>
          <input
            placeholder="Bidang lain tidak ada di daftar? Tulis di sini…"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomSubject();
              }
            }}
          />
          <button type="button" className="btn btn--outline" onClick={addCustomSubject}>
            Tambah
          </button>
        </div>
      </div>

      <div className="field">
        <label>Jenjang sekolah yang diajar</label>
        <div className="hint" style={{ marginBottom: 8 }}>
          Pilih semua jenjang yang ikut kamu ajar (SD, SMP, UTBK, dsb).
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {JENJANG.map((j) => {
            const on = form.jenjang.includes(j);
            return (
              <button
                key={j}
                type="button"
                className={`tag ${on ? 'badge--primary' : ''}`}
                style={{
                  padding: '7px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  border: on ? '1px solid var(--primary)' : '1px solid var(--border)',
                  fontWeight: on ? 700 : 600
                }}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    jenjang: on ? f.jenjang.filter((x) => x !== j) : [...f.jenjang, j]
                  }))
                }
              >
                {on ? '✓ ' : '+ '}{j}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-12">
        <div className="field" style={{ flex: 1 }}>
          <label>Kota / daerah mengajar</label>
          <input
            list="city-suggest"
            placeholder="cth: Denpasar, Bali"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <datalist id="city-suggest">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="hint">Ketik bebas bila kota/daerah tidak ada di saran.</div>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Harga per jam (Rp)</label>
          <input
            type="number"
            min={0}
            step={5000}
            placeholder="150000"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-12">
        <div className="field" style={{ flex: 1 }}>
          <label>Tahun pengalaman</label>
          <input
            type="number"
            min={0}
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Bahasa pengantar</label>
          <input
            placeholder="Indonesia, Inggris"
            value={form.languages}
            onChange={(e) => setForm({ ...form, languages: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label>Ketersediaan kendaraan</label>
        <select
          value={form.vehicle}
          onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
        >
          <option>Ada (Sepeda Motor)</option>
          <option>Ada (Mobil)</option>
          <option>Ada (Motor &amp; Mobil)</option>
          <option>Tidak Ada</option>
        </select>
        <div className="hint">Ditampilkan di profil Anda sebagai info transportasi ke lokasi murid.</div>
      </div>

      <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          id="online"
          style={{ width: 18, height: 18 }}
          checked={form.online}
          onChange={(e) => setForm({ ...form, online: e.target.checked })}
        />
        <label htmlFor="online" style={{ margin: 0 }}>Bersedia mengajar online</label>
      </div>

      <div className="field">
        <label>Email kontak publik</label>
        <input
          placeholder="cth: budi.santoso@gmail.com"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
                <div className="hint">Ditampilkan ke murid dan bisa dikontak GRATIS tanpa Akses Premium.</div>
      </div>

      <div className="field">
        <label>Ketersediaan jadwal</label>
        <textarea
          rows={3}
          placeholder={'Tulis satu jadwal per baris, cth:\nSenin 16:00-20:00\nSabtu 09:00-14:00'}
          value={form.availability}
          onChange={(e) => setForm({ ...form, availability: e.target.value })}
        />
        <div className="hint">Satu baris untuk satu slot jadwal.</div>
      </div>

      <button className="btn btn--primary btn--lg" disabled={saving}>
        {saving ? 'Menyimpan...' : 'Simpan Profil'}
      </button>
    </form>
  );
}
