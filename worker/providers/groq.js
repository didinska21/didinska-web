// ══════════════════════════════════════════════════════════
//  GROQ
// ──────────────────────────────────────────────────────────
//  MODELS: 4 model/system Groq dipakai buat ensemble analisa —
//  disilang round-robin biar tiap analis genuinely beda, bukan cuma
//  temperature beda di model yang sama.
//
//  - openai/gpt-oss-120b   → Production, paling stabil. Dipakai juga
//                            buat panggilan penyimpul (DEFAULT_MODEL).
//  - groq/compound         → "System" (bukan model biasa) — otomatis
//                            bisa web search/eksekusi kode sendiri di
//                            background sebelum jawab. Latency bisa
//                            lebih variatif dari model biasa.
//  - llama-3.3-70b-versatile → ⚠️ SUDAH DIUMUMKAN DEPRECATED, shutdown
//                            16 Agustus 2026. Sengaja tetap dipakai
//                            (permintaan eksplisit) — error handling
//                            di bawah udah toleran per-slot, jadi kalau
//                            ini mati nanti, cuma 1/4 slot yang mulai
//                            gagal, bukan bikin semuanya rusak. CABUT
//                            dari array ini begitu tanggal itu lewat.
//  - groq/compound-mini    → System juga, versi lebih ringan/cepat.
//
//  Kalau nanti Groq deprecate salah satu lagi, cek
//  https://console.groq.com/docs/models sebelum ganti model string.
// ══════════════════════════════════════════════════════════
export const MODELS = ["openai/gpt-oss-120b", "groq/compound", "llama-3.3-70b-versatile", "groq/compound-mini"];
export const DEFAULT_MODEL = MODELS[0];

const DEFAULT_TIMEOUT_MS = 25000;

export function getGroqKeys(env) {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  if (!keys.length && env.GROQ_API_KEY) keys.push(env.GROQ_API_KEY);
  return keys;
}

// model & timeoutMs ditambahkan sebagai parameter opsional di akhir —
// pemanggil lama yang tidak peduli ensemble (mis. parsing JSON jadwal
// crypto) tetap jalan tanpa perubahan, otomatis pakai DEFAULT_MODEL.
export async function callGroqIndexed(env, idx, messages, maxTokens = 1200, temperature = 0.5, model = DEFAULT_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const keys = getGroqKeys(env);
  if (!keys.length) throw new Error("Tidak ada GROQ_API_KEY yang di-set");
  const total = keys.length;
  let i = idx % total;
  let tried = 0;
  let rateLimitCount = 0;
  let lastErr;
  while (tried < total) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys[i]}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429) {
        rateLimitCount++;
        throw Object.assign(new Error("rate_limit"), { retryable: true });
      }
      if (res.status >= 500) {
        // Error sisi server Groq — sementara, layak dicoba ke key/percobaan berikutnya.
        throw Object.assign(new Error(`Groq HTTP ${res.status}: server error`), { retryable: true });
      }
      if (!res.ok) {
        // 4xx selain 429 (400/401/403/dll) — request-nya sendiri yang salah,
        // bakal gagal sama persis di key manapun. Jangan buang-buang key lain.
        const bodyText = await res.text();
        throw Object.assign(new Error(`Groq HTTP ${res.status}: ${bodyText}`), { retryable: false });
      }

      const data = await res.json();
      return data.choices[0].message.content;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") {
        lastErr = Object.assign(new Error(`Groq timeout setelah ${timeoutMs}ms (model ${model})`), { retryable: true });
      } else {
        lastErr = e;
      }
      if (lastErr.retryable === false) {
        throw lastErr; // error permanen, langsung gagal — gak usah cycle ke key lain
      }
      tried++;
      i = (i + 1) % total;
    }
  }
  if (rateLimitCount === total) {
    const err = new Error("Semua API key Groq kena rate limit.");
    err.isRateLimit = true;
    throw err;
  }
  throw new Error(`Semua key Groq gagal (panggilan #${idx + 1}, model ${model}): ${lastErr}`);
}

export function friendlyErrorMessage(e, context) {
  if (e.isRateLimit) {
    return `🚫 *Sedang sibuk*\n\nLayanan AI lagi kena batas pemakaian. Biasanya reset dalam beberapa jam.\n\n💡 Coba lagi nanti ya.`;
  }
  return `❌ Gagal ${context}: ${e.message}`;
}
