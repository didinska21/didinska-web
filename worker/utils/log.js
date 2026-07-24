// ══════════════════════════════════════════════════════════
//  LOG CRON — riwayat jalannya cron "gali berita background"
//  (providers/economic-news.js), disimpan di KV (Worker tidak punya
//  akses filesystem/git saat runtime, jadi KV adalah "file" yang
//  paling setara di lingkungan ini).
//
//  Auto-hapus per-entry kalau SALAH SATU tercapai:
//    - umur entry > LOG_MAX_AGE_DAYS hari, ATAU
//    - event yang terkait entry itu sudah lewat tanggalnya
//  Dicek ulang tiap kali ada tulisan baru DAN tiap kali dibaca — jadi
//  tetap bersih walau cron sempat berhenti lama.
// ══════════════════════════════════════════════════════════
export const LOG_KEY = "cron_log_v1";
export const LOG_MAX_ITEMS = 200;
const LOG_MAX_AGE_DAYS = 3;
const LOG_KV_TTL_SECONDS = 30 * 24 * 60 * 60; // safety net kalau cron berhenti total lama

function isExpired(entry, now) {
  const ts = new Date(entry.ts).getTime();
  if (isNaN(ts)) return true; // entry rusak, buang aja
  const tooOld = now.getTime() - ts > LOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const eventPassed = entry.eventDate
    ? new Date(`${entry.eventDate}T23:59:59+07:00`).getTime() < now.getTime()
    : false;
  return tooOld || eventPassed;
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
