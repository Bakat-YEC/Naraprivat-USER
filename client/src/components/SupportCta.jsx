import React from 'react';
import { MessageCircleIcon } from './Icons';
import { openSupport } from './SupportWidget';

export default function SupportCta() {
  return (
    <section className="support-cta">
      <div className="container support-cta__inner">
        <div className="support-cta__text">
          <b>Masih bingung atau butuh bantuan?</b>
          <span>Tim CS NARAPRIVAT siap membantu kamu memilih tutor dan menyelesaikan kendala.</span>
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={openSupport}>
          <MessageCircleIcon size={17} /> Minta tolong CS
        </button>
      </div>
    </section>
  );
}
