import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatPrice, clearPendingPayment } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CheckIcon, LockIcon, RefreshIcon, XIcon } from '../components/Icons';

const PAYMENT_METHODS = [
  'Virtual Account BCA',
  'Virtual Account Mandiri',
  'Virtual Account BNI',
  'QRIS',
  'GoPay',
  'OVO',
  'DANA',
  'Kartu Kredit/Debit',
  'Transfer Manual'
];

export default function MockGateway() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const { refresh, login } = useAuth();
  const [tx, setTx] = useState(null);
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);

  const load = () => {
    api.get(`/payments/transaction/${id}`)
      .then(setTx)
      .catch(() => setTx(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const poll = setInterval(() => {
      api.get(`/payments/transaction/${id}`).then(setTx).catch(() => {});
    }, 3000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const act = async (action) => {
    setProcessing(true);
    try {
      const res = await api.post(`/payments/mock/${id}/${action}`, action === 'pay' ? { method } : {});
      if (action === 'pay' && res?.transaction?.autoCredentials) {
        setCreds(res.transaction.autoCredentials);
      }
      load();
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // auto-login (untuk akun yang baru dibuat) lalu kembali ke profil tutor
  useEffect(() => {
    if (tx?.paymentStatus === 'success') {
      clearPendingPayment();
      if (creds) {
        login(String(tx.buyerEmail || creds.username), creds.password)
          .then(refresh)
          .catch(refresh);
      } else {
        refresh();
      }
      if (tx.returnUrl) {
        const t = setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) {
              clearInterval(t);
              navigate(tx.returnUrl);
              return 0;
            }
            return c - 1;
          });
        }, 1000);
        return () => clearInterval(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx?.paymentStatus, creds]);

  if (loading) return <div className="spinner" />;

  if (tx?.paymentStatus === 'success') {
    return (
      <section className="section section--checkout">
        <div className="container container--checkout">
            <div className="gateway-result gateway-result--success">
            <div className="gateway-result__icon"><CheckIcon size={44} /></div>
            <h2>Pembayaran Berhasil!</h2>
              <p><b>Akses Premium aktif.</b> Akun murid otomatis dibuat untuk Anda.</p>

            {creds && (
              <div className="creds-box">
                <b style={{ color: 'var(--green)' }}><LockIcon size={14} /> Akun berhasil dibuat — kredensial dikirim ke {tx?.buyerEmail}</b>
                <div className="creds-box__row">
                  <span>Username</span>
                  <b>{creds.username}</b>
                </div>
                <div className="creds-box__row">
                  <span>Password</span>
                  <b>{creds.password}</b>
                </div>
                <div className="hint">
                  (Demo: tanpa server email, kredensial ditampilkan di sini. Saat terhubung SMTP, akan dikirim otomatis.)
                </div>
              </div>
            )}

            {!creds && (
              <p className="text-sm mt-8">
                Anda sudah login. Mengembalikan ke profil tutor dalam {countdown} detik…
              </p>
            )}
            <div className="flex gap-12" style={{ justifyContent: 'center', marginTop: 16 }}>
              <Link to={tx.returnUrl} className="btn btn--primary">Kembali ke Tutor Sekarang</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (tx?.paymentStatus === 'failed') {
    return (
      <section className="section section--checkout">
        <div className="container container--checkout">
          <div className="gateway-result gateway-result--failed">
            <div className="gateway-result__icon"><XIcon size={44} /></div>
            <h2>Pembayaran Gagal</h2>
            <p>Transaksi <b>dibatalkan atau gagal</b>. Silakan coba lagi.</p>
            <div className="flex gap-12" style={{ justifyContent: 'center' }}>
              <Link to={tx.returnUrl} className="btn btn--outline">Kembali ke Tutor</Link>
              <button className="btn btn--primary" onClick={() => navigate(`/checkout?tutor=${(tx.tutorId || '').split('?')[0] || ''}`)}>Coba Lagi</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section section--checkout">
      <div className="container container--checkout">
        <div className="checkout">
          <div className="detail-main">
            <div className="section__tag">Payment Gateway (Demo / Sandbox)</div>
            <h2 className="section__title" style={{ fontSize: 22 }}>Selesaikan Pembayaran</h2>
            <p className="gateway-lead">
              Satu langkah lagi. Bayar <b>sesuai nominal tepat</b> sebelum sesi berakhir — akses WhatsApp tutor
              aktif <b>otomatis</b> setelah pembayaran sukses.
            </p>

            <div className="gateway-bill">
              <div className="gateway-bill__row">
                <span>Tagihan</span>
                <b>{tx?.type === 'tutor_premium' ? 'Paket Tutor Premium' : 'Akses Premium'}</b>
              </div>
              <div className="gateway-bill__row">
                <span>Status</span>
                <span className="badge badge--amber">Menunggu Pembayaran</span>
              </div>
              <div className="gateway-bill__row">
                <span>ID Transaksi</span>
                <code className="code">{tx?.id}</code>
              </div>
              {tx?.uniqueCode != null && (
                <div className="gateway-bill__row">
                  <span>Kode Unik</span>
                  <b>{tx.uniqueCode}</b>
                </div>
              )}
              <div className="gateway-bill__total">
                <span>Total Pembayaran</span>
                <b className="price">{formatPrice(tx?.totalAmount != null ? tx.totalAmount : (tx?.amount || 0))}</b>
              </div>
            </div>

            <div className="field" style={{ marginTop: 16 }}>
              <label>Metode Pembayaran</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={processing}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="hint">
                {method === 'Transfer Manual'
                  ? <>Transfer <b>sesuai nominal tepat</b> (termasuk kode unik), lalu <b>konfirmasi ke CS</b> via WhatsApp.</>
                  : <>Pilihan metode akan <b>tersimpan di riwayat</b> pembayaran Anda.</>}
              </div>
            </div>

            <div className="gateway-mock-actions">
              <button className="btn btn--success btn--lg btn--block" disabled={processing} onClick={() => act('pay')}>
                {processing ? 'Memproses…' : 'Bayar Sekarang (Simulasi Sukses)'}
              </button>
              <div className="gateway-actions">
                <button className="btn btn--outline btn--sm" disabled={processing} onClick={() => act('fail')}>
                  Simulasikan Gagal
                </button>
                <button className="btn btn--ghost btn--sm" onClick={load}>
                  <RefreshIcon size={14} /> Cek Status Pembayaran
                </button>
              </div>
            </div>

            <p className="text-sm text-muted center mt-16 gateway-note">
              Ini <b>gateway tiruan</b> untuk demo. Saat integrasi asli, Anda akan diarahkan ke Midtrans/Xendit
              dan dipulangkan <b>otomatis</b> ke profil tutor via webhook.
            </p>
            <div className="center mt-8">
              <Link to={tx?.returnUrl || '/'} className="text-sm">Batalkan &amp; kembali</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
