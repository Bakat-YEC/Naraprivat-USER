import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, getPendingPayment, clearPendingPayment } from '../api';
import { ClockIcon, XIcon } from './Icons';

export default function ResumePaymentBanner() {
  const location = useLocation();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const pending = getPendingPayment();
    if (!pending || !pending.sessionToken) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    api.get(`/payments/session/${pending.sessionToken}`)
      .then((data) => {
        if (cancelled) return;
        if (data.resolved) {
          clearPendingPayment();
          setInfo(null);
          return;
        }
        setInfo({
          tutorName: data.tutor ? data.tutor.name : 'profil tutor',
          paymentUrl: `/payments/mock/${pending.transactionId}`,
          expiresAt: data.expiresAt
        });
      })
      .catch(() => {
        clearPendingPayment();
        setInfo(null);
      });
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (!info) return null;
  if (location.pathname.startsWith('/payments/mock')) return null;

  return (
    <div className="resume-banner">
      <span className="resume-banner__icon"><ClockIcon size={16} /></span>
      <div className="resume-banner__text">
        Pembayaran <b>Akses Premium</b> untuk <b>{info.tutorName}</b> belum selesai.
        Sesi disimpan 24 jam.
      </div>
      <Link to={info.paymentUrl} className="btn btn--sm btn--primary">
        Lanjutkan Pembayaran →
      </Link>
      <button
        className="resume-banner__close"
        onClick={() => { clearPendingPayment(); setInfo(null); }}
        aria-label="Tutup"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}
