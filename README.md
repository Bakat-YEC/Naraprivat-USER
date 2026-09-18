# TutorLink — Marketplace Tutor & Trainer (gaya Superprof)

Website marketplace lengkap untuk menemukan tutor/trainer les privat — **online maupun tatap muka**. Dibangun ala pro web developer: React (Vite) di frontend, Node.js + Express di backend, dan JSON file sebagai database sederhana (tanpa perlu install database engine).

## Fitur

| Area | Fitur |
|---|---|
| 🏠 Beranda | Hero + pencarian cepat, kategori mata pelajaran, tutor unggulan, cara kerja, CTA |
| 🔍 Pencarian | Filter berdasarkan kata kunci, mata pelajaran, kota, rentang harga, rating minimum, mode online + sorting + pagination |
| 📖 Profil tutor | Bio, pengalaman, jadwal, bahasa, ulasan & rating siswa |
| 📅 Booking | Siswa pesan kelas (tanggal, jam, metode, catatan), tutor terima/tolak, selesai, batal |
| ⭐ Review | Siswa menilai tutor (1–5 bintang + komentar) setelah kelas selesai, rating terupdate otomatis |
| 👤 Auth | Register & login (siswa/tutor), JWT, proteksi halaman |
| 📊 Dashboard | Ringkasan statistik, kelola pesanan, kelola profil tutor, riwayat ulasan |

## Teknologi

- **Frontend:** React 18, Vite 5, React Router 6, Context API (auth & toast)
- **Backend:** Node.js, Express, JWT, bcryptjs
- **Database:** JSON file (`server/data/db.json`) — mudah di-reset

## Cara menjalankan

Persyaratan: **Node.js 18+**

```bash
# 1) Install semua dependensi (root + server + client)
npm run setup

# 2) Seed data contoh + akun demo
npm run seed

# 3) Jalankan server API (http://localhost:5000) DAN frontend (http://localhost:5173) sekaligus
npm run dev
```

Buka **http://localhost:5173**

### Mode produksi (build + satu server)

```bash
npm run seed
npm run build
$env:NODE_ENV="production"; npm start     # Windows PowerShell
# NODE_ENV=production npm start           # Linux/macOS
```

Buka **http://localhost:5000** (frontend build disajikan oleh Express).

## Akun demo

| Role | Email | Password |
|---|---|---|
| Siswa | `student@tutorlink.id` | `password123` |
| Tutor | `tutor@tutorlink.id` | `password123` |

Tutor lain (mis. `budi@tutorlink.id`, `rina@tutorlink.id`) juga pakai `password123`.

## Struktur proyek

```
9Router/
├── package.json            # skrip gabungan (setup/seed/dev/build)
├── server/
│   ├── index.js            # entry Express
│   ├── seed.js             # pembuat data contoh
│   ├── db.js               # helper baca/tulis JSON
│   ├── middleware/auth.js  # verifikasi JWT
│   ├── routes/             # auth, tutors, bookings, reviews
│   └── data/db.json        # database (dibuat oleh seed)
└── client/
    ├── vite.config.js      # proxy /api -> :5000
    └── src/
        ├── pages/          # Home, Tutors, TutorDetail, Login, Register, Dashboard
        ├── components/     # Navbar, Footer, TutorCard, StarRating, Protected
        ├── context/        # AuthContext, ToastContext
        ├── api.js          # client HTTP + helpers
        └── index.css       # design system
```

## Reset data

```bash
npm run seed    # tulis ulang db.json dari nol
```

## Endpoint API utama

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/register` | Daftar siswa/tutor |
| POST | `/api/auth/login` | Login → token JWT |
| GET | `/api/me` | User yang sedang login |
| GET | `/api/tutors` | Daftar tutor + filter & pagination |
| GET | `/api/tutors/:id` | Detail tutor + ulasan |
| PATCH | `/api/tutors/me` | Perbarui profil tutor |
| POST | `/api/bookings` | Siswa memesan kelas |
| GET | `/api/bookings/mine` | Pesanan user yang login |
| PATCH | `/api/bookings/:id` | Ganti status (terima/tolak/selesai/batal) |
| POST | `/api/reviews` | Beri ulasan setelah kelas selesai |
