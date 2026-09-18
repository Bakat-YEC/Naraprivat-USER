import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { BookOpenIcon, PlusIcon, XIcon } from './Icons';

export default function SubjectAutocomplete({
  selected = [],
  onChange,
  placeholder = 'Ketik mata pelajaran…',
  allowCreate = false,
  max = 5
}) {
  const [all, setAll] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.get('/subjects').then(setAll).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const suggestions = all
    .filter((s) => !selected.includes(s.name) && s.name.toLowerCase().includes(q))
    .slice(0, 8);

  const add = (name) => {
    if (selected.includes(name)) return;
    if (selected.length >= max) return;
    onChange([...selected, name]);
    setQuery('');
    setOpen(false);
  };

  const remove = (name) => onChange(selected.filter((x) => x !== name));

  return (
    <div className="subject-auto" ref={ref}>
      <div className="subject-auto__tags">
        {selected.map((s) => (
          <span key={s} className="tag tag--selected">
            {s}
            <button type="button" onClick={() => remove(s)} aria-label={`Hapus ${s}`}><XIcon size={12} /></button>
          </span>
        ))}
        <input
          value={query}
          placeholder={selected.length === 0 ? placeholder : 'Tambah…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          disabled={selected.length >= max}
        />
        <span className="subject-auto__hint">
          {selected.length}/{max} bidang dipilih
        </span>
      </div>
      {open && suggestions.length > 0 && (
        <div className="subject-auto__menu">
          {suggestions.map((s) => (
            <button key={s.id} type="button" onMouseDown={() => add(s.name)}>
              <span><BookOpenIcon size={14} /></span> {s.name}
              {s.isPopular && <em>Populer</em>}
            </button>
          ))}
        </div>
      )}
      {open && query && suggestions.length === 0 && allowCreate && (
        <div className="subject-auto__menu">
          <button type="button" onMouseDown={() => add(query)}>
            <span><PlusIcon size={14} /></span> Tambah “{query}”
          </button>
        </div>
      )}
    </div>
  );
}
