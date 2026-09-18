import React from 'react';
import { MessageCircleIcon } from './Icons';
import { openSupport } from './SupportWidget';

export default function SupportBar() {
  return (
    <div className="support-bar">
      <div className="container support-bar__inner">
        <span className="support-bar__text">
          Butuh bantuan memilih tutor atau ada kendala pembayaran?
        </span>
        <button type="button" className="support-bar__btn" onClick={openSupport}>
          <MessageCircleIcon size={15} /> Hubungi CS
        </button>
      </div>
    </div>
  );
}
