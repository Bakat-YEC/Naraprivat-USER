import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <section className="section">
      <div className="container container--narrow">
        <div className="legal">
          <Link to="/" className="btn btn--ghost btn--sm mb-16">← Kembali</Link>
          <h1>Kebijakan Privasi</h1>
          <p className="legal__meta">Terakhir diperbarui: {new Date().getFullYear()}</p>

          <p>
            Privasi Anda penting bagi <b>Naraprivat</b>. Kebijakan ini menjelaskan data apa yang kami
            kumpulkan, bagaimana kami menggunakannya, dan hak Anda atas data tersebut.
          </p>

          <h2>1. Data yang Kami Kumpulkan</h2>
          <ul>
            <li><b>Data akun:</b> nama, email, nomor WhatsApp/HP, dan password (terenkripsi).</li>
            <li><b>Data transaksi:</b> riwayat pembelian Akses Premium, metode pembayaran, dan status pembayaran.</li>
            <li><b>Data profil tutor:</b> pendidikan, sertifikat, foto, bidang ajar, dan lokasi mengajar.</li>
          </ul>

          <h2>2. Penggunaan Data</h2>
          <ul>
            <li>Membuat dan mengelola akun serta memberikan akses layanan.</li>
            <li>Memproses pembayaran dan mengirim kredensial akun melalui email.</li>
            <li>Meningkatkan kualitas layanan, keamanan, dan mencegah penyalahgunaan.</li>
          </ul>

          <h2>3. Berbagi Data</h2>
          <p>
            Kami <b>tidak menjual</b> data pribadi Anda. Data hanya dibagikan kepada pihak yang diperlukan
            untuk operasional layanan, misalnya penyedia payment gateway, dan kepada tutor yang Anda hubungi
            sebatas kontak yang relevan.
          </p>

          <h2>4. Keamanan Data</h2>
          <p>
            Password disimpan dalam bentuk <b>hash</b> dan komunikasi data dilindungi. Meski demikian, tidak
            ada sistem yang 100% aman — kami mengimbau Anda menjaga kerahasiaan kredensial.
          </p>

          <h2>5. Hak Anda</h2>
          <ul>
            <li>Meminta akses, koreksi, atau penghapusan data pribadi Anda.</li>
            <li>Menarik persetujuan pemrosesan data sesuai ketentuan yang berlaku.</li>
          </ul>

          <h2>6. Kontak</h2>
          <p>
            Permintaan terkait privasi dapat dikirim ke <b>halo@naraprivat.id</b>.
          </p>
        </div>
      </div>
    </section>
  );
}
