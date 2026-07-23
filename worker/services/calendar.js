import { createEconomicProvider } from "../providers/economic.js";
import { getCryptoEvents } from "../providers/crypto.js";
import { jsonResponse } from "../utils/cors.js";

export const SCHEDULE_CACHE_KEY = "news_schedule_cache_v4";
export const SCHEDULE_CACHE_TTL = 6 * 60 * 60; // 6 jam

// ══════════════════════════════════════════════════════════
//  JADWAL NEWS — gabungan macro (scrape) + crypto (search)
// ══════════════════════════════════════════════════════════
export async function buildScheduleList(env, forceRefresh = false) {
  if (!forceRefresh) {
    const cacheRaw = await env['didinska-kv'].get(SCHEDULE_CACHE_KEY);
    if (cacheRaw) {
      try {
        const cached = JSON.parse(cacheRaw);
        if (Array.isArray(cached.list) && cached.list.length > 0) return cached.list;
      } catch (e) { /* cache korup, lanjut rebuild */ }
    }
  }

  const provider = await createEconomicProvider();
  const [macro, crypto] = await Promise.all([
    provider.fetch(env).catch((e) => { console.error("[MACRO] Error tak tertangani:", e.message); return []; }),
    getCryptoEvents(env).catch((e) => { console.error("[CRYPTO] Error tak tertangani:", e.message); return []; }),
  ]);

  const list = mergeAndSort(macro, crypto);
  if (list.length > 0) {
    await env['didinska-kv'].put(SCHEDULE_CACHE_KEY, JSON.stringify({ list, ts: Date.now() }), { expirationTtl: SCHEDULE_CACHE_TTL });
  }
  return list;
}

export function mergeAndSort(macro, crypto) {
  const now = Date.now();
  const all = [...macro, ...crypto].filter((it) => typeof it._sort === "number" && it._sort >= now - 24 * 3600 * 1000);
  all.sort((a, b) => (a._sort || 0) - (b._sort || 0));
  return all.slice(0, 15);
}

export function scheduleText(list) {
  if (!list.length) return "📭 Belum ada jadwal event mendatang yang berhasil ditemukan. Coba lagi beberapa saat lagi atau tap '🔄 Refresh Jadwal'.";
  const lines = ["📅 *JADWAL NEWS TERDEKAT* (waktu WIB)\n"];
  list.forEach((it, i) => {
    const jam = it.time_wib && it.time_wib !== "-" ? `${it.time_wib} WIB` : "jam belum diketahui";
    const tag = it.category === "crypto" ? "🪙" : "🏛️";
    lines.push(`${i + 1}. ${tag} *${it.date}, ${jam}* — ${it.event}`);
  });
  lines.push("\n_🏛️ = scrape langsung dari kalender resmi · 🪙 = hasil pencarian berita, cek ulang di sumber resmi._");
  return lines.join("\n");
}

export function scheduleKb(list) {
  const rows = list.map((it, i) => {
    const jam = it.time_wib && it.time_wib !== "-" ? ` ${it.time_wib}` : "";
    return [{ text: `${it.date}${jam} — ${it.event}`.slice(0, 60), callback_data: `ev_${i}` }];
  });
  rows.push([{ text: "🔄 Refresh Jadwal", callback_data: "refresh_schedule" }]);
  return { inline_keyboard: rows };
}

export function jadwalViewKb() {
  return { inline_keyboard: [[{ text: "🔄 Refresh Jadwal", callback_data: "refresh_jadwal_view" }]] };
}

// ══════════════════════════════════════════════════════════
//  API HANDLER — GET /api/jadwal
// ══════════════════════════════════════════════════════════
export async function handleApiJadwal(request, env) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const list = await buildScheduleList(env, forceRefresh);
    return jsonResponse({ ok: true, list });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}
