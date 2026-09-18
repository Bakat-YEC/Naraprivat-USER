import React, { useEffect, useRef, useState } from 'react';

export default function LocationSearchInput({
  options = [],
  value = '',
  valueId = '',
  onChange,
  placeholder = 'Ketik untuk mencari…',
  icon = null,
  readOnly = false
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (value) setQuery(value);
  }, [value]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const list = readOnly ? options : (
    q.length > 0
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options
  );

  const pick = (o) => {
    onChange({ id: o.id, name: o.name });
    setQuery(o.name);
    setOpen(false);
  };

  return (
    <div className="location-search" ref={ref}>
      <input
        value={query}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => {
          if (readOnly) return;
          setQuery(e.target.value);
          setOpen(true);
          if (valueId) onChange({ id: '', name: '' });
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && list.length > 0 && (
        <div className="location-search__menu">
          {list.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={() => pick(o)}
              className={o.id === valueId ? 'is-selected' : ''}
            >
              <span className="location-search__menu-icon">{icon}</span>
              {o.name}
              {o.children ? <em>{o.children}</em> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
