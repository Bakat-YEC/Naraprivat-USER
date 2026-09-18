import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import TutorCard from '../components/TutorCard';
import LocationCascade from '../components/LocationCascade';
import SubjectAutocomplete from '../components/SubjectAutocomplete';
import { openSupport } from '../components/SupportWidget';
import { GENDERS, JENJANG, VEHICLES } from '../options';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  MapPinIcon,
  MessageCircleIcon,
  SearchIcon,
  SortIcon,
  UserPlusIcon,
  XIcon
} from '../components/Icons';

const SORTS = [
  { value: 'recommended', label: 'Direkomendasikan' },
  { value: 'popular', label: 'Terpopuler' },
  { value: 'rating', label: 'Rating tertinggi' },
  { value: 'price_asc', label: 'Harga terendah' },
  { value: 'price_desc', label: 'Harga tertinggi' },
  { value: 'newest', label: 'Terbaru' }
];

const FILTER_KEYS = ['jenjang', 'minPrice', 'maxPrice', 'minRating', 'online', 'availability', 'gender', 'vehicle'];

export default function Tutors() {
  const [params, setParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjectSel, setSubjectSel] = useState(params.get('subject') ? [params.get('subject')] : []);
  const [loc, setLoc] = useState({
    provinsi: params.get('provinsi') || '',
    kabupaten: params.get('kabupaten') || '',
    kecamatan: params.get('kecamatan') || ''
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- state khusus mobile: header & bottom sheet -----
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [sheet, setSheet] = useState(null); // 'sort' | 'filter' | 'loc'
  const [sortDraft, setSortDraft] = useState('recommended');
  const [filterDraft, setFilterDraft] = useState({ jenjang: '', minPrice: '', maxPrice: '', minRating: '', online: '', availability: '', gender: '', vehicle: '' });
  const [locDraft, setLocDraft] = useState({ provinsi: '', kabupaten: '', kecamatan: '' });
  const lastScrollRef = useRef(0);

  const q = params.get('q') || '';
  const subject = params.get('subject') || '';
  const jenjang = params.get('jenjang') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const minRating = params.get('minRating') || '';
  const online = params.get('online') || '';
  const availability = params.get('availability') || '';
  const gender = params.get('gender') || '';
  const vehicle = params.get('vehicle') || '';
  const sort = params.get('sort') || 'recommended';
  const page = params.get('page') || '1';

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // header hilang saat scroll ke bawah, muncul saat scroll ke atas (mobile)
  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastScrollRef.current;
      if (y < 90) setHeaderHidden(false);
      else if (dy > 6) setHeaderHidden(true);
      else if (dy < -6) setHeaderHidden(false);
      lastScrollRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  // kunci scroll halaman saat bottom sheet terbuka
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sheet]);

  useEffect(() => {
    api.get('/subjects').then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      q,
      subject,
      jenjang,
      provinsi: loc.provinsi,
      kabupaten: loc.kabupaten,
      kecamatan: loc.kecamatan,
      minPrice,
      maxPrice,
      minRating,
      online,
      availability,
      gender,
      vehicle,
      sort,
      page,
      perPage: '9'
    }).toString();
    api.get(`/tutors?${qs}`)
      .then((res) => {
        setData(res);
        // catat pencarian untuk Live Search Feed (hanya jika ada subjek)
        if (subject) {
          const locName = [loc.provinsi, loc.kabupaten, loc.kecamatan]
            .filter(Boolean).join('>');
          api.post('/search/logs', {
            subject,
            locationId: loc.kecamatan || loc.kabupaten || loc.provinsi || '',
            locationName: locName,
            resultCount: res.total
          }).catch(() => {});
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, subject, jenjang, minPrice, maxPrice, minRating, online, availability, gender, vehicle, sort, page, loc.provinsi, loc.kabupaten, loc.kecamatan, refreshKey]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const applySubject = (list) => {
    setSubjectSel(list);
    update('subject', list[0] || '');
  };

  const applyLoc = (next) => {
    setLoc(next);
    update('provinsi', next.provinsi);
    update('kabupaten', next.kabupaten);
  };

  const clearKeys = (keys) => {
    const next = new URLSearchParams(params);
    keys.forEach((k) => next.delete(k));
    next.delete('page');
    setParams(next);
  };

  const clearAll = () => {
    setSubjectSel([]);
    setLoc({ provinsi: '', kabupaten: '' });
    setParams(new URLSearchParams());
    setRefreshKey((k) => k + 1);
  };

  // ----- bottom sheet (mobile) -----
  const openSheet = (type) => {
    if (type === 'sort') setSortDraft(sort);
    else if (type === 'filter') setFilterDraft({ jenjang, minPrice, maxPrice, minRating, online, availability, gender, vehicle });
    else if (type === 'loc') setLocDraft({ ...loc });
    setSheet(type);
  };

  const applySheet = () => {
    const next = new URLSearchParams(params);
    if (sheet === 'sort') {
      if (sortDraft && sortDraft !== 'recommended') next.set('sort', sortDraft);
      else next.delete('sort');
    } else if (sheet === 'filter') {
      FILTER_KEYS.forEach((k) => {
        if (filterDraft[k]) next.set(k, filterDraft[k]);
        else next.delete(k);
      });
    } else if (sheet === 'loc') {
      ['provinsi', 'kabupaten', 'kecamatan'].forEach((k) => {
        if (locDraft[k]) next.set(k, locDraft[k]);
        else next.delete(k);
      });
      setLoc({ ...locDraft });
    }
    next.delete('page');
    setParams(next);
    setSheet(null);
  };

  const resultCount = useMemo(() => (data ? data.total : 0), [data]);
  const totalPages = data ? data.totalPages : 1;
  const locActive = !!loc.provinsi || !!loc.kabupaten || !!loc.kecamatan;

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (jenjang) n++;
    if (minPrice) n++;
    if (maxPrice) n++;
    if (minRating) n++;
    if (online === 'true' || online === 'false') n++;
    if (availability === 'available') n++;
    if (gender) n++;
    if (vehicle) n++;
    return n;
  }, [minPrice, maxPrice, minRating, online, availability, gender, vehicle]);

  const pages = useMemo(() => {
    const arr = [];
    const current = Number(page);
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  const resultsEl =
    loading ? (
      <div className="spinner" />
    ) : data && data.items.length > 0 ? (
      <div className="grid grid--tutors">
        {data.items.map((t) => (
          <TutorCard key={t.id} tutor={t} />
        ))}
      </div>
    ) : (
      /* EMPTY STATE sesuai PRD Bagian F.2 */
      <div className="empty empty--hero">
        <div className="empty__emoji"><MapPinIcon size={48} /></div>
        <b>Belum ada tutor untuk pencarian ini.</b>
        <p className="text-muted" style={{ maxWidth: 420, margin: '8px auto 4px' }}>
          Punya keahlian di bidang ini? Jadilah tutor pertama di lokasi ini dan mulai dapatkan murid!
        </p>
        <Link to="/register?role=tutor" className="btn btn--primary" style={{ marginTop: 12 }}>
          <UserPlusIcon size={16} /> Jadilah Tutor Pertama di Lokasi Ini!
        </Link>
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={clearAll}>
          Reset pencarian
        </button>
      </div>
    );

  const paginationEl = totalPages > 1 && (
    <div className="pagination">
      <button disabled={Number(page) <= 1} onClick={() => update('page', String(Number(page) - 1))}>
        <ChevronLeftIcon size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={Number(page) === p ? 'active' : ''}
          onClick={() => update('page', String(p))}
        >
          {p}
        </button>
      ))}
      <button disabled={Number(page) >= totalPages} onClick={() => update('page', String(Number(page) + 1))}>
        <ChevronRightIcon size={16} />
      </button>
    </div>
  );

  const sheetTitle = sheet === 'sort' ? 'Urutkan' : sheet === 'filter' ? 'Filter' : 'Lokasi';

  return (
    <section className="section" style={{ paddingTop: isMobile ? 0 : 40 }}>
      {isMobile ? (
        <>
          {/* HEADER PENCARIAN MOBILE */}
          <div className={`search-header ${headerHidden ? 'search-header--hidden' : ''}`}>
            <div className="search-header__inner">
            <div className="search-header__pill">
              <SearchIcon size={18} />
              <SubjectAutocomplete selected={subjectSel} onChange={applySubject} max={1} />
            </div>
            <div className="search-header__tools">
              <button className={`search-tool ${sort !== 'recommended' ? 'active' : ''}`} onClick={() => openSheet('sort')}>
                <SortIcon size={17} /> Urutkan
              </button>
              <button className={`search-tool ${activeFilterCount > 0 ? 'active' : ''}`} onClick={() => openSheet('filter')}>
                <FilterIcon size={17} /> Filter
                {activeFilterCount > 0 && <span className="tool-badge">{activeFilterCount}</span>}
              </button>
              <button className={`search-tool ${locActive ? 'active' : ''}`} onClick={() => openSheet('loc')}>
                <MapPinIcon size={17} /> Lokasi
              </button>
            </div>
            </div>
          </div>

          <div className="container" style={{ paddingTop: 14 }}>
            {(subject || jenjang || minPrice || maxPrice || minRating || online || availability || gender || vehicle) && (
              <div className="active-chips">
                {jenjang && (
                  <span className="active-chip">Jenjang: {jenjang} <button onClick={() => clearKeys(['jenjang'])}><XIcon size={12} /></button></span>
                )}
                {subject && (
                  <span className="active-chip">Bidang: {subject} <button onClick={() => applySubject([])}><XIcon size={12} /></button></span>
                )}
                {(minPrice || maxPrice) && (
                  <span className="active-chip">Harga: Rp{minPrice || '0'}–{maxPrice || '∞'} <button onClick={() => clearKeys(['minPrice', 'maxPrice'])}><XIcon size={12} /></button></span>
                )}
                {minRating && (
                  <span className="active-chip">Rating {minRating}+ <button onClick={() => clearKeys(['minRating'])}><XIcon size={12} /></button></span>
                )}
                {online === 'true' && (
                  <span className="active-chip">Online <button onClick={() => clearKeys(['online'])}><XIcon size={12} /></button></span>
                )}
                {online === 'false' && (
                  <span className="active-chip">Datang ke rumah <button onClick={() => clearKeys(['online'])}><XIcon size={12} /></button></span>
                )}
                {availability === 'available' && (
                  <span className="active-chip">Tersedia <button onClick={() => clearKeys(['availability'])}><XIcon size={12} /></button></span>
                )}
                {gender && (
                  <span className="active-chip">Jenis Kelamin: {gender} <button onClick={() => clearKeys(['gender'])}><XIcon size={12} /></button></span>
                )}
                {vehicle && (
                  <span className="active-chip">Kendaraan: {vehicle} <button onClick={() => clearKeys(['vehicle'])}><XIcon size={12} /></button></span>
                )}
                <button className="active-chip-reset" onClick={clearAll}>Reset semua</button>
              </div>
            )}

            <div className="results-meta">
              <span>{loading ? 'Memuat…' : `${resultCount} hasil`}</span>
              <button type="button" className="tutors-cs-btn" onClick={openSupport}>
                <MessageCircleIcon size={15} /> Minta Tolong CS
              </button>
            </div>

            {resultsEl}
            {paginationEl}
          </div>

          {/* BOTTOM SHEET */}
          <div className={`sheet-overlay ${sheet ? 'open' : ''}`} onClick={() => setSheet(null)} />
          <div className={`sheet ${sheet ? 'open' : ''}`}>
            <div className="sheet__head">
              <b>{sheetTitle}</b>
              <button onClick={() => setSheet(null)} aria-label="Tutup"><XIcon size={19} /></button>
            </div>
            <div className="sheet__body">
              {sheet === 'sort' && (
                <div className="sheet-options">
                  {SORTS.map((s) => (
                    <button key={s.value} className={`sheet-option ${sortDraft === s.value ? 'active' : ''}`} onClick={() => setSortDraft(s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {sheet === 'filter' && (
                <div className="sheet-fields">
                  <div>
                    <label className="sheet-grouplabel">Jenjang</label>
                    <select value={filterDraft.jenjang} onChange={(e) => setFilterDraft({ ...filterDraft, jenjang: e.target.value })}>
                      <option value="">Semua Jenjang</option>
                      {JENJANG.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sheet-grouplabel">Harga per jam (Rp)</label>
                    <div className="sheet-price">
                      <input type="number" placeholder="Min" value={filterDraft.minPrice} onChange={(e) => setFilterDraft({ ...filterDraft, minPrice: e.target.value })} />
                      <input type="number" placeholder="Max" value={filterDraft.maxPrice} onChange={(e) => setFilterDraft({ ...filterDraft, maxPrice: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="sheet-grouplabel">Rating minimum</label>
                    <select value={filterDraft.minRating} onChange={(e) => setFilterDraft({ ...filterDraft, minRating: e.target.value })}>
                      <option value="">Semua</option>
                      <option value="4">4 ke atas</option>
                      <option value="4.5">4.5 ke atas</option>
                      <option value="5">5.0</option>
                    </select>
                  </div>
                  <div>
                    <label className="sheet-grouplabel">Jenis Kelamin</label>
                    <select value={filterDraft.gender} onChange={(e) => setFilterDraft({ ...filterDraft, gender: e.target.value })}>
                      <option value="">Semua</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sheet-grouplabel">Ketersediaan Kendaraan</label>
                    <select value={filterDraft.vehicle} onChange={(e) => setFilterDraft({ ...filterDraft, vehicle: e.target.value })}>
                      <option value="">Semua</option>
                      {VEHICLES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sheet-grouplabel">Metode Ajar</label>
                    <select value={filterDraft.online} onChange={(e) => setFilterDraft({ ...filterDraft, online: e.target.value })}>
                      <option value="">Semua Metode</option>
                      <option value="true">Bisa Online</option>
                      <option value="false">Bisa Datang ke Rumah</option>
                    </select>
                  </div>
                  <label className="sheet-check">
                    <input type="checkbox" checked={filterDraft.availability === 'available'} onChange={(e) => setFilterDraft({ ...filterDraft, availability: e.target.checked ? 'available' : '' })} />
                    <span className="status-dot-dot status-dot--green" /> Hanya yang tersedia
                  </label>
                </div>
              )}

              {sheet === 'loc' && (
                <LocationCascade value={locDraft} onChange={setLocDraft} requireLevel="kabupaten" maxLevel="kabupaten" />
              )}
            </div>
            <div className="sheet__foot">
              <button className="btn btn--primary btn--lg" onClick={applySheet}>
                Pilih
              </button>
            </div>
          </div>
        </>
      ) : (
        /* DESKTOP: layout lama (sidebar filter + hasil) */
        <div className="container">
          <div className="section__head">
            <div>
              <h2 className="section__title">Cari Tutor &amp; Pengajar Privat</h2>
              <p className="section__sub">
                {resultCount === 0 && 'Sesuaikan subjek & lokasi untuk menemukan tutor terbaik.'}
              </p>
            </div>
          </div>

          <div className="dash-grid">
            {/* FILTER SIDEBAR */}
            <aside className="dash-side" style={{ width: 320, padding: '24px 20px' }}>
              <h3 style={{ fontSize: 18, marginBottom: 24, letterSpacing: 0.3 }}>Filter</h3>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Subjek</label>
                <SubjectAutocomplete selected={subjectSel} onChange={applySubject} max={1} />
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Jenjang</label>
                <select value={jenjang} onChange={(e) => update('jenjang', e.target.value)}>
                  <option value="">Semua Jenjang</option>
                  {JENJANG.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Lokasi</label>
                <LocationCascade value={loc} onChange={applyLoc} requireLevel="kabupaten" maxLevel="kabupaten" />
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Harga per jam (Rp)</label>
                <div className="flex gap-8">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => update('minPrice', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => update('maxPrice', e.target.value)}
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Rating minimum</label>
                <select value={minRating} onChange={(e) => update('minRating', e.target.value)}>
                  <option value="">Semua</option>
                  <option value="4">4 ke atas</option>
                  <option value="4.5">4.5 ke atas</option>
                  <option value="5">5.0</option>
                </select>
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Jenis Kelamin</label>
                <select value={gender} onChange={(e) => update('gender', e.target.value)}>
                  <option value="">Semua</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Ketersediaan Kendaraan</label>
                <select value={vehicle} onChange={(e) => update('vehicle', e.target.value)}>
                  <option value="">Semua</option>
                  {VEHICLES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 6, fontWeight: 700, fontSize: 13 }}>Metode Ajar</label>
                <select value={online} onChange={(e) => update('online', e.target.value)}>
                  <option value="">Semua Metode</option>
                  <option value="true">Bisa Online</option>
                  <option value="false">Bisa Datang ke Rumah</option>
                </select>
              </div>

              <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="avail"
                  style={{ width: 18, height: 18 }}
                  checked={availability === 'available'}
                  onChange={(e) => update('availability', e.target.checked ? 'available' : '')}
                />
                <label htmlFor="avail" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="status-dot-dot status-dot--green" /> Hanya yang tersedia</label>
              </div>

              <div className="filter-actions">
                <button className="btn btn--primary btn--block" onClick={clearAll}>
                  Reset Filter
                </button>
              </div>
            </aside>

            {/* RESULTS */}
            <div className="results-area">
              <div className="tutor-searchbox">
                <input
                  type="search"
                  placeholder="Cari nama tutor, subjek, atau kata kunci…"
                  value={q}
                  onChange={(e) => update('q', e.target.value)}
                />
                {q && (
                  <button className="btn btn--ghost btn--sm" onClick={() => update('q', '')} aria-label="Hapus pencarian">
                    <XIcon size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mb-16" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="flex items-center gap-8">
                  <label className="text-sm" style={{ fontWeight: 700 }}>Urutkan:</label>
                  <select
                    value={sort}
                    onChange={(e) => update('sort', e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 14 }}
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <span className="text-sm text-muted">{resultCount} hasil</span>
              </div>

              {resultsEl}
              {paginationEl}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}