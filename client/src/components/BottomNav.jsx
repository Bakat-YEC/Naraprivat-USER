import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { avatarColor, initials } from '../api';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: 22,
  height: 22
};

export default function BottomNav() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
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
  }, []);

  return (
    <nav className={`bottom-nav ${hidden ? 'hidden' : ''}`} aria-label="Navigasi bawah">
      <NavLink to="/" end className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}>
        <svg {...iconProps} aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Beranda</span>
      </NavLink>
      <NavLink to="/tutors" className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}>
        <svg {...iconProps} aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Cari Tutor</span>
      </NavLink>
      <NavLink
        to={user ? '/dashboard' : '/login'}
        className={({ isActive }) => `bottom-nav__item ${isActive ? 'active' : ''}`}
      >
        {user ? (
          <span className="avatar" style={{ width: 22, height: 22, fontSize: 11, backgroundColor: avatarColor(user.name) }}>
            {initials(user.name)}
          </span>
        ) : (
          <svg {...iconProps} aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
        <span>{user ? 'Profil' : 'Masuk'}</span>
      </NavLink>
    </nav>
  );
}