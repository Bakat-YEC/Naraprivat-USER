import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PasswordField from '../components/PasswordField';

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(form.email, form.password, role);
      if (result.isAdmin) {
        push(`Selamat datang di panel admin, ${result.name.split(' ')[0]}!`);
        navigate('/admin', { replace: true });
        return;
      }
      push(`Selamat datang kembali, ${result.name.split(' ')[0]}!`);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <h1>Masuk</h1>
        <p className="auth-sub">Lanjutkan perjalanan belajarmu bersama Naraprivat.</p>
        <form onSubmit={handleSubmit}>
          <div className="role-switch">
            <span className="role-switch__label">Masuk sebagai ?</span>
            <div className="role-switch__tabs">
              <button
                type="button"
                className={`role-switch__tab ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
              >
                Murid
              </button>
              <button
                type="button"
                className={`role-switch__tab ${role === 'tutor' ? 'active' : ''}`}
                onClick={() => setRole('tutor')}
              >
                Tutor
              </button>
            </div>
          </div>
          <div className="field">
            <label>Email / Username</label>
            <input
              placeholder="nama@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <PasswordField
            label="Password"
            placeholder="••••••••"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            required
            autoComplete="current-password"
          />
          <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
            <Link className="auth-link text-sm" to="/forgot-password">
              Lupa password?
            </Link>
          </div>
          {error && <div className="field-error mb-16">{error}</div>}
          <button className="btn btn--primary btn--block btn--lg" disabled={loading}>
            {loading ? 'Memproses...' : role === 'tutor' ? 'Masuk Sebagai Tutor' : 'Masuk Sebagai Murid'}
          </button>
        </form>
        <p className="center text-muted text-sm mt-16">
          Belum punya akun? <Link className="auth-link" to="/register?role=student">Daftar Murid mandiri</Link>
        </p>
        <p className="center text-muted text-sm mt-8">
          Ingin jadi tutor? <Link className="auth-link" to="/register?role=tutor">Daftar Jadi Tutor</Link>
        </p>
        <div className="mt-24" style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px' }}>
          <p className="text-sm text-muted" style={{ fontWeight: 700 }}>Akun demo:</p>
          <p className="text-sm">Murid: <b>nadia@tutorlink.id</b> / password123</p>
          <p className="text-sm">Tutor: <b>tutor@tutorlink.id</b> / password123</p>
          <p className="text-sm">Admin: <b>admin.system@naraprivat.id</b> / password123 <span className="text-muted">(otomatis ke dashboard admin)</span></p>
          <p className="text-xs text-muted mt-8" style={{ opacity: 0.85 }}>
            Email &amp; password yang sama bisa dipakai untuk dua peran.
          </p>
        </div>
      </div>
    </div>
  );
}
