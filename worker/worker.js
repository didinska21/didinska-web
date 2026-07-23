/**
 * 📰 News & Economic Calendar Analyst Bot — Cloudflare Workers edition
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * v3.0 — Ditambah API publik buat website statis (GitHub Pages):
 *
 *   GET  /api/jadwal          → jadwal event MENDATANG (macro + crypto)
 *   POST /api/analisa         → jalankan analisa N-AI untuk 1 event,
 *                                otomatis simpan ke riwayat kalau ketemu
 *                                koin yang relevan (dipakai buat "sudah terjadi")
 *   GET  /api/riwayat         → daftar event yang SUDAH dianalisa,
 *                                lengkap dengan harga sebelum/sesudah (CoinGecko)
 *
 * Semua endpoint /api/* pakai CORS terbuka (Access-Control-Allow-Origin: *)
 * supaya bisa langsung di-fetch dari website statis manapun. Kalau mau
 * dibatasi cuma domain GitHub Pages kamu, tinggal ganti nilai di
 * CORS_ALLOW_ORIGIN di utils/cors.js.
 *
 * Semua logic bot Telegram yang lama (v2.4) TIDAK diubah — cuma ditambah.
 *
 * File ini murni router: semua logic ada di providers/services/utils.
 */

import { corsHeaders } from "./utils/cors.js";
import { handleUpdate } from "./utils/telegram.js";
import { handleApiJadwal } from "./services/calendar.js";
import { handleApiAnalisa } from "./services/analysis.js";
import { handleApiRiwayat } from "./utils/history.js";
import { refreshEconomicCache } from "./providers/economic.js";
import { handleApiProviderHealth } from "./providers/healthMonitor.js"; // Sprint 10

// ══════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- CORS preflight untuk semua route /api/* ----
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Bot is alive.", { status: 200 });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }

      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("Bad Request", { status: 400 });
      }

      ctx.waitUntil(handleUpdate(update, env));
      return new Response("OK", { status: 200 });
    }

    // ---- API publik buat website statis ----
    if (url.pathname === "/api/jadwal" && request.method === "GET") {
      return handleApiJadwal(request, env);
    }
    if (url.pathname === "/api/analisa" && request.method === "POST") {
      return handleApiAnalisa(request, env);
    }
    if (url.pathname === "/api/riwayat" && request.method === "GET") {
      return handleApiRiwayat(env);
    }
    // Sprint 10: status kesehatan tiap Economic Provider (KV terpisah
    // "provider_health", tidak menyentuh cache economic_calendar_v1).
    if (url.pathname === "/api/provider-health" && request.method === "GET") {
      return handleApiProviderHealth(env);
    }

    return new Response("Not found", { status: 404 });
  },

  // Sprint 7: Cloudflare Cron Trigger — refresh KV cache Economic Calendar
  // di background. Tidak menyentuh fetch handler di atas sama sekali.
  async scheduled(event, env, ctx) {
    try {
      await refreshEconomicCache(env);
    } catch (e) {
      // refreshEconomicCache() sendiri sudah menangani & mencatat error
      // provider-nya masing-masing dan tidak throw pada kondisi normal;
      // catch ini cuma jaring pengaman kalau ada error tak terduga lain.
      console.error("[CRON] Refresh Failed:", e.message);
    }
  },
};
