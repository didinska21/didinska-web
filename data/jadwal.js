// ══════════════════════════════════════════════════════════
//  JADWAL EKONOMI MANUAL — Sprint 12
//  ------------------------------------------------------------
//  File ini di-edit MANUAL setiap minggu. Tidak ada proses build,
//  tidak ada API — tinggal edit array di bawah, commit, push, GitHub
//  Pages otomatis update.
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
    date: "2026-08-01",
    time: "19:30",
    currency: "USD",
    impact: "HIGH",
    event: "Non Farm Payroll",
    forecast: "110K",
    previous: "147K",
    description: "Monthly employment report",
    affected: ["BTC", "ETH", "SOL", "NASDAQ", "GOLD", "DXY"],
    notes: "Potensi volatilitas tinggi 15–30 menit setelah rilis.",
    source: "Manual",
  },
  {
    id: 2,
    date: "2026-08-05",
    time: "01:00",
    currency: "USD",
    impact: "HIGH",
    event: "FOMC Interest Rate Decision",
    forecast: "4.25%",
    previous: "4.25%",
    description: "Federal Reserve Interest Rate Decision",
    affected: ["BTC", "ETH", "NASDAQ", "GOLD", "DXY"],
    notes: "",
    source: "Manual",
  },
];
