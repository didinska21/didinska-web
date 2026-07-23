// ══════════════════════════════════════════════════════════
//  ECONOMIC CALENDAR PROVIDER — TradingEconomics (+ Multi Provider)
//  Sprint 4: implementasi TradingEconomicsProvider (fetch/normalize).
//  Sprint 5: KV cache (readEconomicCache/writeEconomicCache).
//  Sprint 6: getEconomicEvents() sekarang lewat Provider Factory
//            (providers/providerFactory.js) dengan fallback berurutan
//            TradingEconomics → FMP (stub) → EODHD (stub).
//
//  Dokumentasi resmi TradingEconomics yang jadi acuan (JANGAN tambah
//  endpoint/parameter di luar yang didokumentasikan tanpa cek ulang):
//    - Snapshot endpoint : https://docs.tradingeconomics.com/economic_calendar/snapshot/
//    - Response fields   : https://docs.tradingeconomics.com/economic_calendar/schema/
//
//  CATATAN ARSITEKTUR (baca sebelum ubah file ini):
//  Kontrak yang benar-benar dipakai oleh services/calendar.js (TIDAK
//  BOLEH DIUBAH) adalah fungsi getEconomicEvents(env) yang mengembalikan
//  array berbentuk sama seperti getCryptoEvents() di providers/crypto.js:
//    { date, time_wib, event, date_iso_full, category, _sort }
//  Providers/providerFactory.js meng-import TradingEconomicsProvider
//  dari file ini, dan file ini meng-import buildProviderChain dari
//  providerFactory.js — circular import ini aman di ESM karena
//  keduanya cuma dipakai di dalam function body (runtime), bukan di
//  top-level module.
// ══════════════════════════════════════════════════════════

import { fmtWIBDate, fmtWIBTime, fmtISODate } from "../utils/timezone.js";
import { buildProviderChain } from "./providerFactory.js";

const TE_BASE_URL = "https://api.tradingeconomics.com/calendar";
const TE_TIMEOUT_MS = 10000;
const TE_MAX_RETRIES = 2; // percobaan ULANG (di luar percobaan pertama) — total maks 3x coba

// Importance sesuai dokumentasi resmi (bagian "By importance"):
// 1 = Low, 2 = Medium, 3 = High
const IMPORTANCE_MAP = { 1: "Low", 2: "Medium", 3: "High" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════
//  PROVIDER — kontrak format internal standar
//  { id, date, time, currency, impact, title, actual, forecast, previous }
// ══════════════════════════════════════════════════════════
export const TradingEconomicsProvider = {
  /**
   * Ambil data mentah economic calendar dari TradingEconomics.
   * - Timeout via AbortController (TE_TIMEOUT_MS)
   * - Retry sederhana maks TE_MAX_RETRIES kali, HANYA untuk error jaringan
   *   (fetch gagal terkoneksi / timeout) — bukan untuk HTTP error status,
   *   karena itu biasanya bukan masalah sementara (mis. 401 API key salah).
   * - HTTP non-2xx dilempar sebagai Error dengan status & cuplikan body.
   * - JSON tidak valid dilempar sebagai Error dengan cuplikan response.
   */
  async fetch(env) {
    if (!env.TRADINGECONOMICS_API_KEY) {
      throw new Error(
        "TRADINGECONOMICS_API_KEY belum di-set di Cloudflare Secrets. " +
        "Daftar/dapatkan API key resmi di https://developer.tradingeconomics.com/"
      );
    }

    const url = `${TE_BASE_URL}?c=${encodeURIComponent(env.TRADINGECONOMICS_API_KEY)}`;
    let lastErr;

    for (let attempt = 0; attempt <= TE_MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TE_TIMEOUT_MS);

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          // Error HTTP eksplisit — sengaja TIDAK di-retry.
          throw new Error(`TradingEconomics HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
        }

        const rawText = await res.text();
        try {
          return JSON.parse(rawText);
        } catch {
          throw new Error(`TradingEconomics membalas JSON tidak valid. Cuplikan: ${rawText.slice(0, 200)}`);
        }
      } catch (e) {
        clearTimeout(timer);

        const isTimeout = e.name === "AbortError";
        const isNetworkError = isTimeout || e instanceof TypeError; // TypeError khas kegagalan fetch (DNS/koneksi putus, dll)
        lastErr = isTimeout ? new Error(`TradingEconomics timeout setelah ${TE_TIMEOUT_MS}ms`) : e;

        if (isNetworkError && attempt < TE_MAX_RETRIES) {
          await sleep(500 * (attempt + 1)); // backoff sederhana: 500ms, 1000ms
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr;
  },

  /**
   * Normalize response TradingEconomics ke format internal standar.
   *
   * Field asli TE yang dipakai (semua sesuai dokumentasi resmi
   * economic_calendar/schema — tidak ada field yang dikarang):
   *   CalendarId, Date (UTC), Category, Event, Actual, Previous,
   *   Forecast, Importance, Currency
   */
  normalize(raw) {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((item) => item && item.Date)
      .map((item) => {
        const [datePart, timePart] = String(item.Date).split("T");
        return {
          id: item.CalendarId != null ? String(item.CalendarId) : null,
          date: datePart || null,                          // YYYY-MM-DD, UTC (field "Date" didokumentasikan dalam UTC)
          time: timePart ? timePart.slice(0, 5) : null,     // HH:mm, UTC
          currency: item.Currency || null,                  // sering "" di response asli untuk event non-forex — bukan bug
          impact: IMPORTANCE_MAP[item.Importance] || null,
          title: item.Event || item.Category || null,
          actual: item.Actual || null,
          forecast: item.Forecast || null,
          previous: item.Previous || null,
        };
      });
  },
};

// ══════════════════════════════════════════════════════════
//  ADAPTER — dipanggil oleh services/calendar.js (tidak diubah)
// ══════════════════════════════════════════════════════════
const DAYS_AHEAD = 14; // batas tampil ke depan, murni pembatasan list di sisi kita — bukan parameter API

// Transform normalize(raw) → bentuk yang dikonsumsi calendar.js.
// Diekstrak jadi fungsi privat (bukan diekspor, bukan rename apa pun yang
// sudah ada) supaya bisa dipakai ulang oleh getEconomicEvents() di jalur
// cache-miss tanpa duplikasi logic.
function buildScheduleItems(normalized) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + DAYS_AHEAD * 86400000);

  return normalized
    .filter((it) => it.date)
    .map((it) => {
      // it.date & it.time dari TE sudah UTC (dokumentasi resmi) → +7 jam = WIB
      const utcDate = new Date(`${it.date}T${it.time || "00:00"}:00Z`);
      if (isNaN(utcDate.getTime())) return null;
      if (utcDate > cutoff) return null;

      const wibDate = new Date(utcDate.getTime() + 7 * 3600 * 1000);

      return {
        date: fmtWIBDate(wibDate),
        time_wib: it.time ? fmtWIBTime(wibDate) : "-",
        event: it.title,
        date_iso_full: fmtISODate(wibDate),
        category: "economic",
        // field tambahan dari format internal standar, ikut dibawa
        // (tidak dipakai scheduleText/scheduleKb saat ini, tapi berguna
        // kalau nanti /api/analisa atau UI mau menampilkannya)
        currency: it.currency,
        impact: it.impact,
        actual: it.actual,
        forecast: it.forecast,
        previous: it.previous,
        _sort: wibDate.getTime(),
      };
    })
    .filter(Boolean);
}

// ══════════════════════════════════════════════════════════
//  KV CACHE — Sprint 5
//  Key   : economic_calendar_v1
//  TTL   : 1800 detik (30 menit) — dicek manual dari timestamp yang
//          disimpan, BUKAN pakai expirationTtl bawaan KV. Alasannya:
//          kalau pakai expirationTtl, key akan HILANG total setelah
//          30 menit, padahal aturan sprint ini butuh cache lama tetap
//          bisa dipakai sebagai fallback saat TradingEconomics gagal,
//          berapa pun lama umurnya. Jadi entri KV disimpan tanpa TTL
//          bawaan, dan "masih fresh atau tidak" dihitung sendiri di sini.
//
//  Provider (TradingEconomicsProvider) tidak pernah memanggil KV
//  langsung — semua akses KV lewat dua helper di bawah ini.
// ══════════════════════════════════════════════════════════
const ECONOMIC_CACHE_KEY = "economic_calendar_v1";
const ECONOMIC_CACHE_TTL_SECONDS = 1800;

export async function readEconomicCache(env) {
  try {
    const raw = await env["didinska-kv"].get(ECONOMIC_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    return parsed; // { data, ts }
  } catch (e) {
    console.error("[ECONOMIC CACHE] Gagal baca cache:", e.message);
    return null;
  }
}

export async function writeEconomicCache(env, data) {
  try {
    await env["didinska-kv"].put(ECONOMIC_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    // Gagal nulis cache tidak boleh menggagalkan response yang sudah didapat.
    console.error("[ECONOMIC CACHE] Gagal tulis cache:", e.message);
  }
}

function isCacheFresh(cache) {
  return !!cache && Date.now() - cache.ts < ECONOMIC_CACHE_TTL_SECONDS * 1000;
}

// ══════════════════════════════════════════════════════════
//  Flow (sprint 5 + multi-provider sprint 6):
//  request → getEconomicEvents() → cek KV cache
//    → cache masih valid (< 30 menit)     → return cache
//    → cache expired / kosong             → loop Provider Factory chain
//        → provider sukses                → normalize → simpan ke KV → return
//        → provider gagal                 → lanjut provider berikutnya
//                                            (cuma kalau ALLOW_PROVIDER_FALLBACK)
//    → semua provider gagal & cache lama ADA → return cache lama (JANGAN throw)
//    → semua provider gagal & cache kosong   → throw Error
// ══════════════════════════════════════════════════════════
export async function getEconomicEvents(env) {
  const cache = await readEconomicCache(env);

  if (isCacheFresh(cache)) {
    return cache.data;
  }

  const chain = buildProviderChain(env);

  for (const { name, provider } of chain) {
    try {
      const raw = await provider.fetch(env);
      const normalized = provider.normalize(raw);
      const items = buildScheduleItems(normalized);

      console.log(`[Provider] ${name} OK`);
      await writeEconomicCache(env, items);
      return items;
    } catch (e) {
      console.error(`[Provider] ${name} FAILED:`, e.message);
    }
  }

  if (cache && Array.isArray(cache.data)) {
    console.error("[ECONOMIC] Semua provider gagal, fallback ke cache lama.");
    return cache.data;
  }

  throw new Error("Semua provider Economic Calendar gagal dan tidak ada cache yang bisa dipakai.");
}

// ══════════════════════════════════════════════════════════
//  refreshEconomicCache(env) — Sprint 7
//  Dipanggil dari handler `scheduled` (Cloudflare Cron Trigger) di
//  worker.js, BUKAN dari jalur request biasa. User request tetap lewat
//  getEconomicEvents() di atas dan hanya membaca KV cache (tidak diubah).
//
//  Pakai chain provider yang sama (buildProviderChain — tidak diubah)
//  dan writeEconomicCache yang sama (tidak diubah). Bedanya dengan
//  getEconomicEvents(): fungsi ini SELALU coba fetch data terbaru
//  (tidak cek freshness cache dulu), karena tujuannya memang me-refresh
//  cache di background.
//
//  Aturan wajib: kalau semua provider gagal, cache lama TIDAK disentuh
//  sama sekali (tidak dihapus, tidak ditimpa data kosong) — cukup log
//  kegagalan dan return 0.
// ══════════════════════════════════════════════════════════
export async function refreshEconomicCache(env) {
  console.log("[CRON] Refresh Economic Calendar");

  const chain = buildProviderChain(env);

  for (const { name, provider } of chain) {
    try {
      const raw = await provider.fetch(env);
      const normalized = provider.normalize(raw);
      const items = buildScheduleItems(normalized);

      console.log(`[CRON] Provider ${name} OK`);
      await writeEconomicCache(env, items);
      console.log("[CRON] Cache Updated");
      return items.length;
    } catch (e) {
      console.error(`[CRON] Provider ${name} FAILED:`, e.message);
    }
  }

  // Semua provider gagal → cache lama (kalau ada) dibiarkan apa adanya,
  // writeEconomicCache() sengaja TIDAK dipanggil di jalur ini.
  console.error("[CRON] Refresh Failed");
  return 0;
}
