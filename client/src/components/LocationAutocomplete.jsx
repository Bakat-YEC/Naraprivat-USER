import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { MapPinIcon, PenIcon } from './Icons';

// Menampilkan input pencarian lokasi dengan saran otomatis.
// onPick menerima:
//   { chain: [{id,name,level}], path: 'Provinsi › Kab › Kec' }  saat memilih lokasi asli
//   { text: 'teks bebas' }                                      saat memakai lokasi manual
export default function LocationAutocomplete({ onPick, placeholder = 'Ketik nama daerah, cth: Ngantru, Tulungagung…' }) {
  const [all, setAll] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.get('/locations/tree')
      .then((tree) => {
        const flat = [];
        const walk = (nodes, ancestors) => {
          (nodes || []).forEach((n) => {
            const chain = [...ancestors, { id: n.id, name: n.name, level: n.level }];
            flat.push({
              id: n.id,
              name: n.name,
              level: n.level,
              chain,
              path: chain.map((c) => c.name).join(' › ')
            });
            if (n.children && n.children.length) walk(n.children, chain);
          });
        };
        walk(tree, []);
        setAll(flat);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((l) => l.path.toLowerCase().includes(q)).slice(0, 8);
  }, [all, query]);

  const pick = (loc) => {
    setQuery(loc.path);
    setOpen(false);
    onPick(loc);
  };

  return (
    <div className="loc-auto" ref={ref}>
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim() && suggestions.length > 0 && (
        <div className="subject-auto__menu">
          {suggestions.map((s) => (
            <button key={s.id} type="button" onMouseDown={() => pick(s)}>
              <span><MapPinIcon size={14} /></span> {s.path}
              <em>{s.level === 'desa' ? 'Desa' : s.level === 'kecamatan' ? 'Kecamatan' : s.level === 'kabupaten' ? 'Kab/Kota' : 'Provinsi'}</em>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && suggestions.length === 0 && (
        <div className="subject-auto__menu">
          <button
            type="button"
            onMouseDown={() => {
              setOpen(false);
              onPick({ text: query.trim() });
            }}
          >
            <span><PenIcon size={14} /></span> Pakai teks bebas “{query.trim()}”
          </button>
        </div>
      )}
      {!query && (
        <div className="hint" style={{ marginTop: 6 }}>
          Ketik nama daerah — otomatis dipecah ke provinsi › kabupaten › kecamatan. Bila tidak ada di daftar, langsung ketik bebas.
        </div>
      )}
    </div>
  );
}
