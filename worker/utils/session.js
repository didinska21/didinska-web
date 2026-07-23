// ══════════════════════════════════════════════════════════
//  SESSION (Cloudflare KV)
// ══════════════════════════════════════════════════════════
export async function getSession(env, uid) {
  const raw = await env['didinska-kv'].get(`session:${uid}`);
  if (raw) return JSON.parse(raw);
  return { state: "idle", schedule: [], last_opinions: [], last_event: null };
}

export async function saveSession(env, uid, s) {
  await env['didinska-kv'].put(`session:${uid}`, JSON.stringify(s), { expirationTtl: 60 * 60 * 24 * 7 }); // 7 hari
}
