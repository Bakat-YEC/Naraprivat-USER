import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import PasswordField from '../components/PasswordField';
import { MailIcon, RefreshIcon } from '../components/Icons';

export default function ForgotPassword() {
  const { push } = useToast();
  const [step, setStep] = useState('ask');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [expiresIn, setExpiresIn] = useState(30);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const askReset = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.resetToken) {
        setToken(res.resetToken);
        setTokenInput(res.resetToken);
        setExpiresIn(res.expiresInMinutes || 30);
        setStep('token');
      } else {
        setErr(res.message);
      }
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setErr('');
    if (!tokenInput.trim()) {
      setErr('Kode reset wajib diisi.');
      return;
    }
    if (pwd.length < 6) {
      setErr('Password baru minimal 6 karakter.');
      return;
    }
    if (pwd !== pwd2) {
      setErr('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token: tokenInput.trim(), password: pwd });
      push(res.message);
      setStep('done');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        {step === 'ask' && (
          <>
            <h1>Lupa Password</h1>
            <p className="auth-sub">
              Masukkan email atau username yang terdaftar. Kami akan mengirim kode reset ke email Anda.
            </p>
            <form onSubmit={askReset}>
              <div className="field">
                <label>Email / Username</label>
                <input
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {err && <div className="field-error mb-16">{err}</div>}
              <button className="btn btn--primary btn--block btn--lg" disabled={loading}>
                {loading ? 'Mengirim...' : 'Kirim Instruksi Reset'}
              </button>
            </form>
            <p className="center text-muted text-sm mt-16">
              <MailIcon size={13} /> Sudah ingat password? <Link className="auth-link" to="/login">Masuk di sini</Link>
            </p>
          </>
        )}

        {step === 'token' && (
          <>
            <h1>Atur Password Baru</h1>
            <p className="auth-sub">
              Kode reset terkirim ke <b>{email}</b>. Karena ini demo tanpa server email, kode ditampilkan langsung di bawah ini.
            </p>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <p className="text-sm text-muted" style={{ fontWeight: 700 }}>Demo — email simulasi:</p>
              <p className="text-sm">
                Subjek: <b>Reset password NARAPRIVAT</b>
                <br />
                Kode (berlaku {expiresIn} menit): <code className="code">{token}</code>
              </p>
            </div>
            <form onSubmit={doReset}>
              <div className="field">
                <label>Kode Reset</label>
                <input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  required
                />
                <div className="hint">
                  Sudah otomatis terisi. Gunakan jika kamu menerima kode dari email.
                </div>
              </div>
              <PasswordField
                label="Password baru"
                placeholder="Minimal 6 karakter"
                value={pwd}
                onChange={setPwd}
                required
                autoComplete="new-password"
              />
              <PasswordField
                label="Ulangi password baru"
                placeholder="Ketik ulang password"
                value={pwd2}
                onChange={setPwd2}
                required
                autoComplete="new-password"
              />
              {err && <div className="field-error mb-16">{err}</div>}
              <button className="btn btn--primary btn--block btn--lg" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </form>
            <p className="center text-muted text-sm mt-16">
              <RefreshIcon size={13} /> Kode kedaluwarsa? <Link className="auth-link" to="/forgot-password">Minta ulang</Link>
            </p>
          </>
        )}

        {step === 'done' && (
          <>
            <h1>Password Berhasil Diubah</h1>
            <p className="auth-sub">
              Password Anda sudah diperbarui. Silakan masuk kembali dengan password baru.
            </p>
            <Link to="/login" className="btn btn--primary btn--block btn--lg">
              Masuk sekarang
            </Link>
          </>
        )}
      </div>
    </div>
  );
}