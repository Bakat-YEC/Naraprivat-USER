import React from 'react';
import { Link } from 'react-router-dom';

export default function AgreeCheckbox({ checked, onChange, id = 'agree' }) {
  return (
    <label className="agree-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        Saya menyetujui{' '}
        <Link to="/syarat-ketentuan" target="_blank" rel="noopener noreferrer">Syarat dan Ketentuan</Link>{' '}
        serta{' '}
        <Link to="/kebijakan-privasi" target="_blank" rel="noopener noreferrer">Kebijakan Privasi</Link>{' '}
        <span className="agree-check__req">*</span>
      </span>
    </label>
  );
}
