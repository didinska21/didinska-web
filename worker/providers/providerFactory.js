// ══════════════════════════════════════════════════════════
//  PROVIDER FACTORY — Sprint 6
//  Menentukan provider Economic Calendar yang aktif, dan
//  menyusun urutan fallback kalau provider utama gagal.
//
//  env.ECONOMIC_PROVIDER yang didukung: "tradingeconomics" (default),
//  "fmp", "eodhd".
//  env.ALLOW_PROVIDER_FALLBACK === "true" mengaktifkan fallback
//  otomatis ke provider berikutnya kalau provider utama gagal.
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

// Urutan fallback baku sesuai spesifikasi sprint 6:
// TradingEconomics → FMP → EODHD
export const FALLBACK_ORDER = ["tradingeconomics", "fmp", "eodhd"];

/**
 * createEconomicProvider(env)
 * Baca env.ECONOMIC_PROVIDER lalu balikin satu provider (bukan chain).
 * Default: tradingeconomics — dipakai juga kalau nilainya tidak dikenali.
 */
export function createEconomicProvider(env) {
  const registry = getRegistry();
  const key = (env.ECONOMIC_PROVIDER || "tradingeconomics").toLowerCase();
  const entry = registry[key] || registry.tradingeconomics;
  return entry.provider;
}

/**
 * buildProviderChain(env)
 * Susun daftar provider yang akan dicoba berurutan (dipakai getEconomicEvents
 * buat loop, bukan if bersarang):
 * - Provider utama (dari env.ECONOMIC_PROVIDER) selalu dicoba pertama.
 * - Kalau env.ALLOW_PROVIDER_FALLBACK === "true", provider lain menyusul
 *   sesuai FALLBACK_ORDER.
 * - Kalau tidak, cuma provider utama saja yang ada di daftar.
 * Balikin array of { name, provider }.
 */
export function buildProviderChain(env) {
  const registry = getRegistry();
  const requestedKey = (env.ECONOMIC_PROVIDER || "tradingeconomics").toLowerCase();
  const primaryKey = registry[requestedKey] ? requestedKey : "tradingeconomics";

  if (env.ALLOW_PROVIDER_FALLBACK !== "true") {
    return [registry[primaryKey]];
  }

  const restKeys = FALLBACK_ORDER.filter((key) => key !== primaryKey);
  return [primaryKey, ...restKeys].map((key) => registry[key]);
}
