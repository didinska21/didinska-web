// ══════════════════════════════════════════════════════════
//  JADWAL EKONOMI MANUAL — Sprint 12
//  ------------------------------------------------------------
//  File ini di-edit MANUAL setiap minggu. Tidak ada proses build,
//  tidak ada API — tinggal edit array di bawah, commit, push, GitHub
//  Pages otomatis update.
//
//  Isi awal (Jul-Des 2026) = 4 event paling berdampak ke crypto/forex/
//  saham: NFP, CPI, PPI, FOMC. Tanggal & jam diambil dari kalender
//  RESMI:
//    - NFP/CPI/PPI : https://www.bls.gov/schedule/news_release/  (BLS)
//    - FOMC        : https://www.federalreserve.gov/  (jadwal 2026
//                    dikonfirmasi Fed per Agustus 2024)
//  Semua rilis jam AS (Eastern Time) sudah dikonversi ke WIB (UTC+7),
//  perhatikan pergantian EDT->EST per 1 November 2026.
//
//  "forecast" & "previous" SENGAJA DIKOSONGKAN — consensus forecast
//  baru terbit media ~1 minggu sebelum rilis, jadi isi manual sendiri
//  pas mendekati tanggalnya (cek investing.com/forexfactory/tradingview
//  economic calendar). Jangan isi angka karangan.
//
//  CARA TAMBAH EVENT BARU:
//  Copy salah satu blok { ... } di bawah, ganti isinya, tambahkan
//  koma setelah blok sebelumnya. "id" harus unik (angka naik saja).
//
//  FIELD (jangan dihapus salah satu pun walau isinya kosong ""/[]/null):
//    id          - number, unik, wajib
//    date        - "YYYY-MM-DD", wajib
//    time        - "HH:MM" 24 jam, WIB (waktu Indonesia), wajib
//                  ("-" kalau jam belum pasti)
//    currency    - "USD"/"EUR"/dll, boleh "" kalau tidak relevan
//    impact      - "HIGH" | "MEDIUM" | "LOW"
//    event       - nama event, wajib
//    forecast    - proyeksi/consensus, boleh ""
//    previous    - angka periode sebelumnya, boleh ""
//    description - deskripsi singkat, boleh ""
//    affected    - array simbol yang biasanya kena dampak, boleh []
//    notes       - catatan bebas kamu, boleh ""
//    source      - biasanya "Manual"
//
//  Event yang tanggalnya sudah lewat otomatis disembunyikan sendiri
//  oleh website — jadi aman kalau mau nyicil isi jauh ke depan atau
//  malas hapus event lama.
// ══════════════════════════════════════════════════════════
window.ECONOMIC_EVENTS = [
  {
    id: 1,
    date: "2026-07-30",
    time: "01:00",
    currency: "USD",
    impact: "HIGH",
    event: "FOMC Interest Rate Decision",
    forecast: "",
    previous: "",
    description: "Keputusan suku bunga The Fed (meeting 28-29 Jul) + konferensi pers Jerome Powell",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Statement rilis 14:00 ET, press conference 14:30 ET — pergerakan besar biasanya di sesi tanya-jawab, bukan di teks statement-nya.",
    source: "Manual",
  },
  {
    id: 2,
    date: "2026-08-07",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "Non Farm Payroll",
    forecast: "",
    previous: "",
    description: "Laporan tenaga kerja AS — data Juli 2026",
    affected: ["BTC", "ETH", "SOL", "NASDAQ", "GOLD", "DXY"],
    notes: "Potensi volatilitas tinggi 15–30 menit setelah rilis.",
    source: "Manual",
  },
  {
    id: 3,
    date: "2026-08-12",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "CPI (Consumer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi konsumen AS — data Juli 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Angka di atas forecast biasanya bearish buat risk asset (ekspektasi The Fed lebih hawkish).",
    source: "Manual",
  },
  {
    id: 4,
    date: "2026-08-13",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "PPI (Producer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi produsen AS — data Juli 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Sering dianggap leading indicator buat CPI bulan berikutnya.",
    source: "Manual",
  },
  {
    id: 5,
    date: "2026-09-04",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "Non Farm Payroll",
    forecast: "",
    previous: "",
    description: "Laporan tenaga kerja AS — data Agustus 2026",
    affected: ["BTC", "ETH", "SOL", "NASDAQ", "GOLD", "DXY"],
    notes: "Potensi volatilitas tinggi 15–30 menit setelah rilis.",
    source: "Manual",
  },
  {
    id: 6,
    date: "2026-09-10",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "PPI (Producer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi produsen AS — data Agustus 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Sering dianggap leading indicator buat CPI bulan berikutnya.",
    source: "Manual",
  },
  {
    id: 7,
    date: "2026-09-11",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "CPI (Consumer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi konsumen AS — data Agustus 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Angka di atas forecast biasanya bearish buat risk asset (ekspektasi The Fed lebih hawkish).",
    source: "Manual",
  },
  {
    id: 8,
    date: "2026-09-17",
    time: "01:00",
    currency: "USD",
    impact: "HIGH",
    event: "FOMC Interest Rate Decision",
    forecast: "",
    previous: "",
    description: "Keputusan suku bunga The Fed (meeting 15-16 Sep) + Summary of Economic Projections (dot plot)",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Meeting September termasuk dot plot — biasanya lebih volatile dari meeting biasa.",
    source: "Manual",
  },
  {
    id: 9,
    date: "2026-10-02",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "Non Farm Payroll",
    forecast: "",
    previous: "",
    description: "Laporan tenaga kerja AS — data September 2026",
    affected: ["BTC", "ETH", "SOL", "NASDAQ", "GOLD", "DXY"],
    notes: "Potensi volatilitas tinggi 15–30 menit setelah rilis.",
    source: "Manual",
  },
  {
    id: 10,
    date: "2026-10-14",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "CPI (Consumer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi konsumen AS — data September 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Angka di atas forecast biasanya bearish buat risk asset (ekspektasi The Fed lebih hawkish).",
    source: "Manual",
  },
  {
    id: 11,
    date: "2026-10-15",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "PPI (Producer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi produsen AS — data September 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Sering dianggap leading indicator buat CPI bulan berikutnya.",
    source: "Manual",
  },
  {
    id: 12,
    date: "2026-10-29",
    time: "01:00",
    currency: "USD",
    impact: "HIGH",
    event: "FOMC Interest Rate Decision",
    forecast: "",
    previous: "",
    description: "Keputusan suku bunga The Fed (meeting 27-28 Okt) + konferensi pers Jerome Powell",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Statement rilis 14:00 ET, press conference 14:30 ET — pergerakan besar biasanya di sesi tanya-jawab, bukan di teks statement-nya.",
    source: "Manual",
  },
  {
    id: 13,
    date: "2026-11-06",
    time: "20:30",
    currency: "USD",
    impact: "HIGH",
    event: "Non Farm Payroll",
    forecast: "",
    previous: "",
    description: "Laporan tenaga kerja AS — data Oktober 2026",
    affected: ["BTC", "ETH", "SOL", "NASDAQ", "GOLD", "DXY"],
    notes: "Jam mundur ke 20:30 WIB — AS sudah pindah ke waktu standar (EST) per 1 Nov.",
    source: "Manual",
  },
  {
    id: 14,
    date: "2026-11-10",
    time: "20:30",
    currency: "USD",
    impact: "HIGH",
    event: "CPI (Consumer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi konsumen AS — data Oktober 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Angka di atas forecast biasanya bearish buat risk asset (ekspektasi The Fed lebih hawkish).",
    source: "Manual",
  },
  {
    id: 15,
    date: "2026-11-13",
    time: "20:30",
    currency: "USD",
    impact: "HIGH",
    event: "PPI (Producer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi produsen AS — data Oktober 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Sering dianggap leading indicator buat CPI bulan berikutnya.",
    source: "Manual",
  },
  {
    id: 16,
    date: "2026-12-04",
    time: "20:30",
    currency: "USD",
    impact: "HIGH",
    event: "Non Farm Payroll",
    forecast: "",
    previous: "",
    description: "Laporan tenaga kerja AS — data November 2026",
    affected: ["BTC", "ETH", "SOL", "NASDAQ", "GOLD", "DXY"],
    notes: "Potensi volatilitas tinggi 15–30 menit setelah rilis.",
    source: "Manual",
  },
  {
    id: 17,
    date: "2026-12-10",
    time: "02:00",
    currency: "USD",
    impact: "HIGH",
    event: "FOMC Interest Rate Decision",
    forecast: "",
    previous: "",
    description: "Keputusan suku bunga The Fed (meeting 8-9 Des) + Summary of Economic Projections (dot plot) — meeting terakhir 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Meeting Desember termasuk dot plot — sering jadi acuan arah kebijakan tahun depan.",
    source: "Manual",
  },
  {
    id: 18,
    date: "2026-12-10",
    time: "20:30",
    currency: "USD",
    impact: "HIGH",
    event: "CPI (Consumer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi konsumen AS — data November 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Rilis di hari yang sama dengan FOMC (dini hari WIB) — hari yang sangat padat berita.",
    source: "Manual",
  },
  {
    id: 19,
    date: "2026-12-15",
    time: "20:30",
    currency: "USD",
    impact: "HIGH",
    event: "PPI (Producer Price Index)",
    forecast: "",
    previous: "",
    description: "Inflasi produsen AS — data November 2026",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "Sering dianggap leading indicator buat CPI bulan berikutnya.",
    source: "Manual",
  },
];
