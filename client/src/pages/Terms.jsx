import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <section className="section">
      <div className="container container--narrow">
        <div className="legal">
          <Link to="/" className="btn btn--ghost btn--sm mb-16">← Kembali</Link>
          <h1>Syarat dan Ketentuan</h1>
          <p className="legal__meta">Terakhir diperbarui: {new Date().getFullYear()}</p>

          <p>
            Selamat datang di <b>Naraprivat</b>. Dengan mendaftar, membeli Akses Premium, atau menggunakan
            layanan kami, Anda dianggap telah membaca dan menyetujui seluruh syarat dan ketentuan di bawah ini.
          </p>

          <h2>1. Definisi Layanan</h2>
          <p>
            Naraprivat adalah <b>marketplace</b> yang mempertemukan murid dengan tutor. Kami tidak
            menyelenggarakan les secara langsung; seluruh kegiatan belajar disepakati antara murid dan tutor.
          </p>

          <h2>2. Akun Pengguna</h2>
          <ul>
            <li>Anda wajib memberikan data yang benar, akurat, dan terbaru saat mendaftar.</li>
            <li>Anda bertanggung jawab menjaga kerahasiaan <b>password</b> dan seluruh aktivitas pada akun Anda.</li>
            <li>Satu akun hanya boleh digunakan oleh satu orang dan tidak boleh dipindahtangankan.</li>
          </ul>

          <h2>3. Akses Premium &amp; Pembayaran</h2>
          <ul>
            <li>Akses Premium bersifat <b>sekali bayar</b> dengan masa aktif <b>7 hari</b> dan bukan langganan otomatis.</li>
            <li>Nominal pembayaran mencakup <b>kode unik 3 digit</b> untuk keperluan verifikasi transaksi.</li>
            <li>Pembayaran yang sudah berhasil <b>tidak dapat dikembalikan</b>, kecuali ditentukan lain oleh hukum yang berlaku.</li>
            <li>Kode kupon yang tidak valid tidak mengurangi kewajiban pembayaran Anda.</li>
          </ul>

          <h2>4. Kewajiban Tutor</h2>
          <ul>
            <li>Tutor wajib memberikan informasi profil, pendidikan, dan sertifikat yang <b>benar</b>.</li>
            <li>Tutor dilarang melakukan tindakan penipuan, pelecehan, atau hal yang merugikan murid.</li>
            <li>Naraprivat berhak menonaktifkan akun yang terbukti melanggar ketentuan ini.</li>
          </ul>

          <h2>5. Batasan Tanggung Jawab</h2>
          <p>
            Naraprivat tidak bertanggung jawab atas kesepakatan, kualitas pengajaran, maupun kerugian yang
            timbul dari interaksi antara murid dan tutor di luar platform kami.
          </p>

          <h2>6. Perubahan Ketentuan</h2>
          <p>
            Kami dapat memperbarui syarat dan ketentuan ini sewaktu-waktu. Versi terbaru akan selalu
            dipublikasikan pada halaman ini.
          </p>

          <h2>7. Kontak</h2>
          <p>
            Pertanyaan terkait syarat dan ketentuan dapat dikirim ke <b>halo@naraprivat.id</b>.
          </p>
        </div>
      </div>
    </section>
  );
}
