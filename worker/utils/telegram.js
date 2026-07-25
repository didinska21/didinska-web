import { getSession, saveSession } from "./session.js";
import { buildBotScheduleList, scheduleText, scheduleKb, jadwalViewKb } from "../services/calendar.js";
import { analyzeEvent, parseSentiment } from "../services/analysis.js";
import { detectCoin, computePriceImpact } from "../providers/crypto.js";
import { appendHistory } from "./history.js";
import { friendlyErrorMessage } from "../providers/groq.js";
import { readLogs, clearLogs } from "./log.js";
import { createKey, listKeys, revokeKey } from "./access-keys.js";

// ══════════════════════════════════════════════════════════
//  WHITELIST
// ══════════════════════════════════════════════════════════
export function isAllowed(uid, env) {
  const raw = (env.ALLOWED_USER_IDS || "").trim();
  if (!raw) return true;
  const ids = raw.split(",").map((x) => x.trim());
  return ids.includes(String(uid));
}

// ══════════════════════════════════════════════════════════
//  TELEGRAM API HELPERS
// ══════════════════════════════════════════════════════════
export async function tg(env, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  // Telegram API sering nolak request (mis. Markdown gak valid) dengan
  // HTTP 200 + {ok:false} — BUKAN error HTTP, jadi gampang ke-skip diam-
  // diam kalau gak dicek eksplisit. Catat ke console minimal, biar
  // ketauan di Observability/wrangler tail walau gak bikin whole request
  // gagal (pesan lain yang masih dalam antrian tetap coba dikirim).
  if (!data.ok) {
    console.error(`[telegram] ${method} ditolak Telegram: ${data.description || "(tanpa deskripsi)"}`);
  }
  return data;
}

export async function sendMessage(env, chatId, text, extra = {}) {
  const chunks = [];
  let t = text;
  while (t.length > 4000) {
    chunks.push(t.slice(0, 4000));
    t = t.slice(4000);
  }
  chunks.push(t);
  let last;
  for (const c of chunks) {
    last = await tg(env, "sendMessage", { chat_id: chatId, text: c, parse_mode: "Markdown", ...extra });
  }
  return last;
}

export async function editMessageText(env, chatId, messageId, text, extra = {}) {
  return tg(env, "editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown", ...extra });
}

export async function answerCallback(env, callbackId, text) {
  return tg(env, "answerCallbackQuery", { callback_query_id: callbackId, text });
}

// ══════════════════════════════════════════════════════════
//  KEYBOARDS
// ══════════════════════════════════════════════════════════
export function mainKb() {
  return {
    keyboard: [
      ["📅 Jadwal News", "📰 Analisa News"],
      ["❓ Bantuan"],
    ],
    resize_keyboard: true,
  };
}

export function aiCountKb(idx) {
  return {
    inline_keyboard: [
      [
        { text: "⚡ 5 AI (lebih cepat)", callback_data: `an_5_${idx}` },
        { text: "🧠 10 AI (lebih teliti)", callback_data: `an_10_${idx}` },
      ],
    ],
  };
}
// Catatan: "N AI" = N total panggilan AI (N-1 analis independen + 1 yang menyimpulkan).

// ══════════════════════════════════════════════════════════
//  UPDATE ROUTER (TELEGRAM — tidak diubah)
// ══════════════════════════════════════════════════════════
export async function handleUpdate(update, env) {
  try {
    if (update.callback_query) return await handleCallback(update.callback_query, env);
    if (update.message?.text) return await handleMessage(update.message, env);
  } catch (e) {
    console.error("handleUpdate error:", e);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const uid = message.from.id;
  const txt = (message.text || "").trim();
  const s = await getSession(env, uid);

  if (!isAllowed(uid, env)) {
    await sendMessage(env, chatId, `🔒 Akses ditolak. User ID kamu: \`${uid}\``);
    return;
  }

  if (txt === "/start") {
    Object.assign(s, { state: "idle", schedule: [], last_opinions: [], last_event: null });
    await saveSession(env, uid, s);
    await sendMessage(
      env, chatId,
      `📰 *NEWS & ECONOMIC CALENDAR ANALYST BOT*\n\nHalo *${message.from.first_name}*!\n\n` +
      `Bot ini bantu kamu pantau jadwal event ekonomi & kripto penting dan analisa dampaknya ke market pakai konsensus beberapa AI.\n\n` +
      `⚠️ Hanya alat bantu analisis, bukan nasihat finansial. Selalu cek ulang ke sumber resmi.\n\nPilih menu di bawah:`,
      { reply_markup: mainKb() }
    );
    return;
  }

  if (txt === "/help" || txt === "❓ Bantuan") {
    await sendMessage(env, chatId,
      "❓ *BANTUAN*\n\n" +
      "📅 *Jadwal News* → lihat daftar event ekonomi & kripto terdekat (yang AKAN datang, bukan yang sudah lewat). FOMC/ECB/CPI/PPI/NFP di-scrape langsung dari halaman kalender resmi (federalreserve.gov, ecb.europa.eu, bls.gov). Event kripto dari hasil pencarian jadwal/deadline terkini.\n\n" +
      "📰 *Analisa News* → sama seperti Jadwal News, tapi tiap event bisa di-tap. Pilih 5 atau 10 AI, bot akan cari berita terkait event itu dan menyimpulkan sentimen/dampaknya ke market.\n\n" +
      "📋 */log* → lihat riwayat cron gali-berita background (jalan tiap 2 jam, target event ekonomi terdekat dari data/jadwal.js).\n" +
      "🗑️ */clearlog* → kosongkan riwayat log cron.\n\n" +
      "🔑 */newkey [label]* → generate access key baru buat website (share manual ke yang mau dikasih akses).\n" +
      "📜 */keys* → lihat semua access key yang aktif.\n" +
      "❌ */revokekey <key>* → cabut 1 access key.\n\n" +
      "Data di-cache 6 jam. Tap '🔄 Refresh Jadwal' kalau mau paksa update."
    );
    return;
  }

  if (txt === "/log") {
    const logs = await readLogs(env);
    if (!logs.length) {
      await sendMessage(env, chatId, "📭 Belum ada log cron tersimpan (atau semua entry sudah auto-expire).");
      return;
    }
    // Isi log (nama event, pesan error) adalah konten dinamis/gak terduga
    // — bisa aja ngandung karakter yang bentrok sama parser Markdown
    // Telegram (mis. tanda kurung siku dianggap awal link, underscore
    // ganjil dianggap italic gak lengkap), yang bikin SELURUH pesan
    // ditolak Telegram tanpa error jelas di sisi kita. Makanya khusus
    // buat /log, parse_mode dimatikan total (plain text, paling aman).
    const lines = ["LOG CRON GALI BERITA (auto-hapus setelah 3 hari atau event lewat)\n"];
    logs.slice(0, 15).forEach((l) => {
      const wib = new Date(new Date(l.ts).getTime() + 7 * 3600 * 1000);
      const jam = `${String(wib.getUTCHours()).padStart(2, "0")}:${String(wib.getUTCMinutes()).padStart(2, "0")}`;
      const tgl = `${wib.getUTCDate()}/${wib.getUTCMonth() + 1}`;
      const icon = l.level === "error" ? "❌" : "✅";
      const ctx = l.event ? ` (${l.event})` : "";
      lines.push(`${icon} ${tgl} ${jam} WIB${ctx} — ${l.message}`);
    });
    await sendMessage(env, chatId, lines.join("\n"), { parse_mode: undefined });
    return;
  }

  if (txt === "/clearlog") {
    await clearLogs(env);
    await sendMessage(env, chatId, "🗑️ Log cron sudah dikosongkan.");
    return;
  }

  if (txt === "/newkey" || txt.startsWith("/newkey ")) {
    const label = txt.slice("/newkey".length).trim();
    const key = await createKey(env, label);
    await sendMessage(
      env, chatId,
      `Access key baru dibuat${label ? ` (${label})` : ""}:\n\n${key}\n\nShare key ini ke orang yang mau dikasih akses website. Cek daftar/cabut lewat /keys dan /revokekey.`,
      { parse_mode: undefined }
    );
    return;
  }

  if (txt === "/keys") {
    const keys = await listKeys(env);
    if (!keys.length) {
      await sendMessage(env, chatId, "📭 Belum ada access key. Pakai /newkey [label] buat bikin.");
      return;
    }
    const lines = ["DAFTAR ACCESS KEY WEBSITE\n"];
    keys.forEach((k) => {
      const wib = new Date(new Date(k.createdAt).getTime() + 7 * 3600 * 1000);
      const tgl = `${wib.getUTCDate()}/${wib.getUTCMonth() + 1}/${wib.getUTCFullYear()}`;
      lines.push(`${k.key}${k.label ? ` (${k.label})` : ""} — dibuat ${tgl}`);
    });
    lines.push("\nHapus lewat /revokekey <key>");
    await sendMessage(env, chatId, lines.join("\n"), { parse_mode: undefined });
    return;
  }

  if (txt.startsWith("/revokekey ")) {
    const key = txt.slice("/revokekey ".length).trim();
    const ok = await revokeKey(env, key);
    await sendMessage(
      env, chatId,
      ok ? `Key ${key} sudah dicabut, gak bisa dipakai lagi buat akses website.` : `Key ${key} gak ketemu di daftar (cek /keys).`,
      { parse_mode: undefined }
    );
    return;
  }

  if (txt === "📅 Jadwal News") {
    await sendMessage(env, chatId, "⏳ Mencari jadwal event terbaru...");
    try {
      const list = await buildBotScheduleList(env);
      s.schedule = list;
      await saveSession(env, uid, s);
      await sendMessage(env, chatId, scheduleText(list), { reply_markup: jadwalViewKb() });
    } catch (e) {
      await sendMessage(env, chatId, friendlyErrorMessage(e, "ambil jadwal"));
    }
    return;
  }

  if (txt === "📰 Analisa News") {
    await sendMessage(env, chatId, "⏳ Mencari jadwal event terbaru...");
    try {
      const list = await buildBotScheduleList(env);
      s.schedule = list;
      await saveSession(env, uid, s);
      if (!list.length) {
        await sendMessage(env, chatId, "📭 Belum ada jadwal event mendatang yang bisa dianalisa saat ini. Coba lagi nanti.");
        return;
      }
      await sendMessage(env, chatId, "📰 *ANALISA NEWS*\n\nTap salah satu event buat dianalisa:", { reply_markup: scheduleKb(list) });
    } catch (e) {
      await sendMessage(env, chatId, friendlyErrorMessage(e, "ambil jadwal"));
    }
    return;
  }

  await sendMessage(env, chatId, "💡 Pilih menu dari keyboard, atau ketik /start.", { reply_markup: mainKb() });
}

async function handleCallback(cb, env) {
  const chatId = cb.message.chat.id;
  const uid = cb.from.id;
  const data = cb.data;
  const s = await getSession(env, uid);

  if (!isAllowed(uid, env)) { await answerCallback(env, cb.id, "🔒 Akses ditolak."); return; }
  await answerCallback(env, cb.id, "");

  if (data === "refresh_jadwal_view") {
    await editMessageText(env, chatId, cb.message.message_id, "⏳ Refreshing jadwal...");
    try {
      const list = await buildBotScheduleList(env, true);
      s.schedule = list;
      await saveSession(env, uid, s);
      await editMessageText(env, chatId, cb.message.message_id, scheduleText(list), { reply_markup: jadwalViewKb() });
    } catch (e) {
      await editMessageText(env, chatId, cb.message.message_id, friendlyErrorMessage(e, "refresh"));
    }
    return;
  }

  if (data === "refresh_schedule") {
    await editMessageText(env, chatId, cb.message.message_id, "⏳ Refreshing jadwal...");
    try {
      const list = await buildBotScheduleList(env, true);
      s.schedule = list;
      await saveSession(env, uid, s);
      await editMessageText(env, chatId, cb.message.message_id, "📰 *ANALISA NEWS*\n\nTap salah satu event buat dianalisa:", { reply_markup: scheduleKb(list) });
    } catch (e) {
      await editMessageText(env, chatId, cb.message.message_id, friendlyErrorMessage(e, "refresh"));
    }
    return;
  }

  if (data.startsWith("ev_")) {
    const idx = parseInt(data.slice(3), 10);
    const event = s.schedule[idx];
    if (!event) {
      await sendMessage(env, chatId, "⚠️ Jadwal ini sudah kadaluarsa, buka lagi '📰 Analisa News'.");
      return;
    }
    const jam = event.time_wib && event.time_wib !== "-" ? `, ${event.time_wib} WIB` : "";
    await sendMessage(env, chatId, `📌 *${event.date}${jam} — ${event.event}*\n\nMau dianalisa pakai berapa AI?`, { reply_markup: aiCountKb(idx) });
    return;
  }

  if (data.startsWith("an_")) {
    const [, nStr, idxStr] = data.split("_");
    const n = parseInt(nStr, 10);
    const idx = parseInt(idxStr, 10);
    const event = s.schedule[idx];
    if (!event) {
      await sendMessage(env, chatId, "⚠️ Jadwal ini sudah kadaluarsa, buka lagi '📰 Analisa News'.");
      return;
    }
    await sendMessage(env, chatId, `⏳ Menjalankan ${n} AI (${n - 1} analis + 1 kesimpulan) untuk *${event.event}*... (~10-20 detik)`);
    try {
      const { final } = await analyzeEvent(env, event, n);
      s.last_event = event;
      await saveSession(env, uid, s);
      await sendMessage(env, chatId, final, { reply_markup: mainKb() });

      // Simpan juga ke riwayat website, sama seperti flow /api/analisa.
      const sentiment = parseSentiment(final);
      const coin = detectCoin(event.event);
      let impact = null;
      if (coin && event.date_iso_full) {
        impact = await computePriceImpact(coin.id, event.date_iso_full).catch(() => null);
      }
      if (event.date_iso_full) {
        await appendHistory(env, {
          id: crypto.randomUUID(),
          event: event.event,
          date: event.date,
          date_iso_full: event.date_iso_full,
          category: event.category || "crypto",
          sentiment,
          final,
          coin: coin ? coin.symbol : null,
          impact,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      await sendMessage(env, chatId, friendlyErrorMessage(e, "analisa"), { reply_markup: mainKb() });
    }
    return;
  }
}
