import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, formatPrice, avatarColor, initials, buildWhatsappLink } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarRating from '../components/StarRating';
import { openSupport } from '../components/SupportWidget';
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  CrownIcon,
  FileTextIcon,
  GraduationCapIcon,
  MapPinIcon,
  MessageCircleIcon,
  StarFilledIcon,
  XIcon
} from '../components/Icons';

export default function TutorDetail() {
  const { slug, id } = useParams();
  const key = slug || id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { push } = useToast();
  const [tutor, setTutor] = useState(null);
  const [access, setAccess] = useState(null);
  const [passPrice, setPassPrice] = useState(59000);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [viewCert, setViewCert] = useState(null);
  const showRating = tutor ? tutor.showRating !== false : true;

  useEffect(() => {
    setLoading(true);
    api.get(`/tutors/${key}`)
      .then((t) => {
        setTutor(t);
      })
      .catch(() => setTutor(null))
      .finally(() => setLoading(false));
    api.get('/payments/price')
      .then((p) => setPassPrice(p.studentPassPrice || 59000))
      .catch(() => {});
  }, [key]);

  useEffect(() => {
    if (user?.role === 'student' && tutor) {
      setCheckingAccess(true);
      api.get(`/payments/access?tutorId=${tutor.id}`)
        .then(setAccess)
        .catch(() => setAccess(null))
        .finally(() => setCheckingAccess(false));
    } else {
      setAccess(null);
    }
  }, [user, tutor?.id]);

  const submitReport = async () => {
    setSendingReport(true);
    try {
      await api.post(`/tutors/${tutor.id}/report`, { note: reportNote });
      push('Terima kasih. Laporan Anda akan ditinjau tim operasional.');
      setReportOpen(false);
      setReportNote('');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSendingReport(false);
    }
  };

  if (loading) return <div className="spinner" />;
  if (!tutor) {
    return (
      <section className="section">
        <div className="container">
          <div className="empty">
            <b>Tutor tidak ditemukan</b>
            <Link to="/tutors">← Kembali ke daftar tutor</Link>
          </div>
        </div>
      </section>
    );
  }

  const isFull = tutor.availabilityStatus === 'full';
  const canChat = user?.role === 'student' && access?.hasAccess;
  const firstSubject = tutor.subjects[0] || '';
  const waMessage = `Halo ${tutor.name}, saya ${user?.name || 'murid'} menemukan profil Anda di NARAPRIVAT. Saya tertarik dengan les ${firstSubject}. Apakah masih tersedia? Saya ingin mendiskusikan jadwalnya.`;
  const locationText = tutor.locationPath?.length ? tutor.locationPath.join(', ') : tutor.locationName || tutor.city;

  const handleContactClick = () => {
    if (isFull) {
      push('Tutor sedang penuh. Silakan cari tutor lain.', 'error');
      return;
    }
    if (user?.role === 'tutor') {
      push('Akun tutor tidak bisa membeli Akses Premium. Gunakan akun murid.', 'error');
      return;
    }
    if (canChat) {
      api.post(`/tutors/${tutor.id}/unlock`).catch(() => {});
      window.open(buildWhatsappLink(tutor.whatsapp, waMessage), '_blank', 'noreferrer');
      return;
    }
    navigate(`/checkout?tutor=${tutor.slug || tutor.id}`);
  };

  return (
    <>
      <section className="section pdp-section">
        <div className="container">
          <Link to="/tutors" className="pdp-back">
            <ArrowLeftIcon size={15} /> Kembali ke Hasil Pencarian
          </Link>

          <div className="pdp-card">
            <div className="pdp-hero">
              <div className="pdp-hero__main">
                <div className="pdp-photo-col">
                  {tutor.photoUrl ? (
                    <img className="pdp-photo" src={tutor.photoUrl} alt={tutor.name} />
                  ) : (
                    <span className="pdp-photo pdp-photo--initial" style={{ backgroundColor: avatarColor(tutor.name) }}>
                      {initials(tutor.name)}
                    </span>
                  )}
                  {isFull
                    ? <span className="pdp-avail pdp-avail--red"><span className="status-dot-dot status-dot--red" /> Penuh</span>
                    : <span className="pdp-avail pdp-avail--green"><span className="status-dot-dot status-dot--green" /> Tersedia</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="pdp-name-row">
                    <h1>{tutor.name}</h1>
                    {tutor.isPremium && (
                      <span className="pdp-premium"><CrownIcon size={11} /> Rekomendasi</span>
                    )}
                  </div>
                  <div className="pdp-headline">
                    <GraduationCapIcon size={15} /> {tutor.headline || 'Pengajar Berpengalaman'}
                  </div>
                  <div className="pdp-meta">
                    {showRating && (
                      <span className="pdp-star"><StarFilledIcon size={14} /> {tutor.rating}</span>
                    )}
                    {showRating && <span>({tutor.reviewCount} Ulasan)</span>}
                    <span><MapPinIcon size={13} /> {locationText}</span>
                  </div>
                </div>
              </div>

              <div className="pdp-price-box">
                <span className="pdp-price-label">Tarif Mulai Dari</span>
                <div className="pdp-price">{formatPrice(tutor.price)} <small>/ jam</small></div>
                <button
                  type="button"
                  className="btn btn--success pdp-cta"
                  disabled={checkingAccess || isFull}
                  onClick={handleContactClick}
                >
                  <MessageCircleIcon size={16} />
                  {isFull ? 'Tutor sedang penuh' : canChat ? 'Chat WhatsApp' : 'Hubungi Tutor via WhatsApp'}
                </button>
                {!isFull && !canChat && (
                  <div className="pdp-cta-note">
                    {checkingAccess
                      ? 'Memeriksa akses…'
                      : `Akses Premium ${formatPrice(access?.passPrice || passPrice)} — sekali bayar, akses WhatsApp semua tutor.`}
                  </div>
                )}
              </div>
            </div>

            <div className="pdp-body">
              <div className="pdp-left">
                {(tutor.educationHistory || []).length > 0 && (
                  <div className="pdp-block">
                    <h3 className="pdp-h">Riwayat Pendidikan</h3>
                    <div className="pdp-edu">
                      {tutor.educationHistory.map((e, i) => (
                        <div key={i} className="pdp-edu-item">
                          <div style={{ minWidth: 0 }}>
                            <span className="pdp-edu-school">{e.institution || e.degree}</span>
                            {e.institution && e.degree && <span className="pdp-edu-degree">{e.degree}</span>}
                          </div>
                          {e.year && <span className="pdp-edu-year">{e.year}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(tutor.certificates || []).length > 0 && (
                  <div className="pdp-block">
                    <h3 className="pdp-h">Sertifikat Penunjang</h3>
                    <div className="pdp-certs">
                      {tutor.certificates.map((c) => {
                        const viewable = c.previewUrl || (c.url && /\.(png|jpe?g|webp)$/i.test(c.url));
                        const inner = (
                          <>
                            <span className="pdp-cert__icon"><FileTextIcon size={18} /></span>
                            <div style={{ minWidth: 0 }}>
                              <span className="pdp-cert__title">{c.name}</span>
                              <span className="pdp-cert__status"><CheckIcon size={11} /> Terverifikasi</span>
                            </div>
                          </>
                        );
                        return viewable ? (
                          <button key={c.id} type="button" className="pdp-cert pdp-cert--btn" onClick={() => setViewCert(c)}>
                            {inner}
                          </button>
                        ) : (
                          <span key={c.id} className="pdp-cert">{inner}</span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pdp-block" style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <h3 className="pdp-h">Tentang Pengajar</h3>
                  <p className="pdp-about">{tutor.bio || 'Belum ada deskripsi.'}</p>
                </div>

                <div className="pdp-block">
                  <h3 className="pdp-h">Bidang Ajar</h3>
                  <div className="pdp-chips">
                    {tutor.subjects.map((s) => (
                      <Link key={s} to={`/tutors?subject=${encodeURIComponent(s)}`} className="pdp-chip">{s}</Link>
                    ))}
                  </div>
                </div>

                {(tutor.jenjang || []).length > 0 && (
                  <div className="pdp-block">
                    <h3 className="pdp-h">Jenjang Sekolah</h3>
                    <div className="pdp-chips">
                      {tutor.jenjang.map((j) => (
                        <Link key={j} to={`/tutors?jenjang=${encodeURIComponent(j)}`} className="pdp-chip">{j}</Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <aside className="pdp-info">
                <h4 className="pdp-info-title">Informasi Les</h4>
                <div className="pdp-info-row">
                  <span>Tipe Mengajar</span>
                  <b>{tutor.online ? 'Online & Datang ke Rumah' : 'Datang ke Rumah (Tatap Muka)'}</b>
                </div>
                <div className="pdp-info-row">
                  <span>Tingkat Pendidikan Sasaran</span>
                  <b>{(tutor.jenjang || []).join(', ') || '—'}</b>
                </div>
                <div className="pdp-info-row">
                  <span>Pengalaman Mengajar</span>
                  <b>{tutor.experienceYears || 0} tahun</b>
                </div>
                <div className="pdp-info-row">
                  <span>Ketersediaan Kendaraan</span>
                  <b>{tutor.vehicle || 'Ada (Sepeda Motor)'}</b>
                </div>
                <div className="pdp-info-row">
                  <span>Bahasa Pengantar</span>
                  <b>{(tutor.languages || []).join(', ') || 'Bahasa Indonesia'}</b>
                </div>
                <div className="pdp-info-row">
                  <span>Status Ketersediaan</span>
                  <b>
                    {isFull
                      ? <span className="badge badge--red"><span className="status-dot-dot status-dot--red" /> Penuh</span>
                      : <span className="badge badge--green"><span className="status-dot-dot status-dot--green" /> Tersedia</span>}
                  </b>
                </div>
                <div className="pdp-info-row">
                  <span>Member Sejak</span>
                  <b>{formatDate(tutor.memberSince)}</b>
                </div>

                <div className="pdp-info-contact">
                  {isFull ? (
                    <div className="pdp-note">
                      <b style={{ color: 'var(--red)' }}>Tutor sedang penuh.</b> WhatsApp tidak dapat dihubungi.
                    </div>
                  ) : (
                    <>
                      {canChat && (
                        <button type="button" className="pdp-report" onClick={() => setReportOpen(true)}>
                          <AlertIcon size={13} /> Laporkan nomor tidak aktif
                        </button>
                      )}
                      {access?.lastPass && !canChat && (
                        <div className="pdp-note">
                          Pass Anda aktif sejak {formatDate(access.lastPass.paidAt)}.{' '}
                          <button type="button" className="btn-link" onClick={openSupport}>Hubungi CS</button> bila bermasalah.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </aside>

              <div className="pdp-reviews">
                <div className="pdp-reviews-head">
                  <h3 className="pdp-h" style={{ marginBottom: 0 }}>Ulasan &amp; Testimoni Murid</h3>
                  {showRating && (
                    <span className="pdp-review-badge">
                      <StarFilledIcon size={12} /> {tutor.rating} ({tutor.reviewCount} Ulasan)
                    </span>
                  )}
                </div>

                {tutor.reviews.length > 0 ? (
                  tutor.reviews.map((r) => (
                    <div key={r.id} className="pdp-review">
                      <div className="pdp-review__top">
                        <div className="pdp-review__person">
                          <span className="pdp-review__avatar">{initials(r.studentName)}</span>
                          <div>
                            <span className="pdp-review__name">{r.studentName}</span>
                            <span className="pdp-review__time">{formatDate(r.createdAt)}</span>
                          </div>
                        </div>
                        {showRating && <StarRating rating={r.rating} size="sm" />}
                      </div>
                      {r.comment && <p className="pdp-review__quote">"{r.comment}"</p>}
                    </div>
                  ))
                ) : (
                  <div className="pdp-empty">Belum ada ulasan publik untuk pengajar ini.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {reportOpen && (
        <div className="modal-overlay" onClick={() => setReportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4 }}>Laporkan nomor tidak aktif</h3>
            <p className="text-sm text-muted mb-16">Bantu kami menjaga kualitas. Tim operasional akan meninjau laporan ini.</p>
            <div className="field">
              <label>Catatan (opsional)</label>
              <textarea
                rows={3}
                placeholder="cth: nomor tidak bisa dihubungi saat saya telepon..."
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
              />
            </div>
            <button className="btn btn--primary btn--block" disabled={sendingReport} onClick={submitReport}>
              {sendingReport ? 'Mengirim…' : 'Kirim Laporan'}
            </button>
          </div>
        </div>
      )}

      {viewCert && (
        <div className="modal-overlay" onClick={() => setViewCert(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>{viewCert.name}</h3>
              <button className="icon-btn" aria-label="Tutup" onClick={() => setViewCert(null)}>
                <XIcon size={18} />
              </button>
            </div>
            {viewCert.previewUrl || (viewCert.url && /\.(png|jpe?g|webp)$/i.test(viewCert.url)) ? (
              <img
                src={viewCert.previewUrl || viewCert.url}
                alt={viewCert.name}
                style={{ width: '100%', borderRadius: 12 }}
              />
            ) : (
              <div className="empty" style={{ padding: 24 }}>
                <b style={{ fontSize: 15 }}>Preview tidak tersedia</b>
                <span className="text-sm text-muted">
                  File sertifikat ini tidak bisa ditampilkan tanpa menyediakan unduhan. Preview gambar belum tersedia.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
