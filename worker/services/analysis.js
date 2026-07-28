import { callGroqIndexed, friendlyErrorMessage, MODELS } from "../providers/groq.js";
import { serperSearch, detectCoin, computePriceImpact } from "../providers/crypto.js";
import { newsBucketKey, readNewsBucket, appendNewsToBucket } from "../providers/economic-news.js";
import { buildMemoryContext } from "../utils/memory.js";
import { appendHistory } from "../utils/history.js";
import { jsonResponse } from "../utils/cors.js";
import { buildScheduleList } from "./calendar.js";

// ══════════════════════════════════════════════════════════
//  ANALISA NEWS — voting N AI + 1 kesimpulan
// ══════════════════════════════════════════════════════════
const NEWS_ANALYST_PROMPT = `Kamu adalah analis berita ekonomi & pasar profesional.
Berdasarkan KUMPULAN CUPLIKAN BERITA yang diberikan user (bukan pengetahuanmu sendiri), analisa dampak event tersebut ke market (forex/crypto/saham, sesuai relevansi).
JANGAN mengarang angka atau fakta yang tidak ada di cuplikan. Kalau cuplikannya minim, katakan itu terus terang.

FORMAT OUTPUT WAJIB (Bahasa Indonesia, singkat padat):
📰 Ringkasan     : [1-2 kalimat inti berita]
📊 Sentimen      : Bullish 🟢 / Bearish 🔴 / Netral ⚪
💥 Dampak Market : [1-2 kalimat]`;

function newsConsensusPrompt(nTotal, nOpinions) {
  return `Kamu adalah Chief News Analyst yang mengawasi ${nOpinions} analis berita independen yang sudah menganalisa event yang sama.
Tugasmu MENYIMPULKAN, bukan membuat analisa baru:
1. Tentukan sentimen tiap analisis: Bullish, Bearish, atau Netral. Abaikan yang error.
2. Hitung suara tiap sentimen. Suara terbanyak = kesimpulan final. Kalau seri → Netral.
3. Ringkas dampak market yang paling sering disebut, sebutkan kalau ada perbedaan pendapat signifikan.

FORMAT OUTPUT WAJIB:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 KESIMPULAN ANALISA NEWS (${nTotal} AI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 Event      : [nama event]
📊 Voting     : Bullish [n] | Bearish [n] | Netral [n]
🏆 Sentimen   : Bullish 🟢 / Bearish 🔴 / Netral ⚪
💥 Dampak     : [ringkas]
📝 Kesimpulan :
[Maksimal 5 kalimat Bahasa Indonesia.]
⚠️ Catatan    : Hasil konsensus AI, bukan nasihat finansial. Selalu cek ulang ke sumber resmi.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

export async function analyzeEvent(env, event, nTotal) {
  const nOpinions = Math.max(1, nTotal - 1);

  let newsData = await serperSearch(env, `${event.event} dampak market analisis`, "news", 10);
  let newsItems = newsData.news || [];
  if (!newsItems.length) {
    const webData = await serperSearch(env, `${event.event} berita terbaru analisis market`, "search", 10);
    newsItems = webData.organic || [];
  }

  // Gabung sama bucket berita yang udah kekumpul di background (cron
  // tiap 2 jam, lihat providers/economic-news.js) — jadi AI gak cuma
  // modal 1x search saat itu juga, tapi juga cuplikan dari beberapa
  // jam terakhir. Bucket dicari pakai key yang sama persis dengan yang
  // dipakai cron (nama event + tanggal ISO), jadi otomatis nyambung
  // kalau event ini juga lagi digali di background.
  let bucketItems = [];
  if (event.date_iso_full) {
    bucketItems = await readNewsBucket(env, newsBucketKey(event.event, event.date_iso_full));
  }
  const combined = [...newsItems, ...bucketItems];
  const seen = new Set();
  const merged = [];
  for (const it of combined) {
    const dedupeKey = (it.title || "").trim().toLowerCase();
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(it);
  }

  const items = merged
    .slice(0, 15) // dinaikkan dari 10 → 15 karena sekarang sumbernya lebih kaya (fresh + bucket)
    .map((o) => `- [${o.date || "?"}] ${o.title}: ${o.snippet || ""} (sumber: ${o.source || o.link || "?"})`)
    .join("\n");

  if (!items) throw new Error("Tidak menemukan cuplikan berita terkait event ini, coba lagi nanti atau pilih event lain.");

  // Simpan hasil fresh search ke bucket juga, biar analisa manual pun
  // ikut memperkaya bucket buat pemakaian berikutnya (bukan cuma cron).
  if (event.date_iso_full && newsItems.length) {
    await appendNewsToBucket(env, newsBucketKey(event.event, event.date_iso_full), newsItems).catch(() => {});
  }

  // Konteks memori (catatan manual + riwayat analisa event serupa) —
  // disisip ke basePrompt yang dipakai SEMUA panggilan AI (opini +
  // konsensus), jadi analisa baru "nyambung" sama pola/catatan lama.
  const memoryContext = await buildMemoryContext(env, event.event);

  const basePrompt = `EVENT: ${event.event} (${event.date})\n\n` +
    (memoryContext ? `${memoryContext}\n\n` : "") +
    `CUPLIKAN BERITA TERKAIT (hasil pencarian):\n${items}\n\nAnalisa dampak event ini ke market berdasarkan cuplikan di atas. Catatan/riwayat di atas (kalau ada) cuma konteks tambahan, jangan jadi satu-satunya dasar analisa — tetap utamakan cuplikan berita.`;

  // 5 nilai temperature disilang dengan 2 model (MODELS) = 10 kombinasi
  // unik (model,temp) sebelum berulang — cukup buat mode 10 AI (9 opini)
  // tanpa ada dua analis yang persis sama konfigurasinya.
  const TEMPERATURES = [0.4, 0.5, 0.6, 0.7, 0.8];
  const oneOpinion = async (idx) => {
    const model = MODELS[idx % MODELS.length];
    const temp = TEMPERATURES[idx % TEMPERATURES.length];
    try {
      return await callGroqIndexed(
        env, idx,
        [{ role: "system", content: NEWS_ANALYST_PROMPT }, { role: "user", content: basePrompt }],
        700, temp, model
      );
    } catch (e) {
      if (e.isRateLimit) return `[RATE_LIMIT AI #${idx + 1}]`;
      return `[ERROR AI #${idx + 1}: ${e}]`;
    }
  };

  const opinions = await Promise.all(Array.from({ length: nOpinions }, (_, i) => oneOpinion(i)));

  const allRateLimited = opinions.every((op) => op.startsWith("[RATE_LIMIT"));
  if (allRateLimited) {
    const err = new Error("Semua API key Groq kena rate limit.");
    err.isRateLimit = true;
    throw err;
  }
  // Guard tambahan: kalau semua analis gagal karena SEBAB LAIN (bukan
  // rate limit — misal Groq down, network error, dll), jangan tetap
  // paksa AI penyimpul bikin "voting" dari data yang isinya cuma
  // string error semua. Gagal jelas lebih baik daripada konsensus palsu.
  const allFailed = opinions.every((op) => op.startsWith("[RATE_LIMIT") || op.startsWith("[ERROR"));
  if (allFailed) {
    throw new Error("Semua analis AI gagal merespons (bukan karena rate limit) — coba lagi beberapa saat lagi.");
  }

  let consensusInput = `Berikut ${nOpinions} analisis independen untuk event yang sama:\n\n`;
  opinions.forEach((op, i) => {
    consensusInput += `=== ANALIS #${i + 1} ===\n${op}\n\n`;
  });
  consensusInput += `Event: ${event.event} (${event.date})\nSimpulkan sesuai instruksi sistem.`;

  const final = await callGroqIndexed(
    env, nOpinions,
    [{ role: "system", content: newsConsensusPrompt(nTotal, nOpinions) }, { role: "user", content: consensusInput }],
    1200, 0.3, MODELS[0]
  );
  return { final, opinions };
}

// Ambil KHUSUS baris "🏆 Sentimen" — bukan scan seluruh teks, karena
// baris "📊 Voting" selalu punya kata Bullish/Bearish/Netral SEKALIGUS
// (breakdown suara, bukan hasil akhir), jadi kalau discan bareng gampang
// salah baca. Gak lagi wajib ada emoji persis nempel di kata — 2 model
// (gpt-oss-120b/20b) gak selalu 100% taat format persis, jadi cukup cek
// kata kuncinya di baris yang tepat.
export function parseSentiment(finalText) {
  const trophyLine = finalText.split("\n").find((l) => l.includes("🏆"));
  const line = trophyLine || finalText.split("\n").find((l) => /sentimen/i.test(l)) || "";
  if (/bearish/i.test(line)) return "Bearish";
  if (/bullish/i.test(line)) return "Bullish";
  return "Netral";
}

// ══════════════════════════════════════════════════════════
//  API HANDLER — POST /api/analisa
// ══════════════════════════════════════════════════════════
export async function handleApiAnalisa(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Body harus JSON." }, 400);
  }

  const nTotal = body.n_ai === 10 ? 10 : 5; // dibatasi 5 atau 10 biar biaya Groq terkontrol
  let event;

  if (body.source === "schedule" && typeof body.idx === "number") {
    const list = await buildScheduleList(env);
    event = list[body.idx];
    if (!event) return jsonResponse({ ok: false, error: "Index jadwal tidak ditemukan (mungkin cache sudah refresh)." }, 404);
  } else if (body.event) {
    event = { event: body.event, date: body.date || "-", date_iso_full: body.date_iso_full || null, category: body.category || "crypto" };
  } else {
    return jsonResponse({ ok: false, error: "Butuh 'idx' (dari /api/jadwal) atau 'event' custom." }, 400);
  }

  try {
    const { final } = await analyzeEvent(env, event, nTotal);
    const sentiment = parseSentiment(final);
    const coin = detectCoin(event.event);

    let impact = null;
    if (coin && event.date_iso_full) {
      impact = await computePriceImpact(coin.id, event.date_iso_full);
    }

    const record = {
      id: crypto.randomUUID(),
      event: event.event,
      date: event.date,
      date_iso_full: event.date_iso_full || null,
      category: event.category || "crypto",
      sentiment,
      final,
      coin: coin ? coin.symbol : null,
      impact,
      created_at: new Date().toISOString(),
    };

    // Cuma disimpan ke riwayat kalau ada tanggal jelas (dipakai buat timeline "sudah terjadi").
    if (record.date_iso_full) {
      await appendHistory(env, record);
    }

    return jsonResponse({ ok: true, result: record });
  } catch (e) {
    return jsonResponse({ ok: false, error: friendlyErrorMessage(e, "analisa") }, 500);
  }
}
