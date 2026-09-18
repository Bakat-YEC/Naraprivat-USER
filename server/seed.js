const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { DB_FILE, slugify } = require('./db');

const PASSWORD = 'password123';

/* ================= LOKASI (hierarki Provinsi > Kab > Kec > Desa) ================= */

const LOCATION_DATA = [
  {
    provinsi: 'DKI Jakarta',
    kabupaten: [
      { name: 'Jakarta Pusat', kecamatan: ['Menteng', 'Tanah Abang', 'Gambir'] },
      { name: 'Jakarta Selatan', kecamatan: ['Kebayoran Baru', 'Setiabudi', 'Pasar Minggu'] },
      { name: 'Jakarta Timur', kecamatan: ['Cipayung', 'Jatinegara', 'Pulo Gadung'] }
    ]
  },
  {
    provinsi: 'Jawa Barat',
    kabupaten: [
      { name: 'Kota Bandung', kecamatan: ['Coblong', 'Sukajadi', 'Buahbatu'] },
      { name: 'Kabupaten Bandung', kecamatan: ['Baleendah', 'Soreang', 'Cileunyi'] },
      { name: 'Kota Bekasi', kecamatan: ['Bekasi Utara', 'Jatiasih', 'Mustika Jaya'] }
    ]
  },
  {
    provinsi: 'Jawa Tengah',
    kabupaten: [
      { name: 'Kota Semarang', kecamatan: ['Semarang Tengah', 'Gajahmungkur', 'Banyumanik'] },
      { name: 'Kota Surakarta', kecamatan: ['Laweyan', 'Serengan', 'Pasar Kliwon'] }
    ]
  },
  {
    provinsi: 'DI Yogyakarta',
    kabupaten: [
      { name: 'Kota Yogyakarta', kecamatan: ['Gondokusuman', 'Umbulharjo', 'Kotagede'] }
    ]
  },
  {
    provinsi: 'Jawa Timur',
    kabupaten: [
      { name: 'Kota Surabaya', kecamatan: ['Rungkut', 'Wonokromo', 'Sukolilo'] },
      { name: 'Kota Madiun', kecamatan: ['Kartoharjo', 'Manguharjo', 'Taman'], desa: ['Nambangan Kidul', 'Kejuron', 'Banjarjo'] },
      { name: 'Kota Malang', kecamatan: ['Klojen', 'Lowokwaru', 'Blimbing'] },
      { name: 'Kabupaten Tulungagung', kecamatan: ['Ngantru', 'Boyolangu', 'Kedungwaru'] }
    ]
  },
  {
    provinsi: 'Sumatera Utara',
    kabupaten: [
      { name: 'Kota Medan', kecamatan: ['Medan Baru', 'Medan Selayang', 'Medan Petisah'] }
    ]
  }
];

function buildLocations() {
  const locations = [];
  let id = 1;
  const meta = {}; // map provinsi/kab/kec names to ids
  LOCATION_DATA.forEach((prov) => {
    const provId = String(id++);
    locations.push({ id: provId, name: prov.provinsi, level: 'provinsi', parentId: null });
    meta[prov.provinsi] = provId;
    prov.kabupaten.forEach((kab) => {
      const kabId = String(id++);
      locations.push({ id: kabId, name: kab.name, level: 'kabupaten', parentId: provId });
      meta[`${prov.provinsi}|${kab.name}`] = kabId;
      (kab.kecamatan || []).forEach((kec) => {
        const kecId = String(id++);
        locations.push({ id: kecId, name: kec, level: 'kecamatan', parentId: kabId });
        meta[`${prov.provinsi}|${kab.name}|${kec}`] = kecId;
        if (kab.desa && kab.desa.length) {
          kab.desa.forEach((d) => {
            const desaId = String(id++);
            locations.push({ id: desaId, name: d, level: 'desa', parentId: kecId });
            meta[`${prov.provinsi}|${kab.name}|${kec}|${d}`] = desaId;
          });
        }
      });
    });
  });
  return { locations, meta };
}

/* ================= SUBJEK ================= */

const SUBJECT_DATA = [
  ['Matematika', true], ['Bahasa Inggris', true], ['Programming', true],
  ['Fisika', true], ['Kimia', false], ['Biologi', false], ['Bahasa Indonesia', false],
  ['Bahasa Mandarin', false], ['Bahasa Jepang', false], ['Bahasa Arab', false],
  ['Bahasa Korea', false], ['Sejarah', false], ['Geografi', false], ['Ekonomi', false],
  ['Akuntansi', false], ['Web Development', false], ['Data Science', false],
  ['Musik', false], ['Gitar', false], ['Piano', false], ['Seni Rupa', false],
  ['Mengaji / Al-Quran', false], ['IPA', false], ['IPS', false], ['Sosiologi', false],
  ['PKN', false], ['Fotografi', false]
];

function buildSubjects() {
  return SUBJECT_DATA.map(([name, isPopular], i) => ({
    id: `sub_${i + 1}`,
    name,
    isPopular: Boolean(isPopular)
  }));
}

/* ================= TUTOR ================= */

const CITY_TO_KAB = {
  Jakarta: 'DKI Jakarta|Jakarta Selatan',
  Bandung: 'Jawa Barat|Kota Bandung',
  Surabaya: 'Jawa Timur|Kota Surabaya',
  Yogyakarta: 'DI Yogyakarta|Kota Yogyakarta',
  Semarang: 'Jawa Tengah|Kota Semarang',
  Medan: 'Sumatera Utara|Kota Medan'
};

const CITY_KECAMATAN = {
  Jakarta: ['Kebayoran Baru', 'Setiabudi', 'Pasar Minggu'],
  Bandung: ['Coblong', 'Sukajadi', 'Buahbatu'],
  Surabaya: ['Rungkut', 'Wonokromo', 'Sukolilo'],
  Yogyakarta: ['Gondokusuman', 'Umbulharjo', 'Kotagede'],
  Semarang: ['Semarang Tengah', 'Gajahmungkur', 'Banyumanik'],
  Medan: ['Medan Baru', 'Medan Selayang', 'Medan Petisah']
};

function tutorLocation(meta, city, index) {
  const kabKey = CITY_TO_KAB[city];
  const kecs = CITY_KECAMATAN[city] || [];
  const kec = kecs[index % kecs.length];
  return meta[`${kabKey}|${kec}`] || meta[kabKey] || null;
}

const tutorSeeds = [
  {
    name: 'Budi Santoso', email: 'budi@tutorlink.id', role: 'tutor', gender: 'Laki-laki',
    headline: 'Guru Matematika SMP-SMA & UTBK, 10 tahun pengalaman',
    bio: 'Lulusan ITB Matematika. Membantu siswa memahami konsep dengan cara sederhana dan menyenangkan. Spesialis persiapan UTBK dan ujian sekolah. Sudah membimbing 200+ siswa.',
    subjects: ['Matematika'], city: 'Jakarta', price: 150000, online: true,
    languages: ['Indonesia', 'Inggris'], experienceYears: 10, verified: true,
    availability: ['Senin 16:00-20:00', 'Rabu 16:00-20:00', 'Sabtu 09:00-14:00'],
    status: 'active', premium: true
  },
  {
    name: 'Siti Rahayu', email: 'siti@tutorlink.id', role: 'tutor', gender: 'Perempuan',
    headline: 'Tutor Bahasa Inggris IELTS/TOEFL & Conversation',
    bio: 'Pengajar Bahasa Inggris bersertifikat CELTA. Fokus pada speaking dan persiapan IELTS/TOEFL. Pengalaman mengajar 7 tahun di berbagai kursus ternama.',
    subjects: ['Bahasa Inggris'], city: 'Bandung', price: 120000, online: true,
    languages: ['Inggris', 'Indonesia'], experienceYears: 7, verified: true,
    availability: ['Selasa 10:00-15:00', 'Kamis 10:00-15:00', 'Minggu 08:00-12:00'],
    status: 'active', premium: true
  },
  {
    name: 'Dewi Lestari', email: 'dewi@tutorlink.id', role: 'tutor', gender: 'Perempuan',
    headline: 'Guru Kimia & Biologi SMA, siap bantu remidial',
    bio: 'Lulusan FMIPA UI. Menyampaikan kimia dan biologi dengan analogi kehidupan sehari-hari. Percaya semua anak bisa paham sains dengan pendekatan yang tepat.',
    subjects: ['Kimia', 'Biologi'], city: 'Surabaya', price: 140000, online: true,
    languages: ['Indonesia'], experienceYears: 6, verified: false,
    availability: ['Senin 15:00-19:00', 'Jumat 15:00-19:00', 'Sabtu 10:00-16:00'],
    status: 'active', premium: false
  },
  {
    name: 'Rizky Pratama', email: 'rizky@tutorlink.id', role: 'tutor', gender: 'Laki-laki',
    headline: 'Developer berpengalaman, mentor Programming Python & Web',
    bio: 'Full-stack developer 8 tahun di startup unicorn. Mengajar coding untuk pemula sampai profesional: Python, JavaScript, React, dan data science. Belajar sambil bikin project nyata.',
    subjects: ['Programming', 'Web Development'], city: 'Yogyakarta', price: 200000, online: true,
    languages: ['Indonesia', 'Inggris'], experienceYears: 8, verified: true,
    availability: ['Senin 19:00-21:00', 'Rabu 19:00-21:00', 'Jumat 19:00-21:00'],
    status: 'active', premium: true
  },
  {
    name: 'Andi Wijaya', email: 'andi@tutorlink.id', role: 'tutor', gender: 'Laki-laki',
    headline: 'Guru Fisika SMA & persiapan olimpiade',
    bio: 'Fisikawan muda alumni UGM. Mengajar fisika dari dasar sampai olimpiade nasional. Juara OSN Fisika 2015. Sabar dan teliti.',
    subjects: ['Fisika'], city: 'Jakarta', price: 130000, online: true,
    languages: ['Indonesia', 'Inggris'], experienceYears: 5, verified: true,
    availability: ['Selasa 17:00-20:00', 'Kamis 17:00-20:00', 'Sabtu 09:00-13:00'],
    status: 'active', premium: false
  },
  {
    name: 'Maya Anggraini', email: 'maya@tutorlink.id', role: 'tutor', gender: 'Perempuan',
    headline: 'Pengajar Bahasa Indonesia & Sastra, guru penulis',
    bio: 'Eks jurnalis dan penulis buku. Mengasah kemampuan menulis dan berbahasa Indonesia yang baik. Siap mendampingi tugas makalah, esai, dan karya ilmiah.',
    subjects: ['Bahasa Indonesia'], city: 'Bandung', price: 100000, online: true,
    languages: ['Indonesia'], experienceYears: 9, verified: false,
    availability: ['Senin 09:00-13:00', 'Rabu 09:00-13:00', 'Jumat 13:00-17:00'],
    status: 'active', premium: false
  },
  {
    name: 'Joko Susilo', email: 'joko@tutorlink.id', role: 'tutor', gender: 'Laki-laki',
    headline: 'Guru Sejarah & Geografi, pembimbing lomba KSN',
    bio: 'Guru bersertifikasi di sekolah favorit Semarang. Menguasai materi sejarah Indonesia dan dunia, serta geografi fisik dan sosial. Pembina lomba.',
    subjects: ['Sejarah', 'Geografi'], city: 'Semarang', price: 90000, online: false,
    languages: ['Indonesia', 'Jawa'], experienceYears: 12, verified: true,
    availability: ['Senin 14:00-17:00', 'Selasa 14:00-17:00', 'Rabu 14:00-17:00'],
    status: 'active', premium: false
  },
  {
    name: 'Putri Handayani', email: 'putri@tutorlink.id', role: 'tutor', gender: 'Perempuan',
    headline: 'Pianis profesional, guru Gitar & Piano semua level',
    bio: 'Lulusan ISI Yogyakarta jurusan musik. Mengajar piano klasik & modern, serta gitar akustik/elektrik. Siswa kami sudah tampil di berbagai panggung.',
    subjects: ['Musik', 'Gitar', 'Piano'], city: 'Jakarta', price: 180000, online: false,
    languages: ['Indonesia', 'Inggris'], experienceYears: 11, verified: true,
    availability: ['Senin 15:00-19:00', 'Selasa 15:00-19:00', 'Sabtu 13:00-18:00'],
    status: 'active', premium: true
  },
  {
    name: 'Agus Setiawan', email: 'agus@tutorlink.id', role: 'tutor', gender: 'Laki-laki',
    headline: 'Guru Ekonomi & Akuntansi, akuntan praktisi',
    bio: 'Akuntan bersertifikat CPA dengan pengalaman audit 8 tahun. Mengajar akuntansi dasar sampai lanjutan, plus ekonomi SMA. Cocok untuk mahasiswa dan pelajar.',
    subjects: ['Ekonomi', 'Akuntansi'], city: 'Surabaya', price: 110000, online: true,
    languages: ['Indonesia'], experienceYears: 8, verified: false,
    availability: ['Kamis 16:00-20:00', 'Jumat 16:00-20:00', 'Sabtu 10:00-14:00'],
    status: 'active', premium: false
  },
  {
    name: 'Intan Permatasari', email: 'intan@tutorlink.id', role: 'tutor', gender: 'Perempuan',
    headline: 'Guru Matematika SD & SMP, ramah untuk anak-anak',
    bio: 'S-1 PGSD, fokus mengajar anak usia 6-15 tahun. Metode belajar sambil bermain yang membuat anak gemar matematika. Tersedia les privat di rumah.',
    subjects: ['Matematika'], city: 'Medan', price: 80000, online: true,
    languages: ['Indonesia', 'Inggris'], experienceYears: 4, verified: true,
    availability: ['Senin 15:00-18:00', 'Selasa 15:00-18:00', 'Kamis 15:00-18:00'],
    status: 'active', premium: false
  },
  {
    name: 'Yoga Aditama', email: 'yoga@tutorlink.id', role: 'tutor', gender: 'Laki-laki',
    headline: 'Native-speaker level, guru Bahasa Mandarin & HSK',
    bio: 'Lulusan Sastra China UI dengan beasiswa 2 tahun di Beijing. Mengajar Mandarin dari nol sampai HSK 5. Menggunakan kurikulum yang terbukti efektif.',
    subjects: ['Bahasa Mandarin', 'Bahasa Jepang'], city: 'Jakarta', price: 160000, online: true,
    languages: ['Mandarin', 'Indonesia', 'Inggris'], experienceYears: 6, verified: true,
    availability: ['Selasa 18:00-21:00', 'Kamis 18:00-21:00', 'Minggu 10:00-15:00'],
    status: 'active', premium: true
  },
  {
    name: 'Rina Marlina', email: 'rina@tutorlink.id', role: 'tutor', gender: 'Perempuan',
    headline: 'Spesialis UTBK Matematika-Fisika, kurikulum K13 & Merdeka',
    bio: 'Lulusan UI dengan pengalaman bimbel 6 tahun. Ratusan siswa tembus PTN favorit. Menyusun materi sesuai kurikulum terbaru dan latihan soal high-level.',
    subjects: ['Matematika', 'Fisika'], city: 'Bandung', price: 175000, online: true,
    languages: ['Indonesia', 'Inggris'], experienceYears: 6, verified: true,
    availability: ['Senin 16:00-19:00', 'Rabu 16:00-19:00', 'Jumat 16:00-19:00', 'Sabtu 08:00-12:00'],
    status: 'active', premium: false
  }
];

const studentSeeds = [
  { name: 'Andika Putra', email: 'student@tutorlink.id', role: 'student' },
  { name: 'Nadia Kirana', email: 'nadia@tutorlink.id', role: 'student' },
  { name: 'Fajar Ramadhan', email: 'fajar@tutorlink.id', role: 'student' },
  { name: 'Salsabila Azzahra', email: 'salsa@tutorlink.id', role: 'student' }
];

/* ================= AFFILIATE & ADMIN ================= */

const affiliateSeeds = [
  { id: 'aff_1', name: 'Toko Buku Ahmad', couponCode: 'AHMAD10', commissionPct: 10 },
  { id: 'aff_2', name: 'Komunitas Belajar', couponCode: 'KOMUN15', commissionPct: 15 }
];

const adminSeeds = [
  { name: 'Admin System', email: 'admin.system@naraprivat.id', role: 'system' },
  { name: 'Admin Operasional', email: 'admin.ops@naraprivat.id', role: 'operasional' },
  { name: 'Admin CS', email: 'admin.cs@naraprivat.id', role: 'cs' },
  { name: 'Admin Keuangan', email: 'admin.keuangan@naraprivat.id', role: 'keuangan' },
  { name: 'Admin Analytics', email: 'admin.analytics@naraprivat.id', role: 'analytics' }
];

/* ================= REVIEW ================= */

const reviewPool = [
  { rating: 5, comment: 'Cara mengajarnya sangat jelas dan sabar. Nilai anak saya naik drastis!' },
  { rating: 5, comment: 'Tutor yang luar biasa, selalu siap membantu dan materi tersampaikan dengan baik.' },
  { rating: 4, comment: 'Bagus dan profesional. Sedikit telat di sesi pertama, tapi hasilnya memuaskan.' },
  { rating: 5, comment: 'Recommended banget! Penjelasannya mudah dipahami, pakai contoh nyata.' },
  { rating: 4, comment: 'Kompeten di bidangnya. Komunikasi dan jadwal juga fleksibel.' },
  { rating: 5, comment: 'Anak saya jadi semangat belajar. Terima kasih tutornya!' },
  { rating: 3, comment: 'Cukup baik, tapi kadang materi terlalu cepat untuk pemula.' }
];

function pickReview(index) {
  return reviewPool[index % reviewPool.length];
}

function hashAll() {
  return bcrypt.hashSync(PASSWORD, 10);
}

/* ================= BUILD ================= */

function buildSeed() {
  const now = Date.now();
  const hash = hashAll();

  const { locations, meta } = buildLocations();
  const subjects = buildSubjects();

  const subjectMap = {};
  subjects.forEach((s) => { subjectMap[s.name] = s.id; });

  const users = [];
  const transactions = [];
  const searchLogs = [];
  const bookings = [];
  const reviews = [];

  // --- TUTOR ---
  tutorSeeds.forEach((t, i) => {
    const locationId = tutorLocation(meta, t.city, i);
    const firstSubject = t.subjects[0];
    const slug = slugify(`${firstSubject} ${t.city} ${t.name}`);
    const educationHistory = [
      { degree: i % 2 ? 'Sarjana (S1)' : 'Magister (S2)', institution: `Universitas ${['Indonesia', 'ITB', 'Gadjah Mada', 'Airlangga', 'Negeri Jakarta'][i % 5]}`, year: String(2005 + (i * 2) % 14) },
      { degree: 'SMA', institution: t.city === 'Jakarta' ? 'SMA Negeri 1 Jakarta' : `SMA Negeri ${i % 5 + 1} ${t.city}`, year: String(2000 + (i * 3) % 5) }
    ];
    users.push({
      id: String(i + 1),
      name: t.name,
      email: t.email,
      passwordHash: hash,
      role: 'tutor',
      gender: t.gender,
      headline: t.headline,
      bio: t.bio,
      subjects: t.subjects,
      subjectIds: t.subjects.map((s) => subjectMap[s]).filter(Boolean),
      city: t.city,
      locationId,
      price: t.price,
      online: t.online,
      languages: t.languages,
      experienceYears: t.experienceYears,
      verified: t.verified,
      availability: t.availability,
      whatsapp: `08${String(1234567000 + i).slice(1, 12)}${i}`,
      contactEmail: `${slugify(t.name)}@gmail.com`,
      educationHistory,
      certificates: [
        { id: `cert_${i + 1}`, name: `Sertifikat ${t.subjects[0]}.pdf`, size: 120000, verified: t.verified }
      ],
      availabilityStatus: i % 3 === 2 ? 'full' : 'available',
      isPremium: Boolean(t.premium),
      premiumExpiresAt: t.premium ? new Date(now + 30 * 86400000).toISOString() : null,
      status: 'active',
      slug,
      unlockCountToday: 0,
      createdAt: new Date(now - (30 - i) * 86400000).toISOString(),
      updatedAt: new Date(now - (10 - i) * 86400000).toISOString()
    });
  });

  // --- STUDENT ---
  studentSeeds.forEach((s, i) => {
    users.push({
      id: String(tutorSeeds.length + i + 1),
      name: s.name,
      email: s.email,
      passwordHash: hash,
      role: 'student',
      phoneOrEmail: s.email,
      sessionToken: null,
      createdAt: new Date(now - (25 - i) * 86400000).toISOString()
    });
  });

  const tutorCount = tutorSeeds.length;
  const studentCount = studentSeeds.length;
  const demoId = String(tutorCount + studentCount + 1);
  users.push({
    id: demoId,
    name: 'Dian Kusuma',
    email: 'tutor@tutorlink.id',
    passwordHash: hash,
    role: 'tutor',
    gender: 'Perempuan',
    headline: 'Guru Matematika & Bahasa Inggris, kurikulum nasional & Cambridge',
    bio: 'Akun demo tutor. Lulusan Pendidikan Matematika dengan pengalaman 5 tahun mengajar les privat dan kelas internasional. Terbuka untuk murid SD, SMP, dan SMA.',
    subjects: ['Matematika', 'Bahasa Inggris'],
    subjectIds: ['Matematika', 'Bahasa Inggris'].map((s) => subjectMap[s]).filter(Boolean),
    city: 'Jakarta',
    locationId: meta['DKI Jakarta|Jakarta Selatan|Kebayoran Baru'],
    price: 150000,
    online: true,
    languages: ['Indonesia', 'Inggris'],
    experienceYears: 5,
    verified: true,
    availability: ['Senin 17:00-20:00', 'Rabu 17:00-20:00', 'Sabtu 09:00-13:00'],
    whatsapp: '081234567899',
    contactEmail: 'dian.kusuma@gmail.com',
    gender: 'Perempuan',
    educationHistory: [
      { degree: 'Sarjana (S1)', institution: 'Universitas Negeri Jakarta', year: '2015' },
      { degree: 'SMA', institution: 'SMA Negeri 1 Jakarta', year: '2011' }
    ],
    certificates: [{ id: 'cert_demo', name: 'Sertifikat Pendidik.pdf', size: 95000, verified: true }],
    availabilityStatus: 'available',
    isPremium: false,
    premiumExpiresAt: null,
    status: 'active',
    slug: slugify('Matematika Jakarta Dian Kusuma'),
    unlockCountToday: 0,
    createdAt: new Date(now - 200 * 86400000).toISOString(),
    updatedAt: new Date(now - 3 * 86400000).toISOString()
  });

  // --- TRANSACTIONS DEMO (Student Pass) ---
  const studentIds = studentSeeds.map((_, i) => String(tutorCount + i + 1));
  const demoStudentId = studentIds[0];
  transactions.push({
    id: 'tx_1001',
    type: 'student_pass',
    studentId: demoStudentId,
    tutorId: '1',
    amount: 59000,
    couponCode: null,
    affiliateId: null,
    paymentStatus: 'failed',
    gatewayRef: 'MOCK-' + String(Date.now()).slice(0, 8),
    returnUrl: '/tutor/matematika-jakarta-budi-santoso',
    createdAt: new Date(now - 3 * 86400000).toISOString(),
    paidAt: null
  });
  transactions.push({
    id: 'tx_1002',
    type: 'student_pass',
    studentId: studentIds[1],
    tutorId: '2',
    amount: 49000,
    couponCode: 'AHMAD10',
    affiliateId: 'aff_1',
    paymentStatus: 'success',
    gatewayRef: 'MOCK-' + String(Date.now()).slice(1, 9),
    returnUrl: '/tutor/bahasa-inggris-bandung-siti-rahayu',
    createdAt: new Date(now - 2 * 86400000).toISOString(),
    paidAt: new Date(now - 2 * 86400000).toISOString()
  });

  // --- SEARCH LOGS DEMO (Live Feed) ---
  const feedSubjects = ['Matematika', 'Bahasa Inggris', 'Fisika', 'Programming', 'Kimia', 'Biologi', 'Gitar', 'Sejarah'];
  const feedLocations = ['Kebayoran Baru', 'Coblong', 'Rungkut', 'Gondokusuman', 'Semarang Tengah', 'Kartoharjo'];
  for (let i = 0; i < 12; i++) {
    const subj = feedSubjects[i % feedSubjects.length];
    const loc = feedLocations[(i * 3) % feedLocations.length];
    const locEntry = locations.find((l) => l.name === loc && l.level === 'kecamatan');
    searchLogs.push({
      id: `log_${1000 + i}`,
      subject: subj,
      subjectId: subjectMap[subj],
      locationId: locEntry ? locEntry.id : null,
      locationName: loc,
      resultCount: 1 + (i % 8),
      createdAt: new Date(now - (40 - i * 3) * 60000).toISOString()
    });
  }
  searchLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // --- BOOKINGS & REVIEWS (fitur lama, dipertahankan) ---
  let bookingId = 1;
  let reviewId = 1;
  for (let i = 0; i < 34; i++) {
    const tutorIdx = i % tutorCount;
    const studentIdx = (i + 2) % studentCount;
    const tutorId = String(tutorIdx + 1);
    const studentId = String(tutorCount + studentIdx + 1);
    const subject = tutorSeeds[tutorIdx].subjects[i % tutorSeeds[tutorIdx].subjects.length];
    const mode = i % 5 === 4 ? 'offline' : 'online';
    let status = 'completed';
    if (i >= 30) status = 'pending';
    else if (i >= 28) status = 'accepted';
    const createdAt = new Date(now - (20 - i) * 86400000).toISOString();
    const date = new Date(now + (i + 1) * 3 * 86400000).toISOString().slice(0, 10);

    bookings.push({
      id: String(bookingId++),
      tutorId,
      studentId,
      subject,
      date,
      startTime: '16:00',
      endTime: '17:30',
      mode,
      price: tutorSeeds[tutorIdx].price,
      status,
      note: '',
      createdAt
    });

    if (status === 'completed') {
      const rv = pickReview(i);
      reviews.push({
        id: String(reviewId++),
        bookingId: bookings[bookings.length - 1].id,
        tutorId,
        studentId,
        rating: rv.rating,
        comment: rv.comment,
        createdAt
      });
    }
  }

  const demoReviews = [
    { rating: 5, comment: 'Tutor sabar dan penyampaiannya sangat jelas. Anak saya jauh lebih percaya diri.' },
    { rating: 5, comment: 'Materinya lengkap, jadwal fleksibel, dan selalu tepat waktu. Recommended!' }
  ];
  for (let i = 0; i < 2; i++) {
    const studentIdx = i % studentCount;
    const studentId = String(tutorCount + studentIdx + 1);
    const createdAt = new Date(now - (60 - i * 30) * 86400000).toISOString();
    const bid = String(bookingId++);
    bookings.push({
      id: bid,
      tutorId: demoId,
      studentId,
      subject: i === 0 ? 'Matematika' : 'Bahasa Inggris',
      date: new Date(now - (55 - i * 30) * 86400000).toISOString().slice(0, 10),
      startTime: '17:00',
      endTime: '18:30',
      mode: 'online',
      price: 150000,
      status: 'completed',
      note: '',
      createdAt
    });
    reviews.push({
      id: String(reviewId++),
      bookingId: bid,
      tutorId: demoId,
      studentId,
      rating: demoReviews[i].rating,
      comment: demoReviews[i].comment,
      createdAt
    });
  }

  // --- AFFILIATES & ADMINS ---
  const affiliates = affiliateSeeds.map((a) => ({ ...a, createdAt: new Date(now - 40 * 86400000).toISOString() }));
  const admins = adminSeeds.map((a, i) => ({
    id: String(i + 1),
    name: a.name,
    email: a.email,
    passwordHash: hash,
    role: a.role,
    createdAt: new Date(now - 30 * 86400000).toISOString()
  }));

  return {
    users,
    bookings,
    reviews,
    locations,
    subjects,
    transactions,
    affiliates,
    searchLogs,
    admins,
    sessions: [],
    notifications: []
  };
}

function run() {
  const db = buildSeed();
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  console.log('Seed data NARAPRIVAT berhasil dibuat:');
  console.log({
    users: db.users.length,
    tutors: db.users.filter((u) => u.role === 'tutor').length,
    students: db.users.filter((u) => u.role === 'student').length,
    locations: db.locations.length,
    subjects: db.subjects.length,
    transactions: db.transactions.length,
    affiliates: db.affiliates.length,
    admins: db.admins.length,
    searchLogs: db.searchLogs.length,
    bookings: db.bookings.length,
    reviews: db.reviews.length
  });
  console.log('\nAkun demo:');
  console.log('  Siswa -> student@tutorlink.id / password123');
  console.log('  Tutor -> tutor@tutorlink.id   / password123');
  console.log('  Admin -> admin.system@naraprivat.id / password123 (dan 4 admin lain)');
}

run();
