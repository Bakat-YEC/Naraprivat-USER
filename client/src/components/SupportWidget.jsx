import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { api, avatarColor, initials, buildWhatsappLink } from '../api';
import { MessageCircleIcon, PhoneIcon, TicketIcon, XIcon, CheckIcon, MailIcon } from './Icons';

const OPEN_EVENT = 'naraprivat:open-support';
export function openSupport() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

const SUBJECTS = ['Bantuan umum', 'Pembayaran / Akses Premium', 'Akun & login', 'Pesan / les', 'Lainnya'];

export default function SupportWidget() {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cs, setCs] = useState(null);
  const [view, setView] = useState('cs');
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', subject: SUBJECTS[0], message: '' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

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
      setView('cs');
      setDone(null);
      return;
    }
    setLoading(true);
    api
      .get('/support/cs')
      .then((data) => {
        setCs(data.available ? data.cs : null);
        setView(data.available ? 'cs' : 'form');
      })
      .catch(() => setView('form'))
      .finally(() => setLoading(false));
  }, [open]);

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      push('Nama dan pesan bantuan wajib diisi.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/support/tickets', {
        name: form.name,
        email: form.email,
        whatsapp: form.whatsapp,
        subject: form.subject,
        message: form.message
      });
      setDone(res);
      setView('done');
    } catch (err) {
      push(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const waMessage = cs
    ? `Halo ${cs.name.split(' ').pop()}! Saya butuh bantuan terkait NARAPRIVAT.`
    : '';

  return (
    <>
      {!open && !footerVisible && (
        <button className="support-fab" aria-label="Hubungi CS" onClick={() => setOpen(true)}>
          <MessageCircleIcon size={22} />
          <span className="support-fab__label">Bantuan / CS</span>
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
            ) : view === 'cs' && cs ? (
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

                <button className="btn btn--ghost btn--block mt-8" onClick={() => setView('form')}>
                  <TicketIcon size={16} /> Lebih suka formulir? Kirim tiket bantuan
                </button>
              </>
            ) : view === 'form' ? (
              <form onSubmit={submitTicket}>
                <div className="field">
                  <label>Nama kamu</label>
                  <input
                    placeholder="cth: Rina Marlina"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                {cs && (
                  <div className="field">
                    <label>CS yang bertugas</label>
                    <div className="support-cs-mini">
                      <span className="avatar" style={{ width: 30, height: 30, fontSize: 12, backgroundColor: avatarColor(cs.name) }}>
                        {initials(cs.name)}
                      </span>
                      <div>
                        <b style={{ fontSize: 14 }}>{cs.name}</b>
                        <span className="text-sm text-muted">{cs.greeting}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="field">
                  <label>Kontak balasan (email / WhatsApp) — opsional</label>
                  <input
                    placeholder="email@kamu.com atau 081234567890"
                    value={form.email || form.whatsapp}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <div className="hint">CS akan membalas lewat kontak ini.</div>
                </div>
                <div className="field">
                  <label>Topik</label>
                  <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Pesan bantuan</label>
                  <textarea
                    rows={4}
                    placeholder="Ceritakan kendala Anda..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>
                <button className="btn btn--primary btn--block btn--lg" disabled={saving}>
                  {saving ? 'Mengirim...' : 'Kirim Tiket Bantuan'}
                </button>
                {cs && (
                  <button type="button" className="btn btn--ghost btn--block mt-8" onClick={() => setView('cs')}>
                    ← Kembali ke chat WhatsApp
                  </button>
                )}
              </form>
            ) : (
              <div className="empty" style={{ padding: 24 }}>
                <b>Terima kasih! Tiketmu terkirim.</b>
                <span className="text-sm text-muted" style={{ marginTop: 8 }}>
                  No. tiket: <code className="code">{done?.id}</code>
                  {done?.assignedToName ? (
                    <> — akan ditangani oleh <b>{done.assignedToName}</b>.</>
                  ) : (
                    ' — akan diproses tim CS.'
                  )}
                  <br />
                  Pantau email/WhatsApp kamu untuk balasan.
                </span>
                <CheckIcon size={30} style={{ color: 'var(--green)', margin: '10px 0' }} />
                <button className="btn btn--outline btn--sm" onClick={() => setOpen(false)}>
                  Tutup
                </button>
              </div>
            )}

            {!(loading || (view === 'done')) && (
              <p className="text-sm text-muted center mt-8" style={{ opacity: 0.75 }}>
                <MailIcon size={12} style={{ verticalAlign: '-1px' }} /> Alternatif: cs@naraprivat.id
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}