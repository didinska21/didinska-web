// ══════════════════════════════════════════════════════════
//  FMP (Financial Modeling Prep) PROVIDER — Sprint 8
//  Implementasi konkret Economic Calendar provider kedua, mengikuti
//  bentuk yang sama dengan TradingEconomicsProvider (providers/economic.js):
//  { id, date, time, currency, impact, title, actual, forecast, previous }
//
//  Dokumentasi resmi yang jadi acuan (JANGAN tambah endpoint/parameter/
//  field di luar yang didokumentasikan tanpa cek ulang dulu):
//    - Halaman produk & endpoint resmi:
//        https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar
//      Endpoint yang tercantum di sana:
//        https://financialmodelingprep.com/stable/economic-calendar
//    - Contoh request/response endpoint calendar (dari org resmi
//      FinancialModelingPrep di GitHub, dipakai sebagai acuan nama field
//      karena tabel schema di halaman docs/stable dirender lewat JS dan
//      tidak muncul saat di-fetch sebagai teks):
//        https://github.com/FinancialModelingPrep/API3-integration
//      Field yang dikonfirmasi dari contoh response resmi tsb:
//        event, date ("YYYY-MM-DD HH:mm:ss"), country, actual, previous,
//        change, changePercentage, estimate
//    - FAQ resmi FMP mengonfirmasi timezone Economic Calendar adalah UTC:
//        https://site.financialmodelingprep.com/faqs
//    - Parameter date range (from/to, format YYYY-MM-DD, rentang maksimum
//      ~90 hari / 3 bulan) dikonfirmasi konsisten di beberapa referensi
//      resmi & pihak ketiga yang mendokumentasikan endpoint /stable
//      (termasuk contoh MCP tool resmi yang membungkus endpoint ini).
//
//  CATATAN JUJUR SOAL KETIDAKPASTIAN FIELD (baca sebelum ubah):
//  Dokumentasi publik /stable/economic-calendar TIDAK menampilkan tabel
//  schema response secara statis (di-render via JS di browser), dan versi
//  /stable belum tentu 100% identik dengan contoh legacy di atas. Field
//  "currency", "impact", dan "id"/"eventId" per-event TIDAK ada di contoh
//  response resmi yang berhasil diverifikasi — beberapa sumber pihak
//  ketiga (bukan dokumentasi resmi) menyebut field "currency" dan "impact"
//  mungkin ada di versi /stable. Karena JANGAN mengarang schema, kode di
//  bawah ini TIDAK mengasumsikan field itu pasti ada: diakses secara
//  defensif (fallback null kalau tidak ada), tidak pernah diisi dengan
//  nilai hasil tebakan/mapping sendiri (mis. tidak menerka currency dari
//  country). Field "id" juga tidak di-generate/di-tebak — dibiarkan null.
//  SEBELUM dipakai di production, verifikasi field-field ini terhadap
//  response asli dari API key yang valid.
// ══════════════════════════════════════════════════════════

const FMP_BASE_URL = "https://financialmodelingprep.com/stable/economic-calendar";
const FMP_TIMEOUT_MS = 10000;
const FMP_MAX_RETRIES = 2; // percobaan ULANG (di luar percobaan pertama) — total maks 3x coba

// Rentang tanggal yang diminta per panggilan. Didokumentasikan endpoint ini
// mensyaratkan parameter from/to dengan rentang maksimum ~90 hari — 30 hari
// ke depan dipakai di sini supaya aman jauh di bawah batas tsb, dan selaras
// dengan DAYS_AHEAD (14 hari) yang dipakai buildScheduleItems() di economic.js
// (provider boleh mengembalikan lebih banyak data; penyaringan window
// tampilan tetap dilakukan di economic.js, bukan di sini).
const FMP_RANGE_DAYS = 30;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtDateParam(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ══════════════════════════════════════════════════════════
//  PROVIDER — kontrak format internal standar
//  { id, date, time, currency, impact, title, actual, forecast, previous }
// ══════════════════════════════════════════════════════════
export const FMPProvider = {
  /**
   * Sprint 11.1: dipakai chain runner (economic.js) untuk membedakan
   * "provider belum dikonfigurasi" (UNAVAILABLE) dari kegagalan teknis
   * (FAILED) TANPA perlu memanggil fetch()/menangkap exception dulu.
   * Tidak pernah throw — murni pengecekan boolean.
   */
  isConfigured(env) {
    return !!env.FMP_API_KEY;
  },

  /**
   * Ambil data mentah economic calendar dari FMP.
   * - Timeout via AbortController (FMP_TIMEOUT_MS)
   * - Retry sederhana maks FMP_MAX_RETRIES kali, HANYA untuk error jaringan
   *   (fetch gagal terkoneksi / timeout) — bukan untuk HTTP error status
   *   atau error logis dari FMP (mis. API key salah), karena itu biasanya
   *   bukan masalah sementara.
   * - HTTP non-2xx dilempar sebagai Error dengan status & cuplikan body.
   * - FMP dikenal (dilaporkan berulang kali oleh komunitas developer-nya)
   *   kadang membalas HTTP 200 tapi body berupa objek error, bukan array,
   *   berbentuk { "Error Message": "..." } — mis. untuk API key tidak
   *   valid. Kasus ini dideteksi secara eksplisit dan dilempar sebagai
   *   Error juga, supaya tidak diperlakukan seolah datanya kosong.
   * - JSON tidak valid dilempar sebagai Error dengan cuplikan response.
   */
  async fetch(env) {
    if (!env.FMP_API_KEY) {
      throw new Error(
        "FMP_API_KEY belum di-set di Cloudflare Secrets. " +
        "Daftar/dapatkan API key resmi di https://site.financialmodelingprep.com/register"
      );
    }

    const from = new Date();
    const to = new Date(from.getTime() + FMP_RANGE_DAYS * 86400000);
    const url =
      `${FMP_BASE_URL}?from=${fmtDateParam(from)}&to=${fmtDateParam(to)}` +
      `&apikey=${encodeURIComponent(env.FMP_API_KEY)}`;

    let lastErr;

    for (let attempt = 0; attempt <= FMP_MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FMP_TIMEOUT_MS);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          // Error HTTP eksplisit (mis. 401 key salah, 429 rate limit) —
          // sengaja TIDAK di-retry.
          throw new Error(`FMP HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
        }

        const rawText = await res.text();
        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          throw new Error(`FMP membalas JSON tidak valid. Cuplikan: ${rawText.slice(0, 200)}`);
        }

        // Lihat catatan di atas: FMP bisa balas 200 OK dengan body error.
        if (parsed && !Array.isArray(parsed) && typeof parsed === "object" && parsed["Error Message"]) {
          throw new Error(`FMP Error Message: ${parsed["Error Message"]}`);
        }

        return parsed;
      } catch (e) {
        clearTimeout(timer);

        const isTimeout = e.name === "AbortError";
        const isNetworkError = isTimeout || e instanceof TypeError; // TypeError khas kegagalan fetch (DNS/koneksi putus, dll)
        lastErr = isTimeout ? new Error(`FMP timeout setelah ${FMP_TIMEOUT_MS}ms`) : e;

        if (isNetworkError && attempt < FMP_MAX_RETRIES) {
          await sleep(500 * (attempt + 1)); // backoff sederhana: 500ms, 1000ms
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr;
  },

  /**
   * Normalize response FMP ke format internal standar.
   *
   * Field asli FMP yang dipakai (dikonfirmasi dari contoh response resmi —
   * lihat catatan sumber di atas file ini):
   *   event, date ("YYYY-MM-DD HH:mm:ss", UTC), actual, previous, estimate
   *
   * Field "currency" dan "impact" TIDAK dikonfirmasi ada di response resmi
   * yang berhasil diverifikasi, jadi diakses secara opsional (fallback
   * null) — tidak pernah ditebak/diisi dari field lain (mis. dari
   * "country"). Field "id" juga tidak di-generate — FMP tidak
   * mendokumentasikan id unik per event pada endpoint ini.
   */
  normalize(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((item) => item && item.date)
      .map((item) => {
        const [datePart, timePart] = String(item.date).split(" ");
        return {
          id: null,
          date: datePart || null,                          // YYYY-MM-DD, UTC (dikonfirmasi lewat FAQ resmi FMP)
          time: timePart ? timePart.slice(0, 5) : null,     // HH:mm, UTC
          currency: item.currency ?? null,                  // lihat catatan ketidakpastian field di atas
          impact: item.impact ?? null,                      // lihat catatan ketidakpastian field di atas
          title: item.event || null,
          actual: item.actual ?? null,
          forecast: item.estimate ?? null,                  // FMP menamai field ini "estimate", bukan "forecast"
          previous: item.previous ?? null,
        };
      });
  },
};
