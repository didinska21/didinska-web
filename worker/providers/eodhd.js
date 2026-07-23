// ══════════════════════════════════════════════════════════
//  EODHD (EOD Historical Data) PROVIDER — STUB
//  Sprint 6: baru pondasi Multi Provider, API EODHD belum
//  diimplementasikan. JANGAN mengarang endpoint/parameter/format
//  response EODHD di sini sebelum dokumentasi resminya dicek —
//  itu pekerjaan sprint terpisah.
// ══════════════════════════════════════════════════════════
export const EODHDProvider = {
  // Sprint 11.1: stub belum punya API key/implementasi apa pun, jadi
  // selalu dianggap belum dikonfigurasi — konsisten dengan provider lain
  // yang sudah pakai isConfigured() (lihat economic.js/fmp.js).
  isConfigured(env) {
    return false;
  },

  async fetch(env) {
    throw new Error("Provider belum diimplementasikan");
  },

  // Tidak pernah dipanggil selama fetch() di atas masih stub (selalu throw).
  // Disediakan supaya bentuk provider ini konsisten dengan provider lain
  // (fetch + normalize), tanpa mengarang format data EODHD.
  normalize(raw) {
    return [];
  },
};
