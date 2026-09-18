import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, avatarColor, initials, formatPrice } from '../api';
import TutorCard from '../components/TutorCard';
import Reveal from '../components/Reveal';
import SubjectAutocomplete from '../components/SubjectAutocomplete';
import LocationSearchInput from '../components/LocationSearchInput';
import { JENJANG } from '../options';
import useCountUp from '../hooks/useCountUp';
import {
  BookOpenIcon,
  BuildingIcon,
  CalculatorIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  FlaskIcon,
  GlobeIcon,
  GraduationCapIcon,
  LeafIcon,
  LightbulbIcon,
  MapPinIcon,
  MessageCircleIcon,
  MonitorIcon,
  MusicIcon,
  SearchIcon,
  ZapIcon
} from '../components/Icons';

const FEATURED_SUBJECTS = [
  { name: 'Matematika', icon: CalculatorIcon, size: 'large', tint: 'linear-gradient(135deg, #ffe8d6, #fff3e8)' },
  { name: 'Bahasa Inggris', icon: GlobeIcon, size: 'wide', tint: 'linear-gradient(135deg, #d8f6ef, #eefaf6)' },
  { name: 'Programming', icon: CodeIcon, size: 'wide', tint: 'linear-gradient(135deg, #e3ebff, #f0f4ff)' }
];

const SMALL_SUBJECTS = [
  { name: 'Fisika', icon: ZapIcon },
  { name: 'Kimia', icon: FlaskIcon },
  { name: 'Biologi', icon: LeafIcon },
  { name: 'Musik', icon: MusicIcon }
];

const STEPS = [
  {
    num: '1',
    title: 'Cari Tutor',
    desc: 'Pilih subjek dan lokasi hingga level kecamatan. Temukan tutor terdekatmu.',
    icon: SearchIcon
  },
  {
    num: '2',
    title: 'Hubungi via WhatsApp',
    desc: 'Buka kontak WhatsApp tutor langsung. Konsultasikan kebutuhan materi anak, tentukan hari les, serta buat janji pertemuan awal.',
    icon: MessageCircleIcon
  },
  {
    num: '3',
    title: 'Les Dimulai',
    desc: 'Tutor mengajar di rumah Anda atau online. Pembayaran honor les dibayarkan langsung kepada tutor.',
    icon: GraduationCapIcon
  }
];

const TESTIMONIALS = [
  {
    name: 'Nadia Kirana', role: 'Murid SMA — Jakarta',
    text: 'Cukup sekali beli Akses Premium, aku bisa hubungi banyak tutor lewat WhatsApp. Nilai matematikaku naik drastis!'
  },
  {
    name: 'Fajar Ramadhan', role: 'Mahasiswa — Bandung',
    text: 'Pencariannya sampai level kecamatan, jadi ketemu mentor programming yang lokasinya dekat. Enak banget.'
  },
  {
    name: 'Bu Ratna', role: 'Orang tua murid SD — Yogyakarta',
    text: 'Profil tutor jelas, sertifikatnya tertera, dan langsung chat WhatsApp tanpa aplikasi tambahan.'
  }
];

function Counter({ target, suffix = '', start }) {
  const value = useCountUp(target, { start });
  return (
    <b>
      {value.toLocaleString('id-ID')}
      {suffix}
    </b>
  );
}

// Minimum tampil 100+ (marketing), lalu round-down per ratusan: 192 → 190, 2013 → 2000
const niceCount = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 100;
  return Math.max(100, Math.floor(x / 100) * 100);
};

// Ambil bagian terakhir lokasi dari log (pisah ">" -> kecamatan), abaikan kode angka
const locLabel = (l) => {
  const parts = (l.locationName || '').split('>').map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return /^\d+$/.test(last) ? '' : last;
};

// Format waktu lalu → "2 mnt lalu"
const timeAgo = (iso) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam lalu`;
};

export default function Home() {
  const [subjects, setSubjects] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [allTutors, setAllTutors] = useState([]);
  const [stats, setStats] = useState({ tutors: 0, subjects: 0, reviews: 0 });
  const [subjectSel, setSubjectSel] = useState([]);
  const [loc, setLoc] = useState({ provinsi: '', kabupaten: '', kecamatan: '', desa: '' });
  const [jenjang, setJenjang] = useState('');
  const [mode, setMode] = useState('');
  const [provOpts, setProvOpts] = useState([]);
  const [kabOpts, setKabOpts] = useState([]);
  const [locProvName, setLocProvName] = useState('');
  const [locKabName, setLocKabName] = useState('');
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    api.get('/locations?level=provinsi').then(setProvOpts).catch(() => {});
  }, []);

  useEffect(() => {
    if (loc.provinsi) {
      api.get(`/locations?parentId=${loc.provinsi}&level=kabupaten`).then(setKabOpts).catch(() => {});
    } else {
      setKabOpts([]);
    }
  }, [loc.provinsi]);

  useEffect(() => {
    if (loc.provinsi && provOpts.length) {
      const found = provOpts.find((o) => o.id === loc.provinsi);
      if (found) setLocProvName(found.name);
    }
  }, [loc.provinsi, provOpts]);

  useEffect(() => {
    if (loc.kabupaten && kabOpts.length) {
      const found = kabOpts.find((o) => o.id === loc.kabupaten);
      if (found) setLocKabName(found.name);
    }
  }, [loc.kabupaten, kabOpts]);
  const [feedTotal, setFeedTotal] = useState(0);
  const [liveLogs, setLiveLogs] = useState([]);
  const [liveIdx, setLiveIdx] = useState(0);
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const trackRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/tutors/subjects').then(setSubjects).catch(() => {});
    api.get('/tutors?sort=rating&perPage=8').then((data) => {
      setFeatured(data.items);
    }).catch(() => {});

    // Stats sinkron dengan jumlah tutor yang aktif (di-refresh tiap 10 detik)
    const syncStats = () => {
      api.get('/tutors?perPage=100')
        .then((data) => {
          setAllTutors(data.items);
          const fieldSet = new Set();
          data.items.forEach((t) =>
            (t.subjects || []).forEach((s) => fieldSet.add(s))
          );
          const reviews = data.items.reduce((sum, t) => sum + t.reviewCount, 0);
          setStats({ tutors: data.total, subjects: fieldSet.size, reviews });
        })
        .catch(() => {});
    };
    syncStats();
    const id = setInterval(syncStats, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStatsVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Live Search Feed — polling tutor yang cocok dengan kriteria (5 detik)
  const criteriaActive = subjectSel.length > 0 || !!jenjang || !!(loc.provinsi || loc.kabupaten || loc.kecamatan);

  const feedParams = useMemo(() => {
    const params = new URLSearchParams();
    if (subjectSel[0]) params.set('subject', subjectSel[0]);
    if (jenjang) params.set('jenjang', jenjang);
    if (mode === 'online') params.set('online', 'true');
    else if (mode === 'direct') params.set('online', 'false');
    if (loc.kecamatan) params.set('kecamatan', loc.kecamatan);
    else if (loc.kabupaten) params.set('kabupaten', loc.kabupaten);
    else if (loc.provinsi) params.set('provinsi', loc.provinsi);
    params.set('perPage', '8');
    params.set('sort', 'rating');
    return params;
  }, [subjectSel, loc.kecamatan, loc.kabupaten, loc.provinsi, jenjang, mode]);

  useEffect(() => {
    let cancelled = false;
    if (!criteriaActive) {
      setFeed([]);
      setFeedTotal(0);
      return;
    }
    const load = () => {
      api.get(`/tutors?${feedParams.toString()}`)
        .then((data) => {
          if (!cancelled) {
            setFeed(data.items);
            setFeedTotal(data.total);
          }
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [criteriaActive, feedParams]);

  // Live Search Ticker — segarkan tiap 5 detik, putar ke pencarian terbaru
  useEffect(() => {
    let cancelled = false;
    let idx = 0;
    let list = [];
    const tick = () => {
      api.get('/search/logs?limit=8')
        .then((logs) => {
          if (cancelled) return;
          if (logs && logs.length) {
            list = logs;
            idx = (idx + 1) % logs.length;
            setLiveLogs(logs);
            setLiveIdx(idx);
          } else {
            setLiveLogs([]);
          }
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const liveLog = liveLogs[liveIdx];
  const liveWhere = liveLog ? locLabel(liveLog) : '';

  const subjectCounts = useMemo(() => {
    const counts = {};
    allTutors.forEach((t) => {
      t.subjects.forEach((s) => {
        counts[s] = (counts[s] || 0) + 1;
      });
    });
    return counts;
  }, [allTutors]);

  const toggleMode = (m) => setMode((prev) => (prev === m ? '' : m));

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (subjectSel[0]) params.set('subject', subjectSel[0]);
    if (jenjang) params.set('jenjang', jenjang);
    if (mode === 'online') params.set('online', 'true');
    else if (mode === 'direct') params.set('online', 'false');
    if (loc.kecamatan) params.set('kecamatan', loc.kecamatan);
    else if (loc.kabupaten) params.set('kabupaten', loc.kabupaten);
    else if (loc.provinsi) params.set('provinsi', loc.provinsi);
    navigate(`/tutors?${params.toString()}`);
  };

  const scrollCarousel = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  return (
    <>
      {/* ======= HERO ======= */}
      <section className="hero">
        <div className="container">
          <div className="hero__content">
            <h1>
              Temukan tutor privat <em>terdekat</em>, langsung chat via WhatsApp
            </h1>

            <form className="search-hero search-hero--np" onSubmit={handleSearch}>
              <div className="search-hero__field">
                <span className="search-hero__label">Mata Pelajaran</span>
                <div className="search-hero__control">
                  <span className="search-hero__icon"><BookOpenIcon size={15} /></span>
                  <SubjectAutocomplete
                    selected={subjectSel}
                    onChange={setSubjectSel}
                    placeholder="Pilih / ketik mapel…"
                    max={1}
                  />
                  <span className="search-hero__caret">▾</span>
                </div>
              </div>

              <div className="search-hero__field">
                <span className="search-hero__label">Jenjang Pendidikan</span>
                <div className="search-hero__control">
                  <span className="search-hero__icon"><GraduationCapIcon size={15} /></span>
                  <LocationSearchInput
                    options={JENJANG.map((j) => ({ id: j, name: j }))}
                    value={jenjang || ''}
                    valueId={jenjang || ''}
                    onChange={({ id }) => setJenjang(id || '')}
                    placeholder="Pilih jenjang pendidikan…"
                    readOnly
                  />
                  <span className="search-hero__caret">▾</span>
                </div>
              </div>

              <div className="search-hero__field">
                <span className="search-hero__label">Provinsi</span>
                <div className="search-hero__control">
                  <span className="search-hero__icon"><MapPinIcon size={15} /></span>
                  <LocationSearchInput
                    options={provOpts}
                    value={locProvName}
                    valueId={loc.provinsi}
                    onChange={({ id, name }) => {
                      setLoc({ provinsi: id, kabupaten: '', kecamatan: '', desa: '' });
                      setLocProvName(name || '');
                    }}
                    placeholder="Ketik provinsi… cth: Jawa"
                  />
                  <span className="search-hero__caret">▾</span>
                </div>
              </div>

              <div className="search-hero__field">
                <span className="search-hero__label">Kabupaten / Kota</span>
                <div className="search-hero__control">
                  <span className="search-hero__icon"><BuildingIcon size={15} /></span>
                  <LocationSearchInput
                    options={kabOpts}
                    value={locKabName}
                    valueId={loc.kabupaten}
                    onChange={({ id, name }) => {
                      setLoc((l) => ({ ...l, kabupaten: id, kecamatan: '', desa: '' }));
                      setLocKabName(name || '');
                    }}
                    placeholder={loc.provinsi ? 'Ketik kab / kota…' : 'Pilih provinsi dulu'}
                  />
                  <span className="search-hero__caret">▾</span>
                </div>
              </div>

              <div className="search-hero__mode">
                <span className="search-hero__label">Mode Pertemuan</span>
                <div className="search-hero__control search-hero__mode-select">
                  <span className="search-hero__icon"><GlobeIcon size={15} /></span>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="">Semua Metode</option>
                    <option value="online">Online</option>
                    <option value="direct">Datang ke Rumah</option>
                  </select>
                  <span className="search-hero__caret">▾</span>
                </div>
                <div className="search-hero__mode-pills">
                  <button
                    type="button"
                    className={`search-hero__mode-btn ${mode === '' ? 'is-on' : ''}`}
                    onClick={() => setMode('')}
                  >
                    <span className={`search-hero__mode-check ${mode === '' ? 'checked' : ''}`}>
                      {mode === '' && <CheckIcon size={12} />}
                    </span>
                    <GlobeIcon size={16} /> Semua Metode
                  </button>
                  <button
                    type="button"
                    className={`search-hero__mode-btn ${mode === 'online' ? 'is-on' : ''}`}
                    onClick={() => toggleMode('online')}
                  >
                    <span className={`search-hero__mode-check ${mode === 'online' ? 'checked' : ''}`}>
                      {mode === 'online' && <CheckIcon size={12} />}
                    </span>
                    <MonitorIcon size={16} /> Online
                  </button>
                  <button
                    type="button"
                    className={`search-hero__mode-btn ${mode === 'direct' ? 'is-on' : ''}`}
                    onClick={() => toggleMode('direct')}
                  >
                    <span className={`search-hero__mode-check ${mode === 'direct' ? 'checked' : ''}`}>
                      {mode === 'direct' && <CheckIcon size={12} />}
                    </span>
                    <BuildingIcon size={16} /> Datang ke Rumah
                  </button>
                </div>
                <button type="submit" className="btn btn--primary search-hero__btn">
                  <SearchIcon size={17} />
                  Cari Tutor Privat
                </button>
              </div>

              <div className="search-hero__footer">
                <button type="submit" className="btn btn--primary search-hero__btn">
                  <SearchIcon size={17} />
                  Cari Tutor Privat
                </button>
              </div>
            </form>

            <div className="live-search-ticker">
              <span className="live-search-ticker__dot" />
              {liveLog ? (
                <span className="live-search-ticker__text" key={`${liveLog.id}:${liveIdx}`}>
                  Seseorang baru saja mencari <b>{liveLog.subject}</b> Mandiri di {liveWhere || 'seluruh Indonesia'}
                  {liveLog.createdAt && (
                    <span className="live-search-ticker__time"> ({timeAgo(liveLog.createdAt)})</span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-muted">
                  Belum ada aktivitas pencarian — jadilah yang pertama mencari tutor.
                </span>
              )}
            </div>

            <div className="trust-row" ref={statsRef}>
              <div className="trust-row__left">
                <div className="avatar-stack">
                  {featured.slice(0, 5).map((t) => (
                    <span key={t.id} className="avatar" style={{ backgroundColor: avatarColor(t.name) }}>
                      {initials(t.name)}
                    </span>
                  ))}
                </div>
                <p>
                  Dipercaya <b>murid &amp; orang tua</b>
                  <br />
                  di seluruh Indonesia
                </p>
              </div>
              <Link to="/register?role=tutor" className="btn btn--primary trust-cta">
                Yuk Jadi Tutor! →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======= LIVE SEARCH FEED ======= */}
      {criteriaActive && (
        <div className="container">
          <div className="live-feed">
            <div className="live-feed__head">
              <span className="live-feed__dot" />
              <b>Live Search Feed</b>
              <span className="text-sm text-muted">
                — {feedTotal} tutor sesuai pilihanmu · disegarkan otomatis tiap 5 detik
              </span>
            </div>
            <div className="live-feed__track">
              {feed.length === 0 ? (
                <div className="live-feed__empty">
                  <div>
                    <b style={{ display: 'block', color: 'var(--ink)', marginBottom: 4 }}>
                      {subjectSel[0]
                        ? <>Belum ada tutor untuk <em style={{ fontStyle: 'normal', color: 'var(--primary-deep)' }}>“{subjectSel[0]}”</em> — jadilah yang pertama</>
                        : <>Di lokasi ini belum ada tutornya — jadilah yang pertama</>}
                    </b>
                    <span className="text-sm text-muted">
                      Daftar gratis sebagai tutor dan raih murid pertamamu.
                    </span>
                  </div>
                  <Link to="/register" className="btn btn--primary btn--sm">
                    Daftar Jadi Tutor <ChevronRightIcon size={15} />
                  </Link>
                </div>
              ) : (
                feed.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tutors?${feedParams.toString()}`}
                    className="live-feed__item"
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                      {initials(t.name)}
                    </span>
                    <b style={{ color: 'var(--ink)' }}>{t.name}</b>
                    <em>{t.subjects[0]}</em>
                    {t.city ? (
                      <small><MapPinIcon size={11} style={{ verticalAlign: '-1px' }} /> {t.city}</small>
                    ) : (
                      <small><MapPinIcon size={11} style={{ verticalAlign: '-1px' }} /> {t.locationName}</small>
                    )}
                    <b style={{ fontWeight: 700 }}>{formatPrice(t.price)}</b>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======= STATS BAND ======= */}
      <div className="container">
        <div className={criteriaActive ? 'stats-band stats-band--below' : 'stats-band'}>
          <div className="stats-band__item">
            <Counter target={niceCount(stats.tutors)} suffix="+" start={statsVisible} />
            <span>Tutor Terdaftar</span>
          </div>
          <div className="stats-band__item">
            <Counter target={niceCount(stats.subjects)} suffix="+" start={statsVisible} />
            <span>Bidang Pelajaran</span>
          </div>
          <div className="stats-band__item">
            <Counter target={niceCount(stats.reviews)} suffix="+" start={statsVisible} />
            <span>Ulasan Murid</span>
          </div>
        </div>
      </div>

      {/* ======= BENTO KATEGORI ======= */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="section__head">
              <div>
                <div className="section__tag">Kategori Populer</div>
                <h2 className="section__title">Mau belajar apa hari ini?</h2>
                <p className="section__sub">Tekan kartunya untuk langsung melihat semua tutornya.</p>
              </div>
              <Link to="/tutors" className="btn btn--outline">Lihat Semua Tutor</Link>
            </div>
          </Reveal>

          <div className="bento">
            {FEATURED_SUBJECTS.map((s, i) => {
              const IconC = s.icon;
              return (
                <Reveal
                  key={s.name}
                  as={Link}
                  to={`/tutors?subject=${encodeURIComponent(s.name)}`}
                  delay={i * 80}
                  className={`bento__tile bento__${s.size}`}
                  style={{ background: s.tint }}
                >
                  <div className="bento__count">
                    <b>{subjectCounts[s.name] || 0}</b> tutor tersedia
                  </div>
                  <span className="bento__emoji">
                    <IconC size={36} />
                  </span>
                  <div className="bento__name">{s.name}</div>
                </Reveal>
              );
            })}

            {SMALL_SUBJECTS.map((s, i) => {
              const IconC = s.icon;
              return (
                <Reveal
                  key={s.name}
                  as={Link}
                  to={`/tutors?subject=${encodeURIComponent(s.name)}`}
                  delay={i * 60}
                  className="bento__tile bento__small"
                  style={{ background: i % 2 ? 'var(--surface)' : 'var(--primary-soft)' }}
                >
                  <span className="bento__emoji">
                    <IconC size={30} />
                  </span>
                  <div>
                    <div className="bento__name" style={{ fontSize: 16 }}>{s.name}</div>
                    <div className="bento__count">
                      <b>{subjectCounts[s.name] || 0}</b> tutor
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======= CAROUSEL TUTOR ======= */}
      <section className="section section--white">
        <div className="container">
          <Reveal>
            <div className="section__head">
              <div>
                <div className="section__tag">Paling Disukai Murid</div>
                <h2 className="section__title">Tutor rating tertinggi</h2>
                <p className="section__sub">Geser ke samping untuk melihat lebih banyak tutor favorit.</p>
              </div>
              <Link to="/tutors" className="btn btn--outline">Cari Semua</Link>
            </div>
          </Reveal>

          <Reveal>
            <div className="carousel">
              <button
                className="carousel__btn carousel__btn--prev"
                onClick={() => scrollCarousel(-1)}
                aria-label="Sebelumnya"
              >
                <ChevronLeftIcon size={20} />
              </button>
              <div className="carousel__track" ref={trackRef}>
                {featured.map((t) => (
                  <TutorCard key={t.id} tutor={t} />
                ))}
              </div>
              <button
                className="carousel__btn carousel__btn--next"
                onClick={() => scrollCarousel(1)}
                aria-label="Berikutnya"
              >
                <ChevronRightIcon size={20} />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======= HOW IT WORKS ======= */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="section__head section__head--center">
              <div>
                <h2 className="section__title">Terhubung ke tutor cuma 3 langkah</h2>
                <p className="section__sub">Tanpa booking, tanpa aplikasi chat tambahan — langsung WhatsApp.</p>
              </div>
            </div>
          </Reveal>

          <div className="steps">
            {STEPS.map((s, i) => {
              const IconC = s.icon;
              return (
                <Reveal key={s.num} delay={i * 120}>
                  <div className="step">
                    <div className="step__num">{s.num}</div>
                    <div className="step__icon"><IconC size={30} /></div>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======= TESTIMONIALS ======= */}
      <section className="section section--warm">
        <div className="container">
          <Reveal>
            <div className="section__head section__head--center">
              <div>
                <div className="section__tag">Kata Mereka</div>
                <h2 className="section__title">Cerita asli dari pengguna</h2>
                <p className="section__sub">
                  Dari pelajar sampai orang tua — semua menemukan tutor yang tepat di NARAPRIVAT.
                </p>
              </div>
            </div>
          </Reveal>
          <div className="grid grid--3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <div className="testimonial">
                  <div className="stars">★★★★★</div>
                  <p className="testimonial__quote">“{t.text}”</p>
                  <div className="testimonial__person">
                    <span className="avatar" style={{ background: avatarColor(t.name), fontSize: 13 }}>
                      {initials(t.name)}
                    </span>
                    <div>
                      <b style={{ fontSize: 14 }}>{t.name}</b>
                      <div className="text-sm text-muted">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======= CTA ======= */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div
              className="tutor-card"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '38px 42px',
                background: 'linear-gradient(135deg, var(--primary-deep), var(--primary-dark) 55%, #26c4b0)',
                border: 'none',
                color: '#fff',
                flexWrap: 'wrap',
                gap: 20,
                overflow: 'hidden'
              }}
            >
              <span style={{ position: 'absolute', right: 30, top: 6, opacity: 0.12 }}>
                <LightbulbIcon size={72} />
              </span>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <h2 style={{ color: '#fff', marginBottom: 8 }}>Punya keahlian untuk dibagikan?</h2>
                <p style={{ color: 'rgba(255,255,255,0.94)' }}>
                  Daftar sebagai tutor — <b>gratis, 100% bebas komisi</b>. Kamu yang tentukan jadwal dan tarifmu sendiri.
                </p>
              </div>
              <div className="flex gap-12" style={{ position: 'relative', zIndex: 1 }}>
                <Link to="/register?role=tutor" className="btn btn--lg" style={{ background: '#fff', color: 'var(--primary-deep)' }}>
                  Daftar Jadi Tutor
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
