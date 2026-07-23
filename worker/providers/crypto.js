import { callGroqIndexed } from "./groq.js";
import { MONTH_NAMES, MONTH_MAP, startOfTodayUTC } from "../utils/timezone.js";

// ══════════════════════════════════════════════════════════
//  SERPER.DEV — SEARCH & NEWS
// ══════════════════════════════════════════════════════════
export async function serperSearch(env, query, endpoint = "search", num = 10) {
  if (!env.SERPER_API_KEY) throw new Error("SERPER_API_KEY belum di-set di Cloudflare Secrets.");
  const res = await fetch(`https://google.serper.dev/${endpoint}`, {
    method: "POST",
    headers: { "X-API-KEY": env.SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num, gl: "id", hl: "id" }),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Serper response bukan JSON (HTTP ${res.status}). Cuplikan: ${raw.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Serper HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

export function extractItems(result, type) {
  const list = type === "news" ? (result?.news || []) : (result?.organic || []);
  return list.map((o) => ({
    title: o.title,
    snippet: o.snippet || "",
    date: o.date || null,
    source: o.link || o.source || "?",
  }));
}

// ══════════════════════════════════════════════════════════
//  CRYPTO EVENTS — tetap dari search+news (gak ada kalender resmi tunggal)
// ══════════════════════════════════════════════════════════
const CRYPTO_SYSTEM_PROMPT = `Kamu asisten yang menyusun daftar JADWAL/DEADLINE kripto MENDATANG (regulasi, keputusan ETF, listing besar, upgrade jaringan) dari hasil pencarian web mentah.

SANGAT PENTING — bedakan ini:
- BOLEH dimasukkan: tanggal keputusan SEC yang DIJADWALKAN, deadline pengajuan/persetujuan ETF, tanggal listing/upgrade yang DIUMUMKAN akan terjadi.
- JANGAN dimasukkan: rekap harga yang SUDAH terjadi (misal "harga Bitcoin turun ke $X pada tanggal Y", "Bitcoin naik ke $X"), berita yang menceritakan kejadian di masa lalu, atau analisis pasar yang bukan soal jadwal/deadline resmi.
- Kalau ragu apakah suatu tanggal itu jadwal mendatang atau cuma rekap kejadian lama → JANGAN dimasukkan, lebih baik dilewati daripada salah.

ATURAN FORMAT KETAT:
- Balas HANYA dengan JSON array valid. TIDAK ADA teks lain, TIDAK ADA markdown code fence.
- Format tiap item persis: {"date":"DD Bulan","time_wib":"HH:MM" atau "-","event":"Nama event singkat (jelas ini jadwal/deadline apa)"}
- "time_wib" WAJIB format 24 jam, dikonversi ke WIB (UTC+7) kalau sumber nyebut jam dengan jelas. Kalau gak jelas, isi "-".
- KALAU data mentah tidak menyebutkan tanggal MENDATANG yang jelas, JANGAN masukkan event itu. Jangan mengarang tanggal.
- Ambil maksimal 6 event yang paling relevan/penting.
- Kalau data mentah sama sekali tidak cukup / semuanya cuma rekap masa lalu, balas array kosong: []`;

export async function getCryptoEvents(env) {
  const now = new Date();
  const monthYear = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  const results = await Promise.all([
    serperSearch(env, `crypto ETF SEC decision deadline schedule upcoming`, "news", 8).catch((e) => { console.error("[CRYPTO SEARCH FAIL] query 1:", e.message); return null; }),
    serperSearch(env, `jadwal keputusan regulasi kripto mendatang ${monthYear}`, "news", 8).catch((e) => { console.error("[CRYPTO SEARCH FAIL] query 2:", e.message); return null; }),
  ]);

  const rawLines = [];
  results.forEach((r) => {
    if (!r) return;
    extractItems(r, "news").forEach((o) => {
      rawLines.push(`- ${o.title}: ${o.snippet} (${o.date || "tanggal tidak disebutkan"}) [sumber: ${o.source}]`);
    });
  });

  if (!rawLines.length) {
    console.error("[CRYPTO] Tidak ada hasil pencarian sama sekali untuk jadwal crypto.");
    return [];
  }

  const userMsg = `Hari ini: ${now.toISOString().slice(0, 10)}.\n\nHasil pencarian:\n${rawLines.join("\n")}`;
  const raw = await callGroqIndexed(env, 1, [{ role: "system", content: CRYPTO_SYSTEM_PROMPT }, { role: "user", content: userMsg }], 1000, 0.2);

  let list;
  try {
    list = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!Array.isArray(list)) {
      console.error("[CRYPTO] Groq balas bukan array:", raw.slice(0, 300));
      return [];
    }
  } catch (e) {
    console.error("[CRYPTO] Gagal parse JSON dari Groq:", e.message, "| raw:", raw.slice(0, 300));
    return [];
  }

  const todayStart = startOfTodayUTC(now);
  const daysAhead = 60;
  const cutoff = new Date(now.getTime() + daysAhead * 86400000);

  return list
    .map((it) => {
      const parts = (it.date || "").split(" ");
      if (parts.length !== 2 || MONTH_MAP[parts[1]] === undefined) return null;
      const day = parseInt(parts[0], 10);
      const month = MONTH_MAP[parts[1]];
      const yr = now.getUTCFullYear();
      const guess = new Date(Date.UTC(yr, month, day));
      if (guess < todayStart || guess > cutoff) return null;
      // date_iso_full ditambahkan biar konsisten dengan macro events (buat lookup harga historis).
      return { ...it, date_iso_full: guess.toISOString().slice(0, 10), category: "crypto", _sort: guess.getTime() };
    })
    .filter(Boolean);
}

// ══════════════════════════════════════════════════════════
//  DETEKSI KOIN & HARGA HISTORIS (CoinGecko)
//  Dipakai buat fitur "Sudah terjadi" di website.
// ══════════════════════════════════════════════════════════
export const COIN_MAP = {
  btc: "bitcoin", bitcoin: "bitcoin",
  eth: "ethereum", ethereum: "ethereum",
  sol: "solana", solana: "solana",
  bnb: "binancecoin", "binance coin": "binancecoin",
  xrp: "ripple", ripple: "ripple",
  doge: "dogecoin", dogecoin: "dogecoin",
  ada: "cardano", cardano: "cardano",
};
export const COIN_SYMBOL = {
  bitcoin: "BTC", ethereum: "ETH", solana: "SOL", binancecoin: "BNB",
  ripple: "XRP", dogecoin: "DOGE", cardano: "ADA",
};

// Cari kata koin di teks event. Balikin {id, symbol} pertama yang ketemu, atau null.
export function detectCoin(text) {
  const lower = (text || "").toLowerCase();
  for (const key of Object.keys(COIN_MAP)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(lower)) {
      const id = COIN_MAP[key];
      return { id, symbol: COIN_SYMBOL[id] };
    }
  }
  return null;
}

export function addDaysISO(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isPastISO(dateISO) {
  return new Date(`${dateISO}T00:00:00Z`).getTime() < Date.now();
}

// Harga historis CoinGecko pada tanggal tertentu (format API: DD-MM-YYYY).
export async function cgHistoricalPrice(coinId, dateISO) {
  const [y, m, d] = dateISO.split("-");
  const dateParam = `${d}-${m}-${y}`;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${dateParam}&localization=false`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.market_data?.current_price?.usd ?? null;
  } catch (e) {
    console.error("[COINGECKO] gagal ambil harga historis:", e.message);
    return null;
  }
}

export async function cgCurrentPrice(coinId) {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[coinId]?.usd ?? null;
  } catch (e) {
    console.error("[COINGECKO] gagal ambil harga current:", e.message);
    return null;
  }
}

// Hitung dampak harga: harga saat event vs harga N hari sesudahnya
// (atau harga sekarang, kalau event terlalu baru buat sudah punya data +N hari).
export const IMPACT_WINDOW_DAYS = 3;
export async function computePriceImpact(coinId, dateISOFull) {
  if (!coinId || !dateISOFull) return null;
  const priceBefore = await cgHistoricalPrice(coinId, dateISOFull);
  if (priceBefore == null) return null;

  const afterDateISO = addDaysISO(dateISOFull, IMPACT_WINDOW_DAYS);
  const priceAfter = isPastISO(afterDateISO)
    ? await cgHistoricalPrice(coinId, afterDateISO)
    : await cgCurrentPrice(coinId);
  if (priceAfter == null) return null;

  const pctChange = ((priceAfter - priceBefore) / priceBefore) * 100;
  return {
    price_before: priceBefore,
    price_after: priceAfter,
    price_after_date: isPastISO(afterDateISO) ? afterDateISO : "sekarang",
    pct_change: Math.round(pctChange * 100) / 100,
  };
}
