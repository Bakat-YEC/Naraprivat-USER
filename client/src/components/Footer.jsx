import { Link } from 'react-router-dom';
import { openSupport } from './SupportWidget';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="brand" style={{ color: '#fff' }}>
              <span className="brand__logo">N</span>
              Naraprivat
            </div>
            <p style={{ marginTop: 12, maxWidth: 320, fontSize: 14 }}>
              Marketplace tutor &amp; trainer terbesar di Indonesia. Temukan tutor privat terbaik
              untuk mata pelajaran apa pun — online maupun tatap muka.
            </p>
          </div>
          <div>
            <h4>Jelajahi</h4>
            <Link to="/tutors">Cari Tutor</Link>
            <Link to="/tutors?subject=Matematika">Tutor Matematika</Link>
            <Link to="/tutors?subject=Programming">Tutor Programming</Link>
            <Link to="/tutors?subject=Bahasa Inggris">Tutor Bahasa Inggris</Link>
          </div>
          <div>
            <h4>Akun</h4>
            <Link to="/login">Masuk Murid/Tutor</Link>
            <Link to="/register?role=tutor">Daftar Tutor</Link>
          </div>
          <div>
            <h4>Bisnis</h4>
            <a href="https://naraprivate-affiliate-6868.ai.studio/" target="_blank" rel="noopener noreferrer">Program Affiliate</a>
            <Link to="/admin">Admin Login</Link>
          </div>
          <div>
            <h4>Kontak</h4>
            <p style={{ fontSize: 14 }}>halo@naraprivat.id</p>
            <button className="footer-link" onClick={openSupport}>Hubungi CS / Bantuan</button>
            <p style={{ fontSize: 14 }}>Jakarta, Indonesia</p>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Naraprivat. Semua hak dilindungi.</span>
          <span>Dibuat dengan hati untuk pendidikan Indonesia</span>
        </div>
      </div>
    </footer>
  );
}
