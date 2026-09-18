import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken, uploadFile } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SubjectAutocomplete from '../components/SubjectAutocomplete';
import LocationCascade from '../components/LocationCascade';
import LocationAutocomplete from '../components/LocationAutocomplete';
import PasswordField from '../components/PasswordField';
import AgreeCheckbox from '../components/AgreeCheckbox';
import { JENJANG } from '../options';
import { FileTextIcon, ImageIcon, MapPinIcon, PenIcon, XIcon, ZapIcon } from '../components/Icons';

function emptyEdu() {
  return { degree: '', institution: '', year: '' };
}

export default function Register() {
  const { updateUser } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const isStudent = sp.get('role') === 'student';

  // tutor
  const [tutorForm, setTutorForm] = useState({
    name: '', email: '', password: '', gender: 'Laki-laki', whatsapp: '',
    headline: '', bio: '', vehicle: 'Ada (Sepeda Motor)'
  });
  const [studentPhone, setStudentPhone] = useState('');
  const [edu, setEdu] = useState([emptyEdu(), emptyEdu()]);
  const [subjects, setSubjects] = useState([]);
  const [jenjang, setJenjang] = useState([]);
  const [loc, setLoc] = useState({ provinsi: '', kabupaten: '', kecamatan: '', desa: '' });
  const [manualMode, setManualMode] = useState(false);
  const [manualParts, setManualParts] = useState({ provinsi: '', kabupaten: '', kecamatan: '', desa: '' });
  const [locDisplay, setLocDisplay] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [certName, setCertName] = useState('');
  const [certPreview, setCertPreview] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleCertFile = async (file) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      push('Sertifikat harus berupa PDF atau gambar (JPG/PNG/WebP).', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await uploadFile(file);
      setCertName(res.url);
      setCertPreview(res.previewUrl || '');
      push(res.previewUrl ? 'Sertifikat PDF berhasil diunggah (preview dibuat).' : 'Sertifikat berhasil diunggah.');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      push('Foto harus berupa gambar (JPG/PNG/WebP).', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await uploadFile(file);
      setPhotoUrl(res.url);
      setPhotoName(file.name);
      push('Foto berhasil diunggah.');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPick = (payload) => {
    if (payload && payload.chain) {
      const next = { provinsi: '', kabupaten: '', kecamatan: '', desa: '' };
      payload.chain.forEach((c) => {
        if (c.level in next) next[c.level] = c.id;
      });
      setLoc(next);
      setCustomLocation('');
      setLocDisplay(payload.path);
    } else if (payload && payload.text) {
      setLoc({ provinsi: '', kabupaten: '', kecamatan: '', desa: '' });
      setCustomLocation(payload.text);
      setLocDisplay(`Manual • ${payload.text} (ketik bebas)`);
    }
  };

  const manualText = () => Object.values(manualParts).filter(Boolean).join(', ');

  const toggleManual = () => {
    if (manualMode) {
      setManualMode(false);
      setCustomLocation('');
    } else {
      const parts = { provinsi: '', kabupaten: '', kecamatan: '', desa: '' };
      if (locDisplay && !locDisplay.startsWith('Manual')) {
        const names = locDisplay.split(' › ').filter(Boolean);
        parts.provinsi = names[0] || '';
        parts.kabupaten = names[1] || '';
        parts.kecamatan = names[2] || '';
        parts.desa = names[3] || '';
      }
      setManualParts(parts);
      setManualMode(true);
    }
  };

  const setManual = (key, value) => setManualParts((p) => ({ ...p, [key]: value }));

  const submitTutor = async (e) => {
    e.preventDefault();
    setError('');
    const validEdu = edu.filter((x) => x.institution || x.degree);
    if (validEdu.length < 2) {
      push('Minimal 2 riwayat pendidikan wajib diisi.', 'error');
      return;
    }
    if (subjects.length === 0) {
      push('Pilih minimal 1 bidang ajar.', 'error');
      return;
    }
    if (subjects.length > 1) {
      push('Tutor baru hanya bisa mengisi 1 bidang ajar. Upgrade Premium untuk lebih.', 'error');
      return;
    }
    if (jenjang.length === 0) {
      push('Pilih minimal 1 jenjang sekolah yang diajar.', 'error');
      return;
    }
    if (!loc.kecamatan && !customLocation.trim() && !manualText()) {
      push('Isi lokasi: pilih dari daftar (hingga Kecamatan) atau ketik manual di kolom.', 'error');
      return;
    }
    setLoading(true);
    try {
      const finalCustom = customLocation.trim() || manualText();
      const res = await api.post('/tutors', {
        ...tutorForm,
        gender: tutorForm.gender,
        whatsapp: tutorForm.whatsapp,
        educationHistory: validEdu,
        certificateUrls: certName ? [{ name: certName.split('/').pop(), url: certName, previewUrl: certPreview || null }] : [],
        photoUrl: photoUrl || null,
        subjectIds: subjects.map((name) => name), // nama di-submit; server mencocokkan
        jenjang,
        locationId: finalCustom ? undefined : loc.kecamatan,
        customLocation: finalCustom || undefined
      });
      setToken(res.token);
      updateUser(res.user);
      push('Pendaftaran tutor berhasil! Profil Anda langsung aktif.');
      navigate('/dashboard?tab=status');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitStudent = async (e) => {
    e.preventDefault();
    setError('');
    if (!agreed) {
      push('Centang persetujuan Syarat dan Ketentuan serta Kebijakan Privasi dulu.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: tutorForm.name,
        email: tutorForm.email,
        password: tutorForm.password,
        role: 'student',
        phone: studentPhone.replace(/\D/g, '')
      });
      setToken(res.token);
      updateUser(res.user);
      push('Akun murid berhasil dibuat. Selamat bergabung!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        {isStudent ? (
          <>
            <h1>Daftar Murid</h1>
            <p className="auth-sub">
              Daftar mandiri sebelum beli — atau akun dibuat otomatis saat pembelian Akses Premium.
            </p>

            <form onSubmit={submitStudent}>
              <div className="field">
                <label>Nama lengkap</label>
                <input placeholder="cth: Nadia Kirana" value={tutorForm.name} onChange={(e) => setTutorForm({ ...tutorForm, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="nama@email.com" value={tutorForm.email} onChange={(e) => setTutorForm({ ...tutorForm, email: e.target.value })} required />
              </div>
              <div className="field">
                <label>Nomor HP</label>
                <input inputMode="numeric" placeholder="08123456789" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value.replace(/\D/g, ''))} required />
              </div>
              <PasswordField
                label="Password"
                placeholder="Minimal 6 karakter"
                value={tutorForm.password}
                onChange={(v) => setTutorForm({ ...tutorForm, password: v })}
                required
                autoComplete="new-password"
              />
              {error && <div className="field-error mb-16">{error}</div>}
              <AgreeCheckbox id="agree-student" checked={agreed} onChange={setAgreed} />
              <button className="btn btn--primary btn--block btn--lg" disabled={loading || !agreed}>
                {loading ? 'Mendaftarkan…' : 'Daftar sebagai Murid'}
              </button>
            </form>

            <p className="center text-muted text-sm mt-16">
              Ingin jadi tutor? <Link to="/register?role=tutor">Daftar Jadi Tutor</Link>
            </p>
          </>
        ) : (
          <>
        <h1>Daftar Jadi Tutor</h1>
        <p className="auth-sub">
          Pendaftaran ringkas — profil langsung aktif (auto-approve).
        </p>

        <form onSubmit={submitTutor}>
          <div className="flex gap-12">
            <div className="field" style={{ flex: 1 }}>
              <label>Nama lengkap</label>
              <input placeholder="cth: Rina Marlina" value={tutorForm.name} onChange={(e) => setTutorForm({ ...tutorForm, name: e.target.value })} required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Jenis Kelamin</label>
              <select value={tutorForm.gender} onChange={(e) => setTutorForm({ ...tutorForm, gender: e.target.value })}>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
          </div>
            <div className="flex gap-12">
              <div className="field" style={{ flex: 1 }}>
                <label>Email</label>
                <input type="email" placeholder="nama@email.com" value={tutorForm.email} onChange={(e) => setTutorForm({ ...tutorForm, email: e.target.value })} required />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <PasswordField
                  label="Password"
                  placeholder="Minimal 6 karakter"
                  value={tutorForm.password}
                  onChange={(v) => setTutorForm({ ...tutorForm, password: v })}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="field">
              <label>Nomor WhatsApp <span className="text-muted">(format 08..., minimal 10 digit)</span></label>
              <input inputMode="numeric" placeholder="081234567890" value={tutorForm.whatsapp} onChange={(e) => setTutorForm({ ...tutorForm, whatsapp: e.target.value.replace(/\D/g, '') })} required />
            </div>

            <div className="field">
              <label>Ketersediaan Kendaraan</label>
              <select value={tutorForm.vehicle} onChange={(e) => setTutorForm({ ...tutorForm, vehicle: e.target.value })}>
                <option>Ada (Sepeda Motor)</option>
                <option>Ada (Mobil)</option>
                <option>Ada (Motor &amp; Mobil)</option>
                <option>Tidak Ada</option>
              </select>
              <div className="hint">Ditampilkan di profil Anda sebagai info transportasi ke lokasi murid.</div>
            </div>

            <div className="field">
              <label>Bidang Ajar (pertama) <span className="text-muted">— maksimal 1 saat daftar</span></label>
              <SubjectAutocomplete
                selected={subjects}
                onChange={(list) => setSubjects(list.slice(0, 1))}
                max={1}
                allowCreate
                placeholder="Ketik mata pelajaran atau pilih…"
              />
              <div className="hint">
                Bidang ajar lain bisa ditambahkan setelah akun Premium (Rp29.000/bln).
                Tidak ada di daftar? Ketik nama bidangmu sendiri lalu pilih "Tambah".
              </div>
            </div>

            <div className="field">
              <label>Jenjang Sekolah yang Diajar <span className="text-muted">— minimal 1</span></label>
              <div className="hint" style={{ marginBottom: 8 }}>
                Bisa langsung pilih beberapa jenjang (PAUD, TK, SD, … Umum/Profesional).
              </div>
              <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                {JENJANG.map((j) => {
                  const on = jenjang.includes(j);
                  return (
                    <button
                      type="button"
                      key={j}
                      className={`tag ${on ? 'badge--primary' : ''}`}
                      style={{
                        padding: '8px 14px',
                        fontSize: 13,
                        cursor: 'pointer',
                        border: on ? '1px solid var(--primary)' : '1px solid var(--border)',
                        fontWeight: on ? 700 : 600
                      }}
                      onClick={() =>
                        setJenjang(on ? jenjang.filter((x) => x !== j) : [...jenjang, j])
                      }
                    >
                      {on ? '✓ ' : '+ '}{j}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label>Lokasi Mengajar</label>
              <LocationAutocomplete onPick={handleLocationPick} />
              {locDisplay && (
                <div className="tag tag--selected" style={{ marginTop: 8, width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MapPinIcon size={14} /> {locDisplay}
                </div>
              )}

              {manualMode ? (
                <div className="loc-manual">
                  {[
                    ['provinsi', 'Provinsi'],
                    ['kabupaten', 'Kabupaten / Kota'],
                    ['kecamatan', 'Kecamatan'],
                    ['desa', 'Desa / Kelurahan (opsional)']
                  ].map(([key, label]) => (
                    <div className="field" key={key}>
                      <label>{label}</label>
                      <input
                        placeholder={key === 'desa' ? 'cth: Banjarjo' : `cth: ${key === 'provinsi' ? 'Bali' : key === 'kabupaten' ? 'Denpasar' : 'Kuta Selatan'}`}
                        value={manualParts[key]}
                        onChange={(e) => setManual(key, e.target.value)}
                      />
                    </div>
                  ))}
                  {manualText() && (
                    <div className="hint">Akan tersimpan sebagai: <b>{manualText()}</b></div>
                  )}
                </div>
              ) : (
                <LocationCascade value={loc} onChange={setLoc} requireLevel="kecamatan" maxLevel="kecamatan" />
              )}

              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 8 }}
                onClick={toggleManual}
              >
                {manualMode
                  ? '↩ Kembali pilih dari daftar'
                  : <><PenIcon size={14} /> Ketik manual (provinsi, kabupaten/kota, kecamatan)</>}
              </button>
            </div>

            <div className="field">
              <label>Riwayat Pendidikan <span className="text-muted">(minimal 2)</span></label>
              {edu.map((row, i) => (
                <div key={i} className="edu-row">
                  <input
                    placeholder="Jenjang (cth: Sarjana S1)"
                    value={row.degree}
                    onChange={(e) => {
                      const next = [...edu];
                      next[i] = { ...next[i], degree: e.target.value };
                      setEdu(next);
                    }}
                  />
                  <input
                    placeholder="Institusi"
                    value={row.institution}
                    onChange={(e) => {
                      const next = [...edu];
                      next[i] = { ...next[i], institution: e.target.value };
                      setEdu(next);
                    }}
                  />
                  <input
                    placeholder="Tahun"
                    value={row.year}
                    onChange={(e) => {
                      const next = [...edu];
                      next[i] = { ...next[i], year: e.target.value };
                      setEdu(next);
                    }}
                    style={{ width: 90 }}
                  />
                  {edu.length > 2 && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdu(edu.filter((_, idx) => idx !== i))}><XIcon size={13} /></button>
                  )}
                </div>
              ))}
              {edu.length < 5 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdu([...edu, emptyEdu()])}>
                  + Tambah riwayat
                </button>
              )}
            </div>

            <div className="flex gap-12">
              <div className="field" style={{ flex: 1 }}>
                <label>Sertifikat (PDF / gambar)</label>
                <label className="file-input">
                  <FileTextIcon size={15} /> {certName ? `Terlampir: ${certName.split('/').pop()}` : 'Unggah sertifikat (PDF jadi preview gambar)…'}
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => handleCertFile(e.target.files[0])} />
                </label>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Foto Diri (opsional)</label>
                <label className="file-input">
                  <ImageIcon size={15} /> {photoName ? `Terunggah: ${photoName}` : 'Unggah foto…'}
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoFile(e.target.files[0])} />
                </label>
                {photoUrl && <img className="photo-preview" src={photoUrl} alt="Preview" />}
              </div>
            </div>

            <div className="field">
              <label>Headline (opsional)</label>
              <input placeholder="cth: Tutor Matematika SMP-SMA, 10 tahun pengalaman" value={tutorForm.headline} onChange={(e) => setTutorForm({ ...tutorForm, headline: e.target.value })} />
            </div>

            {error && <div className="field-error mb-16">{error}</div>}
            <button className="btn btn--primary btn--block btn--lg" disabled={loading}>
              {loading ? 'Mendaftarkan…' : 'Daftar sebagai Tutor (Gratis)'}
            </button>
            <p className="text-sm text-muted center mt-8">
              <ZapIcon size={13} /> Auto-approve: profil langsung muncul di hasil pencarian.
            </p>
          </form>

        <p className="center text-muted text-sm mt-16">
          Sudah punya akun? <Link to="/login">Masuk di sini</Link>
        </p>
          </>
        )}
      </div>
    </div>
  );
}
