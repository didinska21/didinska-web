// ══════════════════════════════════════════════════════════
//  GROQ
// ══════════════════════════════════════════════════════════
export const MODEL = "llama-3.3-70b-versatile";

export function getGroqKeys(env) {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (!keys.length && env.GROQ_API_KEY) keys.push(env.GROQ_API_KEY);
  return keys;
}

export async function callGroqIndexed(env, idx, messages, maxTokens = 1200, temperature = 0.5) {
  const keys = getGroqKeys(env);
  if (!keys.length) throw new Error("Tidak ada GROQ_API_KEY yang di-set");
  const total = keys.length;
  let i = idx % total;
  let tried = 0;
  let rateLimitCount = 0;
  let lastErr;
  while (tried < total) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys[i]}` },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature }),
      });
      if (res.status === 429) {
        rateLimitCount++;
        throw new Error("rate_limit");
      }
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (e) {
      lastErr = e;
      tried++;
      i = (i + 1) % total;
    }
  }
  if (rateLimitCount === total) {
    const err = new Error("Semua API key Groq kena rate limit.");
    err.isRateLimit = true;
    throw err;
  }
  throw new Error(`Semua key Groq gagal (panggilan #${idx + 1}): ${lastErr}`);
}

export function friendlyErrorMessage(e, context) {
  if (e.isRateLimit) {
    return `🚫 *Limit Groq API tercapai*\n\nSemua API key Groq lagi kena rate limit. Biasanya reset per jam atau per hari tergantung tier akun Groq kamu.\n\n💡 Coba lagi beberapa jam lagi atau besok ya.`;
  }
  return `❌ Gagal ${context}: ${e.message}`;
}
