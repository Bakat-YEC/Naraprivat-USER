import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  hint
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
          onClick={() => setShow((s) => !s)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 40,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}