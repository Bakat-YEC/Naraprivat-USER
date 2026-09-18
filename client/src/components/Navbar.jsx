import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { avatarColor, initials } from '../api';
import {
  HomeIcon,
  KeyIcon,
  LayoutDashboardIcon,
  LinkIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  ShieldIcon,
  StarIcon,
  UserIcon,
  UserPlusIcon,
  XIcon
} from './Icons';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isHome = location.pathname === '/';

  useEffect(() => {
    if (!isMobile || !isHome) {
      setHidden(false);
      return;
    }
    const onScroll = () => {
      const y = window.scrollY;
      const dir = y > lastY.current ? 'down' : 'up';
      lastY.current = y;
      if (y < 80) {
        setHidden(false);
        return;
      }
      setHidden(dir === 'down');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile, isHome]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  const close = () => setOpen(false);

  if (isMobile && !isHome) return null;

  return (
    <header className={`navbar ${hidden ? 'navbar--hidden' : ''}`}>
      <div className="container navbar__inner">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand__logo">N</span>
          Naraprivat
        </Link>
        <nav className="navbar__links">
          <NavLink to="/" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`} end>
            Beranda
          </NavLink>
          <NavLink to="/tutors" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
            Cari Tutor
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
        </nav>

        <button className="navbar__search" onClick={() => navigate('/tutors')}>
          <SearchIcon size={16} /> Cari tutor, subjek, atau lokasi…
        </button>

        <div className="navbar__actions">
          {user ? (
            <>
              {user.role === 'tutor' && (
                <Link to="/dashboard?tab=status" className="btn btn--secondary btn--sm hide-mobile" onClick={close}>
                  <span className="availability-dot" /> Status
                </Link>
              )}
              <Link to="/dashboard" className="flex items-center gap-8" onClick={close} title={user.role === 'student' && user.studentPass?.hasPass ? 'Akses Premium aktif — akses WhatsApp semua tutor' : undefined}>
                {user.photoUrl ? (
                  <img className="avatar avatar--img" src={user.photoUrl} alt={user.name} />
                ) : (
                  <span className="avatar" style={{ backgroundColor: avatarColor(user.name) }}>
                    {initials(user.name)}
                  </span>
                )}
                <span className="text-sm" style={{ fontWeight: 800 }}>
                  {user.name.split(' ')[0]}
                </span>
                {user.role === 'student' && user.studentPass?.hasPass && (
                  <span className="pass-badge" title="Akses Premium aktif"><StarIcon size={11} /></span>
                )}
              </Link>
              <button className="btn btn--ghost btn--sm hide-mobile" onClick={handleLogout}>
                Keluar
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--sm hide-mobile" onClick={close}>
                Masuk
              </Link>
              <Link to="/register?role=tutor" className="btn btn--primary btn--sm hide-mobile" onClick={close}>
                Daftar Jadi Tutor
              </Link>
            </>
          )}
          {!user && (
            <Link
              to="/login"
              className="nav-avatar"
              onClick={close}
              aria-label="Masuk"
            >
              <UserIcon size={20} />
            </Link>
          )}
          <button
            className="navbar__burger"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <XIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      <div className={`navbar__mobile ${open ? 'open' : ''}`}>
        <Link to="/" onClick={close}><HomeIcon size={18} /> Beranda</Link>
        <Link to="/tutors" onClick={close}><SearchIcon size={18} /> Cari Tutor</Link>
        <Link to="/register?role=tutor" onClick={close}><UserPlusIcon size={18} /> Daftar Jadi Tutor</Link>
        <Link to="/dashboard" onClick={close}><LayoutDashboardIcon size={18} /> Dashboard</Link>
        <Link to="/admin" onClick={close}><ShieldIcon size={18} /> Admin</Link>
        <a href="https://naraprivate-affiliate-6868.ai.studio/" target="_blank" rel="noopener noreferrer" onClick={close}><LinkIcon size={18} /> Affiliate</a>
        {!user && <Link to="/login" onClick={close}><KeyIcon size={18} /> Masuk</Link>}
        {user && (
          <button className="btn btn--ghost" style={{ justifyContent: 'flex-start', paddingLeft: 14 }} onClick={handleLogout}>
            <LogOutIcon size={18} /> Keluar
          </button>
        )}
      </div>
    </header>
  );
}
