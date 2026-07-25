// ══════════════════════════════════════════════════════════
//  ACCESS KEYS — gerbang akses seluruh website (bukan bot Telegram,
//  yang sudah punya whitelist ALLOWED_USER_IDS sendiri).
//  ------------------------------------------------------------
//  Key di-generate lewat command bot Telegram (/newkey), disimpan di
//  KV sebagai 1 array JSON (mirip pola history.js/log.js). Frontend
//  minta user masukin key sekali, simpan di localStorage browser,
//  lalu kirim di header X-Access-Key di setiap panggilan API.
// ══════════════════════════════════════════════════════════
import { jsonResponse } from "./cors.js";

export const ACCESS_KEYS_KEY = "access_keys_v1";

async function readKeys(env) {
  try {
    const raw = await env['didinska-kv'].get(ACCESS_KEYS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function writeKeys(env, list) {
  await env['didinska-kv'].put(ACCESS_KEYS_KEY, JSON.stringify(list));
}

// Format key: gampang dibaca/di-copy-paste manual (bukan UUID panjang),
// tapi tetap random & sulit ditebak — 16 karakter alfanumerik dari
// crypto.getRandomValues (bukan Math.random, biar beneran random).
function generateKeyString() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I biar gak ketuker pas dibaca manual
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += chars[bytes[i] % chars.length];
    if (i % 4 === 3 && i !== bytes.length - 1) out += "-";
  }
  return out; // contoh: "A3F9-KLM2-8XPQ-7TZR"
}

export async function createKey(env, label = "") {
  const list = await readKeys(env);
  const key = generateKeyString();
  list.unshift({ key, label: label || "", createdAt: new Date().toISOString() });
  await writeKeys(env, list);
  return key;
}

export async function listKeys(env) {
  return readKeys(env);
}

// Balikin true kalau berhasil revoke (key ketemu & dihapus), false
// kalau key gak ada di daftar.
export async function revokeKey(env, key) {
  const list = await readKeys(env);
  const filtered = list.filter((k) => k.key !== key);
  if (filtered.length === list.length) return false;
  await writeKeys(env, filtered);
  return true;
}

export async function isValidKey(env, key) {
  if (!key) return false;
  const list = await readKeys(env);
  return list.some((k) => k.key === key);
}

// ──────────────────────────────────────────────────────────
//  API HANDLER — POST /api/auth
//  Dipakai frontend buat validasi key SEBELUM disimpan ke localStorage
//  (kasih feedback instan "key salah" tanpa nunggu request lain gagal).
// ──────────────────────────────────────────────────────────
export async function handleApiAuth(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Body harus JSON." }, 400);
  }
  const valid = await isValidKey(env, body.key);
  if (!valid) return jsonResponse({ ok: false, error: "Access key tidak valid." }, 401);
  return jsonResponse({ ok: true });
}
