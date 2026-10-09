import React, { useEffect, useState } from 'react';
import { api, avatarColor, initials, buildWhatsappLink } from '../api';
import { MessageCircleIcon, PhoneIcon, XIcon, MailIcon } from './Icons';

const OPEN_EVENT = 'naraprivat:open-support';

// Klik "Hubungi CS" → langsung diarahkan ke WhatsApp CS yang bertugas (round-robin).
export async function openSupport() {
  // Buka tab kosong lebih dulu (sinkron) agar tidak diblokir popup blocker.
  const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  try {
    const data = await api.get('/support/cs');
    if (data && data.available && data.cs) {
      const msg = `Halo ${String(data.cs.name || '').split(' ').pop()}! Saya butuh bantuan terkait NARAPRIVAT.`;
      const url = buildWhatsappLink(data.cs.whatsapp, msg);
      if (win && !win.closed) win.location.href = url;
      else window.location.href = url;
      return;
    }
  } catch (e) {
    // jatuh ke fallback di bawah
  }
  if (win && !win.closed) win.close();
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cs, setCs] = useState(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Sembunyikan tombol Bantuan/CS saat area footer terlihat di layar
  useEffect(() => {
    const footer = document.querySelector('footer.footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { rootMargin: '0px 0px 0px 0px', threshold: 0.08 }
    );
    obs.observe(footer);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!open) {
      setCs(null);
      return;
    }
    setLoading(true);
    api
      .get('/support/cs')
      .then((data) => setCs(data.available ? data.cs : null))
      .catch(() => setCs(null))
      .finally(() => setLoading(false));
  }, [open]);

  const waMessage = cs
    ? `Halo ${String(cs.name || '').split(' ').pop()}! Saya butuh bantuan terkait NARAPRIVAT.`
    : '';

  return (
    <>
      {!open && !footerVisible && (
        <button className="support-fab" aria-label="Hubungi CS" onClick={openSupport}>
          <MessageCircleIcon size={22} />
        </button>
      )}

      {open && (
        <div className="modal-overlay support-overlay" onClick={() => setOpen(false)}>
          <div className="modal support-modal" onClick={(e) => e.stopPropagation()}>
            <div className="support-head">
              <div>
                <b style={{ fontSize: 17 }}>Hubungi CS — NARAPRIVAT</b>
                <div className="text-sm support-head__sub">Dilayani bergantian oleh tim CS kami</div>
              </div>
              <button className="icon-btn" aria-label="Tutup" onClick={() => setOpen(false)}>
                <XIcon size={18} />
              </button>
            </div>

            {loading ? (
              <div className="spinner center" style={{ padding: 40 }} />
            ) : cs ? (
              <>
                <div className="support-cs-card">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {cs.photoUrl ? (
                      <img className="avatar avatar--img" style={{ width: 46, height: 46, fontSize: 18 }} src={cs.photoUrl} alt={cs.name} />
                    ) : (
                      <span className="avatar" style={{ width: 46, height: 46, fontSize: 18, backgroundColor: avatarColor(cs.name) }}>
                        {initials(cs.name)}
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 15 }}>{cs.name}</b>
                        <span className="badge badge--green" style={{ fontSize: 11 }}>CS aktif</span>
                      </div>
                      <div className="text-sm text-muted">{cs.greeting}</div>
                    </div>
                  </div>
                </div>

                <a
                  className="btn btn--primary btn--block btn--lg"
                  href={buildWhatsappLink(cs.whatsapp, waMessage)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <PhoneIcon size={18} /> Chat WhatsApp CS
                </a>
              </>
            ) : (
              <div className="empty" style={{ padding: 24 }}>
                <b>CS sedang tidak online</b>
                <span className="text-sm text-muted" style={{ marginTop: 8 }}>
                  Semua CS kami sedang tidak tersedia saat ini. Silakan hubungi kami lewat email.
                </span>
                <a className="btn btn--outline btn--sm mt-8" href="mailto:cs@naraprivat.id">
                  <MailIcon size={14} /> Email cs@naraprivat.id
                </a>
                <button type="button" className="btn btn--ghost btn--sm mt-8" onClick={openSupport}>
                  Coba lagi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
