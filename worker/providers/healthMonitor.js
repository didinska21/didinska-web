// ══════════════════════════════════════════════════════════
//  PROVIDER HEALTH MONITOR — Sprint 10
//  Mencatat status kesehatan tiap Economic Provider (sukses/gagal,
//  waktu terakhir, waktu respons) tiap kali provider dipakai.
//
//  TIDAK menyentuh cache Economic Calendar (economic_calendar_v1) sama
//  sekali — key KV yang dipakai di sini terpisah total: "provider_health".
//
//  TIDAK mengetahui apa pun soal schema TradingEconomics/FMP/EODHD —
//  file ini cuma terima (providerName, responseTimeMs) dari pemanggil,
//  murni pencatatan generik.
// ══════════════════════════════════════════════════════════

import { jsonResponse } from "../utils/cors.js";

const HEALTH_KV_KEY = "provider_health";

// ══════════════════════════════════════════════════════════
//  Bentuk data yang disimpan di KV (satu object, key = nama provider):
//  {
//    "TradingEconomics": {
//      successCount, failureCount,
//      lastSuccess (ISO string | null), lastFailure (ISO string | null),
//      totalResponseMs, responseCount   // dipakai buat hitung rata-rata
//    },
//    "FMP": { ... }
//  }
//
//  CATATAN SOAL RACE CONDITION: Cloudflare KV bukan penyimpanan atomik
//  (read-modify-write, bukan increment atomik) dan eventually consistent
//  — sama seperti pola cache economic_calendar_v1 yang sudah ada di
//  economic.js. Provider hanya dipanggil saat cache calendar miss
//  (jarang) atau lewat cron (terjadwal, tidak paralel dengan dirinya
//  sendiri), jadi risiko race di sini kecil. Kalau nanti frekuensi
//  panggilan naik drastis, pertimbangkan Durable Object untuk counter
//  yang benar-benar atomik — di luar scope sprint ini.
// ══════════════════════════════════════════════════════════

async function readHealthMap(env) {
  try {
    const raw = await env["didinska-kv"].get(HEALTH_KV_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    console.error("[HEALTH] Gagal baca provider_health dari KV:", e.message);
    return {};
  }
}

async function writeHealthMap(env, map) {
  try {
    await env["didinska-kv"].put(HEALTH_KV_KEY, JSON.stringify(map));
  } catch (e) {
    // Gagal nulis health TIDAK BOLEH menggagalkan alur utama (fetch
    // economic calendar) — sama seperti writeEconomicCache().
    console.error("[HEALTH] Gagal tulis provider_health ke KV:", e.message);
  }
}

function blankEntry() {
  return {
    successCount: 0,
    failureCount: 0,
    lastSuccess: null,
    lastFailure: null,
    totalResponseMs: 0,
    responseCount: 0,
  };
}

// ══════════════════════════════════════════════════════════
//  recordProviderSuccess / recordProviderFailure
//  Dipanggil dari economic.js tiap kali provider.fetch() selesai
//  (berhasil atau gagal). Selalu "best effort" — tidak pernah throw,
//  supaya kegagalan mencatat health tidak pernah mengganggu response
//  utama /api/jadwal atau proses cron.
// ══════════════════════════════════════════════════════════
export async function recordProviderSuccess(env, providerName, responseTimeMs) {
  try {
    const map = await readHealthMap(env);
    const entry = map[providerName] || blankEntry();

    entry.successCount += 1;
    entry.lastSuccess = new Date().toISOString();
    if (typeof responseTimeMs === "number" && Number.isFinite(responseTimeMs)) {
      entry.totalResponseMs += responseTimeMs;
      entry.responseCount += 1;
    }

    map[providerName] = entry;
    await writeHealthMap(env, map);
  } catch (e) {
    console.error(`[HEALTH] Gagal mencatat sukses provider "${providerName}":`, e.message);
  }
}

export async function recordProviderFailure(env, providerName, responseTimeMs) {
  try {
    const map = await readHealthMap(env);
    const entry = map[providerName] || blankEntry();

    entry.failureCount += 1;
    entry.lastFailure = new Date().toISOString();
    // Waktu sampai gagal tetap diikutkan ke rata-rata (mis. request yang
    // lambat lalu timeout) supaya averageResponseMs jujur mencerminkan
    // kondisi nyata provider, bukan cuma request yang sukses.
    if (typeof responseTimeMs === "number" && Number.isFinite(responseTimeMs)) {
      entry.totalResponseMs += responseTimeMs;
      entry.responseCount += 1;
    }

    map[providerName] = entry;
    await writeHealthMap(env, map);
  } catch (e) {
    console.error(`[HEALTH] Gagal mencatat kegagalan provider "${providerName}":`, e.message);
  }
}

// ══════════════════════════════════════════════════════════
//  getProviderHealthList(env)
//  Bentuk data mentah KV menjadi array sesuai kontrak response
//  GET /api/provider-health.
//
//  "healthy" ditentukan sederhana:
//    - belum pernah gagal (lastFailure null)              → true
//    - pernah sukses DAN sukses terakhir lebih baru dari
//      gagal terakhir                                     → true
//    - selain itu                                         → false
// ══════════════════════════════════════════════════════════
export async function getProviderHealthList(env) {
  const map = await readHealthMap(env);

  return Object.keys(map).map((name) => {
    const e = map[name];

    // Pakai >= (bukan >) buat tie-break: kalau lastSuccess & lastFailure
    // kebetulan tercatat di milidetik yang sama (mis. dua panggilan sangat
    // berdekatan), tetap dianggap belum tentu tidak sehat.
    const healthy =
      e.lastFailure === null ||
      (e.lastSuccess !== null && new Date(e.lastSuccess).getTime() >= new Date(e.lastFailure).getTime());

    const averageResponseMs = e.responseCount > 0 ? Math.round(e.totalResponseMs / e.responseCount) : null;

    return {
      name,
      healthy,
      lastSuccess: e.lastSuccess,
      lastFailure: e.lastFailure,
      successCount: e.successCount,
      failureCount: e.failureCount,
      averageResponseMs,
    };
  });
}

// ══════════════════════════════════════════════════════════
//  ADAPTER — GET /api/provider-health
// ══════════════════════════════════════════════════════════
export async function handleApiProviderHealth(env) {
  try {
    const providers = await getProviderHealthList(env);
    return jsonResponse({ providers });
  } catch (e) {
    return jsonResponse({ providers: [], error: e.message }, 500);
  }
}
