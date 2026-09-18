import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice, formatDate } from '../api';
import { useToast } from '../context/ToastContext';

export default function Affiliate() {
  const { push } = useToast();
  const [code, setCode] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/affiliates/lookup?code=${encodeURIComponent(code.trim())}`);
      setData(res);
    } catch (err) {
      push(err.message, 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section" style={{ paddingTop: 40 }}>
      <div className="container">
        <div className="section__head section__head--center">
          <div>
            <div className="section__tag">Affiliate Partner</div>
            <h2 className="section__title">Dashboard Komisi</h2>
            <p className="section__sub">
              Masukkan kode kupon Anda untuk melihat komisi dari setiap transaksi Akses Premium.
            </p>
          </div>
        </div>

        <div className="detail-main" style={{ maxWidth: 560, margin: '0 auto' }}>
          <form className="field" onSubmit={lookup}>
            <label>Kode Kupon</label>
            <div className="flex" style={{ gap: 8 }}>
              <input placeholder="cth: AHMAD10" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn--primary" disabled={loading}>{loading ? '…' : 'Lihat'}</button>
            </div>
          </form>

          {data && (
            <div className="mt-24">
              <div className="stat-cards">
                <div className="stat-card"><b>{data.affiliate.name}</b><span>Affiliate</span></div>
                <div className="stat-card"><b>{data.totalSales}</b><span>Transaksi</span></div>
                <div className="stat-card"><b>{formatPrice(data.totalCommission)}</b><span>Total Komisi</span></div>
              </div>

              <div className="table-wrap mt-24">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Tutor</th>
                      <th>Nilai Transaksi</th>
                      <th>Komisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.length === 0 ? (
                      <tr><td colSpan="4" className="center text-muted">Belum ada transaksi dengan kupon ini.</td></tr>
                    ) : data.sales.map((s) => (
                      <tr key={s.id}>
                        <td className="text-sm">{formatDate(s.createdAt)}</td>
                        <td>{s.tutorName}</td>
                        <td>{formatPrice(s.amount)}</td>
                        <td><b style={{ color: 'var(--success)' }}>{formatPrice(s.commission)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-24" style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 18px' }}>
            <p className="text-sm text-muted" style={{ fontWeight: 700 }}>Kupon demo:</p>
            <p className="text-sm">AHMAD10 (Toko Buku Ahmad) — komisi 10%</p>
            <p className="text-sm">KOMUN15 (Komunitas Belajar) — komisi 15%</p>
          </div>
          <p className="center mt-16 text-sm"><Link to="/">← Kembali ke beranda</Link></p>
        </div>
      </div>
    </section>
  );
}
