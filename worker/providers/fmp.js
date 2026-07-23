// ══════════════════════════════════════════════════════════
//  FMP (Financial Modeling Prep) PROVIDER — STUB
//  Sprint 6: baru pondasi Multi Provider, API FMP belum
//  diimplementasikan. JANGAN mengarang endpoint/parameter/format
//  response FMP di sini sebelum dokumentasi resminya dicek —
//  itu pekerjaan sprint terpisah.
// ══════════════════════════════════════════════════════════
export const FMPProvider = {
  async fetch(env) {
    throw new Error("Provider belum diimplementasikan");
  },

  // Tidak pernah dipanggil selama fetch() di atas masih stub (selalu throw).
  // Disediakan supaya bentuk provider ini konsisten dengan provider lain
  // (fetch + normalize), tanpa mengarang format data FMP.
  normalize(raw) {
    return [];
  },
};
