// ══════════════════════════════════════════════════════════
//  PROVIDER FACTORY — Sprint 6, default provider diubah di Sprint 11
//  Menentukan provider Economic Calendar yang aktif, dan
//  menyusun urutan fallback kalau provider utama gagal.
//
//  env.ECONOMIC_PROVIDER yang didukung: "fmp" (default sejak Sprint 11),
//  "tradingeconomics" (opsional — perlu TRADINGECONOMICS_API_KEY), "eodhd".
//  env.ALLOW_PROVIDER_FALLBACK === "true" mengaktifkan fallback
//  otomatis ke provider berikutnya kalau provider utama gagal.
//
//  CATATAN Sprint 11 (TradingEconomics jadi opsional):
//  Satu-satunya perubahan di file ini adalah nilai default
//  ECONOMIC_PROVIDER — dari "tradingeconomics" menjadi "fmp". File ini
//  tetap satu-satunya tempat default tsb ditentukan (untuk
//  buildProviderChain), jadi tidak ada file lain yang perlu (atau
//  boleh) menentukan provider secara manual.
//  TradingEconomicsProvider sendiri TIDAK dihapus dan tetap terdaftar
//  penuh di registry — kalau user set ECONOMIC_PROVIDER=tradingeconomics
//  dan TRADINGECONOMICS_API_KEY tersedia, provider itu tetap terpakai
//  seperti biasa.
//
//  CATATAN Sprint 11.1: createEconomicProvider(env) (dulu ada di sini)
//  dihapus — sudah diaudit dan dipastikan tidak dipakai di mana pun
//  (buildProviderChain adalah satu-satunya fungsi yang benar-benar
//  dikonsumsi economic.js). Dead code, aman dihapus, tidak mengubah
//  behaviour apa pun yang terlihat dari luar.
// ══════════════════════════════════════════════════════════
import { TradingEconomicsProvider } from "./economic.js";
import { FMPProvider } from "./fmp.js";
import { EODHDProvider } from "./eodhd.js";

// Registry: satu tempat untuk nambah provider baru nanti.
// Dibangun lazy di dalam function (bukan object literal top-level) supaya
// TradingEconomicsProvider (di-import balik dari economic.js — circular
// import) diakses saat runtime, setelah economic.js selesai dimuat —
// bukan saat providerFactory.js pertama kali dievaluasi.
function getRegistry() {
  return {
    tradingeconomics: { name: "TradingEconomics", provider: TradingEconomicsProvider },
    fmp: { name: "FMP", provider: FMPProvider },
    eodhd: { name: "EODHD", provider: EODHDProvider },
  };
}

// Provider default kalau env.ECONOMIC_PROVIDER tidak di-set atau nilainya
// tidak dikenali. Sprint 11: FMP (bukan lagi TradingEconomics), supaya
// project tidak lagi wajib punya TRADINGECONOMICS_API_KEY untuk jalan.
const DEFAULT_PROVIDER_KEY = "fmp";

// Urutan fallback baku sejak Sprint 11: FMP → TradingEconomics → EODHD,
// selaras dengan FMP sebagai provider default dan TradingEconomics
// sebagai provider tambahan/opsional.
export const FALLBACK_ORDER = ["fmp", "tradingeconomics", "eodhd"];

/**
 * buildProviderChain(env)
 * Susun daftar provider yang akan dicoba berurutan (dipakai getEconomicEvents
 * buat loop, bukan if bersarang):
 * - Provider utama (dari env.ECONOMIC_PROVIDER, default "fmp" sejak
 *   Sprint 11) selalu dicoba pertama.
 * - Kalau env.ALLOW_PROVIDER_FALLBACK === "true", provider lain menyusul
 *   sesuai FALLBACK_ORDER (termasuk kalau provider utama gagal karena
 *   secret-nya belum di-set, mis. ECONOMIC_PROVIDER=tradingeconomics
 *   tanpa TRADINGECONOMICS_API_KEY — akan otomatis lanjut ke FMP).
 * - Kalau tidak, cuma provider utama saja yang ada di daftar (provider
 *   itu akan throw error yang jelas di economic.js kalau secret-nya
 *   tidak ada, tapi tidak akan membuat Worker crash — lihat catatan di
 *   getEconomicEvents/refreshEconomicCache).
 * Balikin array of { name, provider }.
 */
export function buildProviderChain(env) {
  const registry = getRegistry();
  const requestedKey = (env.ECONOMIC_PROVIDER || DEFAULT_PROVIDER_KEY).toLowerCase();
  const primaryKey = registry[requestedKey] ? requestedKey : DEFAULT_PROVIDER_KEY;

  if (env.ALLOW_PROVIDER_FALLBACK !== "true") {
    return [registry[primaryKey]];
  }

  const restKeys = FALLBACK_ORDER.filter((key) => key !== primaryKey);
  return [primaryKey, ...restKeys].map((key) => registry[key]);
}
