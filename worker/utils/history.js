import { jsonResponse } from "./cors.js";

// ══════════════════════════════════════════════════════════
//  RIWAYAT (KV) — dipakai buat "Jadwal News > Sudah terjadi"
// ══════════════════════════════════════════════════════════
export const HISTORY_KEY = "history_log_v1";
export const HISTORY_MAX_ITEMS = 200;

export async function appendHistory(env, record) {
  let list = [];
  try {
    const raw = await env['didinska-kv'].get(HISTORY_KEY);
    if (raw) list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }
  list.unshift(record);
  if (list.length > HISTORY_MAX_ITEMS) list = list.slice(0, HISTORY_MAX_ITEMS);
  await env['didinska-kv'].put(HISTORY_KEY, JSON.stringify(list));
}

export async function readHistory(env) {
  try {
    const raw = await env['didinska-kv'].get(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// ══════════════════════════════════════════════════════════
//  API HANDLER — GET /api/riwayat
// ══════════════════════════════════════════════════════════
export async function handleApiRiwayat(env) {
  try {
    const list = await readHistory(env);
    return jsonResponse({ ok: true, list });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message }, 500);
  }
}
