import React, { useEffect, useState } from 'react';
import { api } from '../api';

const LEVELS = [
  { key: 'provinsi', label: 'Provinsi', next: 'kabupaten' },
  { key: 'kabupaten', label: 'Kabupaten / Kota', next: 'kecamatan' },
  { key: 'kecamatan', label: 'Kecamatan', next: 'desa' },
  { key: 'desa', label: 'Desa / Kelurahan', next: null }
];

// value: { provinsi, kabupaten, kecamatan, desa } (berisi id)
// maxLevel: batasi level terbawah (mis. 'kecamatan' → hanya 3 dropdown)
export default function LocationCascade({ value = {}, onChange, requireLevel = 'desa', maxLevel = 'desa', verbose = false }) {
  const [options, setOptions] = useState({ provinsi: [] });
  const [loading, setLoading] = useState({});
  const [onlyKec, setOnlyKec] = useState(false);

  const fetchChildren = async (parentId, level) => {
    setLoading((l) => ({ ...l, [level]: true }));
    try {
      const items = await api.get(`/locations?parentId=${parentId}&level=${level}`);
      setOptions((o) => ({ ...o, [level]: items }));
      setLoading((l) => ({ ...l, [level]: false }));
    } catch {
      setLoading((l) => ({ ...l, [level]: false }));
    }
  };

  useEffect(() => {
    api.get('/locations?level=provinsi')
      .then((items) => setOptions((o) => ({ ...o, provinsi: items })))
      .catch(() => {});
  }, []);

  // ketahui kedalaman: apakah ada desa di bawah kecamatan terpilih
  const maxIdx = LEVELS.findIndex((l) => l.key === maxLevel);
  const showDesa = maxIdx >= LEVELS.findIndex((l) => l.key === 'desa');
  const visibleLevels = maxIdx >= 0 ? LEVELS.slice(0, maxIdx + 1) : LEVELS;
  useEffect(() => {
    if (!showDesa || !value.kecamatan) return;
    api.get(`/locations?parentId=${value.kecamatan}&level=desa`)
      .then((items) => setOnlyKec(items.length === 0))
      .catch(() => setOnlyKec(true));
  }, [value.kecamatan, showDesa]);

  // muat opsi turunan saat value diisi otomatis (mis. lewat autocomplete)
  useEffect(() => {
    if (value.provinsi) fetchChildren(value.provinsi, 'kabupaten');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.provinsi]);
  useEffect(() => {
    if (value.kabupaten) fetchChildren(value.kabupaten, 'kecamatan');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.kabupaten]);
  useEffect(() => {
    if (!showDesa || !value.kecamatan) return;
    fetchChildren(value.kecamatan, 'desa');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.kecamatan, showDesa]);

  const setLevel = (key, id) => {
    const next = { provinsi: '', kabupaten: '', kecamatan: '', desa: '' };
    next[key] = id;
    const order = ['provinsi', 'kabupaten', 'kecamatan', 'desa'];
    // reset semua level setelah key
    for (let i = order.indexOf(key) + 1; i < order.length; i++) next[order[i]] = '';
    onChange(next);
    const levelDef = LEVELS.find((l) => l.key === key);
    if (id && levelDef.next) {
      fetchChildren(id, levelDef.next);
    }
  };

  const pick = LEVELS.find((l) => l.key === requireLevel) || LEVELS[2];

  return (
    <div className="loc-cascade">
      {visibleLevels.map((lv) => {
        const active = value[lv.key];
        const disabled = lv.key !== 'provinsi' && !value[LEVELS[LEVELS.indexOf(lv) - 1].key];
        if (lv.key === 'desa' && onlyKec) return null;
        return (
          <div className="loc-cascade__item" key={lv.key}>
            {verbose && <span className="loc-cascade__label">{lv.label}</span>}
            <select
              value={active || ''}
              disabled={disabled}
              onChange={(e) => setLevel(lv.key, e.target.value)}
            >
              <option value="">
                {lv.label}
                {loading[lv.key] ? '…' : ''}
              </option>
              {(options[lv.key] || []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.children ? ` (${o.children})` : ''}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
