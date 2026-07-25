// ══════════════════════════════════════════════════════════
//  LOG CRON — riwayat jalannya cron "gali berita background"
//  (providers/economic-news.js), disimpan di KV (Worker tidak punya
//  akses filesystem/git saat runtime, jadi KV adalah "file" yang
//  paling setara di lingkungan ini).
//
//  Auto-hapus per-entry:
//    - Entry yang PUNYA eventDate: basi begitu event itu sudah lewat
//      LEBIH DARI 1 hari (bukan lagi berdasarkan umur log itu sendiri
//      — jadi log tetap ada selama event masih relevan, walau itu
//      artinya bertahan berminggu-minggu kalau eventnya masih jauh).
//    - Entry TANPA eventDate (mis. gagal fetch data/jadwal.js itu
//      sendiri, sebelum sempat tau event mana yang dituju) — gak ada
//      acuan event buat nentuin kapan basi, jadi tetap pakai fallback
//      umur (FALLBACK_MAX_AGE_DAYS) biar gak numpuk selamanya.
//  Dicek ulang tiap kali ada tulisan baru DAN tiap kali dibaca — jadi
//  tetap bersih walau cron sempat berhenti lama.
// ══════════════════════════════════════════════════════════
export const LOG_KEY = "cron_log_v1";
export const LOG_MAX_ITEMS = 200;
const FALLBACK_MAX_AGE_DAYS = 7; // cuma buat entry tanpa eventDate
const LOG_KV_TTL_SECONDS = 60 * 24 * 60 * 60; // safety net kalau cron berhenti total lama (event terjauh saat ini ~Des 2026)

function isExpired(entry, now) {
  const ts = new Date(entry.ts).getTime();
  if (isNaN(ts)) return true; // entry rusak, buang aja

  if (entry.eventDate) {
    // Basi begitu event sudah lewat LEBIH dari 1 hari (grace period 1
    // hari setelah tanggal event, bukan tanggal log-nya dibuat).
    const eventEndOfDay = new Date(`${entry.eventDate}T23:59:59+07:00`).getTime();
    if (isNaN(eventEndOfDay)) return true;
    return now.getTime() > eventEndOfDay + 24 * 60 * 60 * 1000;
  }

  return now.getTime() - ts > FALLBACK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// event & eventDate opsional — diisi kalau log ini terkait 1 event
// tertentu (dipakai buat aturan auto-hapus "event sudah lewat").
export async function appendLog(env, { level, message, event = null, eventDate = null }) {
  let list = [];
  try {
    const raw = await env['didinska-kv'].get(LOG_KEY);
    if (raw) list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }

  const now = new Date();
  list = list.filter((entry) => !isExpired(entry, now));
  list.unshift({ ts: now.toISOString(), level, message, event, eventDate });
  if (list.length > LOG_MAX_ITEMS) list = list.slice(0, LOG_MAX_ITEMS);

  try {
    await env['didinska-kv'].put(LOG_KEY, JSON.stringify(list), { expirationTtl: LOG_KV_TTL_SECONDS });
  } catch (e) {
    console.error("[log] Gagal simpan log ke KV:", e.message);
  }
}

export async function readLogs(env) {
  try {
    const raw = await env['didinska-kv'].get(LOG_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const now = new Date();
    return list.filter((entry) => !isExpired(entry, now));
  } catch (e) {
    return [];
  }
}

export async function clearLogs(env) {
  await env['didinska-kv'].delete(LOG_KEY);
}
