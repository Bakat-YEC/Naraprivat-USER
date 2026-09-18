import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, formatPrice, savePendingPayment } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CreditCardIcon, LandmarkIcon, SmartphoneIcon, WalletIcon } from '../components/Icons';
import AgreeCheckbox from '../components/AgreeCheckbox';

const METHODS = [
  { id: 'qris', label: 'QRIS', icon: SmartphoneIcon, desc: 'Scan pakai aplikasi apa pun (GoPay, OVO, dll)' },
  { id: 'va', label: 'Virtual Account', icon: LandmarkIcon, desc: 'Transfer dari bank mana pun' },
  { id: 'ewallet', label: 'E-Wallet', icon: CreditCardIcon, desc: 'GoPay / OVO / DANA / ShopeePay' },
  { id: 'manual', label: 'Transfer Manual', icon: WalletIcon, desc: 'Transfer ke rekening, konfirmasi ke CS' }
];

export default function Checkout() {
  const [params] = useSearchParams();
  const tutorParam = params.get('tutor') || '';
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [tutor, setTutor] = useState(null);
  const [price, setPrice] = useState(59000);
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [method, setMethod] = useState('qris');
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'student') {
      push('Hanya akun murid yang bisa membeli Akses Premium.', 'error');
      navigate('/dashboard', { replace: true });
      return;
    }
    setBuyer((b) => ({
      name: b.name || user?.name || '',
      email: b.email || (user ? user.email : ''),
      phone: b.phone || (user ? user.phoneOrEmail || user.whatsapp || '' : '')
    }));
    setLoading(true);
    api.get('/payments/price')
      .then((p) => setPrice(p.studentPassPrice || 59000))
      .catch(() => {});
    api.get(`/tutors/${tutorParam}`)
      .then((t) => setTutor(t))
      .catch(() => {
        push('Tutor tidak ditemukan.', 'error');
        navigate('/tutors', { replace: true });
      })
      .finally(() => setLoading(false));
    if (user?.role === 'student') {
      api.get(`/payments/access?tutorId=${tutorParam}`)
        .then((acc) => {
          if (acc.hasAccess) {
            push('Anda sudah memiliki Akses Premium aktif. Silakan hubungi tutor langsung.', 'info');
            navigate(`/tutor/${tutorParam}`, { replace: true });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tutorParam]);

  const validateCoupon = async (e) => {
    e.preventDefault();
    if (!coupon.trim()) return;
    try {
      const res = await api.get(`/affiliates/validate?code=${encodeURIComponent(coupon.trim())}`);
      if (res.valid) {
        setCouponInfo({ ...res.affiliate, discount: res.discount || 10000 });
        push(`Kupon ${res.affiliate.couponCode} valid — potongan ${formatPrice(res.discount || 10000)}. Komisi dicatat untuk ${res.affiliate.name}!`);
      } else {
        setCouponInfo(null);
        push(res.message, 'error');
      }
    } catch (err) {
      push(err.message, 'error');
    }
  };

  const proceed = async () => {
    const name = buyer.name.trim();
    const email = buyer.email.trim().toLowerCase();
    const phone = buyer.phone.trim();
    if (!name) { push('Nama lengkap wajib diisi.', 'error'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { push('Format email tidak valid.', 'error'); return; }
    if (!phone) { push('Nomor WhatsApp wajib diisi.', 'error'); return; }
    if (!agreed) {
      push('Centang persetujuan Syarat dan Ketentuan serta Kebijakan Privasi dulu.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/payments/student-pass', {
        tutorId: tutor.id,
        couponCode: couponInfo ? couponInfo.couponCode : (coupon.trim() || null),
        buyer: { name, email, phone }
      });
      if (res.alreadyHasAccess) {
        push('Anda sudah memiliki Akses Premium aktif. Silakan lanjut ke WhatsApp tutor.', 'info');
        navigate(`/tutor/${res.tutorSlug || tutor.slug || tutor.id}`, { replace: true });
        return;
      }
      savePendingPayment({
        transactionId: res.transaction.id,
        sessionToken: res.sessionToken,
        tutorSlug: tutor.slug || tutor.id,
        tutorName: tutor.name,
        amount: res.transaction.totalAmount != null ? res.transaction.totalAmount : res.transaction.amount
      });
      if (res.couponError && !res.couponValid) push(res.couponError, 'error');
      navigate(res.paymentUrl);
    } catch (err) {
      push(err.message, 'error');
      setCreating(false);
    }
  };

  if (loading) return <div className="spinner" />;
  if (!tutor) return null;

  const discount = couponInfo ? couponInfo.discount : 0;
  const total = Math.max(0, price - discount);

  return (
    <section className="section section--checkout">
      <div className="container container--checkout">
        <div className="checkout">
          {/* RIGHT: data diri + pembayaran */}
          <div className="checkout__pay">
            <div className="detail-main">
              <div className="pass-hero">
                <p className="pass-hero__desc">Buka <b>kontak WhatsApp</b> seluruh <b>tutor privat</b> di <b>semua kota</b> tanpa batas.</p>
                <hr className="pass-hero__divider" />
                <div className="pass-hero__price">
                  <span className="pass-hero__label">Sekali Bayar</span>
                  <span className="pass-hero__amount">{formatPrice(price)} <small>/ 7 hari</small></span>
                </div>
              </div>

              <form
                className="checkout-buyer"
                onSubmit={(e) => { e.preventDefault(); proceed(); }}
              >
                <div className="field">
                  <label>Nama lengkap</label>
                  <input
                    placeholder="cth: Nadia Kirana"
                    value={buyer.name}
                    onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="cth: nadia@email.com"
                    value={buyer.email}
                    onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
                  />
                  <div className="hint">
                    Akun (username &amp; password) <b>dikirim ke email ini</b> setelah pembayaran sukses.
                  </div>
                </div>
                <div className="field">
                  <label>Nomor WhatsApp</label>
                  <input
                    inputMode="numeric"
                    placeholder="08123456789"
                    value={buyer.phone}
                    onChange={(e) => setBuyer({ ...buyer, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </form>

              <div className="checkout-bill">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Harga asli Akses Premium</span>
                  <b className="price" style={{ fontSize: 20 }}>{formatPrice(price)}</b>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Potongan kupon (<b>{couponInfo.couponCode}</b>)</span>
                    <b className="text-sm" style={{ color: 'var(--green)' }}>-{formatPrice(discount)}</b>
                  </div>
                )}
                <div className="checkout-bill__total">
                  <span>Total yang harus dibayar</span>
                  <b className="price">{formatPrice(total)}</b>
                </div>
              </div>

              <form className="mt-16" onSubmit={validateCoupon}>
                <div className="field coupon-row">
                  <input
                    placeholder="Kode kupon affiliate? (cth: AHMAD10)"
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value); setCouponInfo(null); }}
                  />
                  <button className="btn btn--outline btn--sm" type="submit">Pakai</button>
                </div>
                {couponInfo && (
                  <div className="text-sm coupon-ok">
                    ✓ Kupon <b>{couponInfo.couponCode}</b> valid — potongan <b>{formatPrice(couponInfo.discount)}</b>. Komisi dicatat untuk <b>{couponInfo.name}</b>.
                  </div>
                )}
              </form>

              <div className="field mt-16">
                <label>Metode pembayaran</label>
                <div className="pay-methods">
{METHODS.map((m) => {
                        const IconC = m.icon;
                        return (
                      <button
                        type="button"
                        key={m.id}
                        className={`method ${method === m.id ? 'active' : ''}`}
                        onClick={() => setMethod(m.id)}
                      >
                        <span className="method__icon">{IconC && <IconC size={22} />}</span>
                      <div className="method__body">
                        <b>{m.label}</b>
                        <div className="text-sm text-muted">{m.desc}</div>
                      </div>
                      <span className="method__check">✓</span>
                    </button>
                    );
                  })}
                </div>
              </div>

              <AgreeCheckbox id="agree-checkout" checked={agreed} onChange={setAgreed} />
              <button className="btn btn--primary btn--lg btn--block checkout-cta" disabled={creating || !agreed} onClick={proceed}>
                {creating ? 'Menghubungkan ke Payment Gateway…' : `Lanjutkan ke Pembayaran • ${formatPrice(total)}`}
              </button>
              <p className="text-sm text-muted center mt-8 checkout-note">
                Demo: pembayaran disimulasikan (<b>mode sandbox</b>). Sesi Anda <b>aman tersimpan</b>.
              </p>
              <div className="center mt-16">
                <Link to={`/tutor/${tutor.slug || tutor.id}`} className="text-sm">← Kembali ke profil tutor</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}