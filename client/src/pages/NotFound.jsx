import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <div className="empty">
          <b>404 — Halaman tidak ditemukan</b>
          Halaman yang Anda cari mungkin telah dipindahkan atau tidak tersedia.
          <div className="mt-16">
            <Link to="/" className="btn btn--primary">Kembali ke Beranda</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
