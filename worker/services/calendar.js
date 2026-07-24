import { getCryptoEvents } from "../providers/crypto.js";
import { jsonResponse } from "../utils/cors.js";

export const SCHEDULE_CACHE_KEY = "news_schedule_cache_v4";
export const SCHEDULE_CACHE_TTL = 6 * 60 * 60; // 6 jam

// ══════════════════════════════════════════════════════════
//  JADWAL NEWS — crypto (search)
//  Sprint 12: Economic Calendar (macro) TIDAK lagi diambil di sini.
//  Event macro sekarang dikelola manual lewat file statis
//  `data/jadwal.js` (window.ECONOMIC_EVENTS) dan dirender LANGSUNG di
//  browser (lihat assets/app.js) — TANPA lewat Worker/KV sama sekali.
//  Fungsi & endpoint di bawah ini murni buat jadwal CRYPTO (masih pakai
//  Serper search, tidak terpengaruh perubahan Sprint 12) yang dipakai
//  oleh /api/jadwal (analisa.html) & Telegram Bot.
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

  const crypto = await getCryptoEvents(env).catch((e) => { console.error("[CRYPTO] Error tak tertangani:", e.message); return []; });

  const list = mergeAndSort(crypto);
  if (list.length > 0) {
    await env['didinska-kv'].put(SCHEDULE_CACHE_KEY, JSON.stringify({ list, ts: Date.now() }), { expirationTtl: SCHEDULE_CACHE_TTL });
  }
  return list;
}

// Sprint 12: dulu menggabungkan macro + crypto (2 argumen), sekarang
// cuma crypto. Nama & bentuk (filter + sort + slice 15) sengaja
// dipertahankan sama supaya scheduleText/scheduleKb/Telegram bot yang
// konsumsi hasilnya tidak perlu ikut berubah.
export function mergeAndSort(crypto) {
  const now = Date.now();
  const all = crypto.filter((it) => typeof it._sort === "number" && it._sort >= now - 24 * 3600 * 1000);
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
  lines.push("\n_🪙 = hasil pencarian berita, cek ulang di sumber resmi. Jadwal event ekonomi/makro sekarang dikelola manual, cek di website._");
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
