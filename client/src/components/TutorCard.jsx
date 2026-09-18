import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPrice, avatarColor, initials, api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarRating from './StarRating';
import { BuildingIcon, MapPinIcon, MonitorIcon, UserIcon, HeartIcon } from './Icons';

export default function TutorCard({ tutor, onFavoriteChange }) {
  const slug = tutor.slug || tutor.id;
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { push: toast } = useToast();
  const isStudent = user?.role === 'student';
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFav(Boolean(isStudent && Array.isArray(user?.favorites) && user.favorites.includes(tutor.id)));
  }, [user, isStudent, tutor.id]);

  const toggleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast('Masuk sebagai murid untuk menyimpan tutor favorit.', 'info');
      navigate('/login');
      return;
    }
    if (!isStudent || busy) return;
    setBusy(true);
    try {
      if (fav) {
        const data = await api.delete(`/favorites/${tutor.id}`);
        setFav(false);
        updateUser({ favorites: data.favorites });
        toast('Dihapus dari favorit.', 'info');
        if (onFavoriteChange) onFavoriteChange(false, tutor.id);
      } else {
        const data = await api.post(`/favorites/${tutor.id}`);
        setFav(true);
        updateUser({ favorites: data.favorites });
        toast('Ditambahkan ke favorit.', 'success');
        if (onFavoriteChange) onFavoriteChange(true, tutor.id);
      }
    } catch (err) {
      toast(err.message || 'Gagal memperbarui favorit.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link to={`/tutor/${slug}`} className="tutor-card">
      {(!user || isStudent) && (
        <button
          type="button"
          className={`tutor-card__fav${fav ? ' is-active' : ''}`}
          aria-label={fav ? 'Hapus dari favorit' : 'Simpan ke favorit'}
          aria-pressed={fav}
          onClick={toggleFav}
        >
          <HeartIcon size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      )}
      <div className="tutor-card__top">
        {tutor.photoUrl ? (
          <img className="avatar avatar--img" src={tutor.photoUrl} alt={tutor.name} />
        ) : (
          <span className="avatar" style={{ backgroundColor: avatarColor(tutor.name) }}>
            {initials(tutor.name)}
          </span>
        )}
        <div>
          <div className="tutor-card__name">
            {tutor.name}
          </div>
          <div className="tutor-card__headline">{tutor.headline}</div>
        </div>
      </div>

      <div className="flex items-center gap-12">
        {tutor.showRating !== false && (
          <span className="flex items-center gap-8">
            <StarRating rating={tutor.rating} />
            <span className="text-sm text-muted">
              {tutor.rating} ({tutor.reviewCount})
            </span>
          </span>
        )}
        <span className={`badge ${tutor.availabilityStatus === 'full' ? 'badge--red' : 'badge--green'}`}>
          {tutor.availabilityStatus === 'full' ? <><span className="status-dot-dot status-dot--red" />Penuh</> : <><span className="status-dot-dot status-dot--green" />Tersedia</>}
        </span>
      </div>

      <div className="tutor-card__tags">
        {tutor.subjects.map((s) => (
          <span key={s} className="tag">
            {s}
          </span>
        ))}
      </div>

      {(tutor.jenjang || []).length > 0 && (
        <div className="tutor-card__jenjang">
          {(tutor.jenjang || []).slice(0, 3).map((j) => (
            <span key={j} className="tag tag--muted">{j}</span>
          ))}
          {(tutor.jenjang || []).length > 3 && (
            <span className="tag tag--muted">+{tutor.jenjang.length - 3}</span>
          )}
        </div>
      )}

      <div className="tutor-card__meta">
        <span><MapPinIcon size={14} /> {tutor.locationName || tutor.city}</span>
        <span>{tutor.online ? <><MonitorIcon size={14} /> Bisa online</> : <><BuildingIcon size={14} /> Tatap muka</>}</span>
        <span><UserIcon size={14} /> {tutor.experienceYears} tahun</span>
      </div>

      <div className="tutor-card__footer">
        <div>
          <span className="price">{formatPrice(tutor.price)}</span> <small>/jam</small>
        </div>
        <span className="btn btn--secondary btn--sm">Lihat Profil</span>
      </div>
    </Link>
  );
}
