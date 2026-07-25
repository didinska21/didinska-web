import { serperSearch, extractItems } from "./crypto.js";
import { appendLog } from "../utils/log.js";
import { fmtWIBDate, fmtWIBTime } from "../utils/timezone.js";

// ══════════════════════════════════════════════════════════
//  ECONOMIC NEWS PRE-FETCHER — Sprint "gali duluan di background"
//  ------------------------------------------------------------
//  Cron job (tiap 2 jam) yang:
//    1. Fetch data/jadwal.js LANGSUNG dari situs GitHub Pages (sumber
//       tunggal jadwal ekonomi manual — Worker tidak duplikat datanya).
//    2. Cari 1 event WIB paling dekat yang belum lewat.
//    3. Serper search berita soal event itu, gabung ke "bucket" KV
//       (dedupe + cap jumlah), supaya pas user klik "Analisa X AI",
//       AI-nya udah punya banyak cuplikan berita, bukan cuma dari
//       1x search saat itu juga.
//  Endpoint API, format JSON, dan behavior lama TIDAK berubah — ini
//  murni nambah "bahan bacaan" di background.
// ══════════════════════════════════════════════════════════

const MANUAL_EVENTS_URL = "https://didinska.my.id/data/jadwal.js";
const NEWS_BUCKET_MAX_ITEMS = 20;
const NEWS_BUCKET_TTL_SECONDS = 21 * 24 * 60 * 60; // 21 hari — cukup buat siklus rilis bulanan, otomatis basi sendiri kalau event sudah lama lewat

// ──────────────────────────────────────────────────────────
//  Fetch & parse data/jadwal.js
//  File itu BUKAN JSON murni (key tanpa quote, trailing comma,
//  komentar) — jadi dievaluasi pakai Function constructor. Ini aman
//  karena sumbernya file kita sendiri di repo kita sendiri (bukan
//  input dari user luar), bukan lubang keamanan.
// ──────────────────────────────────────────────────────────
export async function fetchManualEconomicEvents() {
  const res = await fetch(MANUAL_EVENTS_URL);
  if (!res.ok) throw new Error(`Gagal fetch ${MANUAL_EVENTS_URL}: HTTP ${res.status}`);
  const text = await res.text();

  const match = /window\.ECONOMIC_EVENTS\s*=\s*(\[[\s\S]*\])\s*;/.exec(text);
  if (!match) throw new Error("Format data/jadwal.js tidak dikenali (window.ECONOMIC_EVENTS tidak ketemu).");

  let events;
  try {
    events = new Function(`"use strict"; return (${match[1]});`)();
  } catch (e) {
    throw new Error(`Gagal parse isi window.ECONOMIC_EVENTS: ${e.message}`);
  }
  if (!Array.isArray(events)) throw new Error("window.ECONOMIC_EVENTS bukan array.");
  return events;
}

// Cari event WIB paling dekat yang datetime-nya masih di masa depan.
// date+time di data/jadwal.js sudah WIB (offset +07:00), jadi tinggal
// digabung langsung tanpa perlu hitung DST segala macam (beda dari
// macro provider lama yang sudah dihapus).
export function pickNearestEvent(events, now = new Date()) {
  const upcoming = events
    .map((it) => {
      if (!it.date || !it.event) return null;
      const timeOk = it.time && it.time !== "-";
      const dt = new Date(`${it.date}T${timeOk ? it.time : "00:00"}:00+07:00`);
      if (isNaN(dt.getTime())) return null;
      return { ...it, _sort: dt.getTime() };
    })
    .filter((it) => it && it._sort >= now.getTime())
    .sort((a, b) => a._sort - b._sort);
  return upcoming[0] || null;
}

// Key KV buat bucket berita 1 event. Sengaja pakai `event` (nama) +
// `date` (ISO) mentah — persis field yang dikirim analisa.html sebagai
// body.event / body.date_iso_full pas user klik Analisa, jadi otomatis
// nyambung tanpa perlu mapping tambahan.
export function newsBucketKey(eventName, dateIso) {
  return `news_bucket:${eventName}|${dateIso}`;
}

// ──────────────────────────────────────────────────────────
//  Normalisasi 1 event manual (raw dari data/jadwal.js) jadi bentuk
//  "schedule item" yang sama persis dengan yang dipakai buildScheduleList()
//  di calendar.js (date, date_iso_full, time_wib, event, category, _sort)
//  — supaya bisa digabung & di-render pakai scheduleText()/scheduleKb()
//  yang sudah ada, tanpa perlu duplikat logic tampilan.
// ──────────────────────────────────────────────────────────
function toScheduleItem(it) {
  if (!it.date || !it.event) return null;
  const timeOk = it.time && it.time !== "-";
  // Instant sebenarnya (buat sorting & filter "sudah lewat/belum") —
  // date+time di data/jadwal.js sudah WIB (+07:00), gak perlu hitung DST.
  const trueInstant = new Date(`${it.date}T${timeOk ? it.time : "00:00"}:00+07:00`);
  if (isNaN(trueInstant.getTime())) return null;
  // fmtWIBDate/fmtWIBTime (utils/timezone.js) mengharapkan Date yang
  // field getUTC*-nya sudah merepresentasikan jam WIB langsung (konvensi
  // yang sama dipakai etToWIB/cetToWIB dulu) — jadi digeser +7 jam dulu
  // KHUSUS buat pemanggilan format ini, bukan buat _sort.
  const wibShifted = new Date(trueInstant.getTime() + 7 * 3600 * 1000);
  return {
    date: fmtWIBDate(wibShifted),
    date_iso_full: it.date,
    time_wib: timeOk ? fmtWIBTime(wibShifted) : "-",
    event: it.event,
    category: "economic",
    _sort: trueInstant.getTime(),
  };
}

// Semua event manual yang masih mendatang, dinormalisasi & diurutkan —
// dipakai bot Telegram (lihat services/calendar.js: buildBotScheduleList)
// supaya "Jadwal News"/"Analisa News" di bot konsisten dengan website
// (yang juga baca data/jadwal.js yang sama, cuma di sisi client).
export async function getUpcomingManualScheduleItems(now = new Date()) {
  const events = await fetchManualEconomicEvents();
  return events
    .map(toScheduleItem)
    .filter((it) => it && it._sort >= now.getTime())
    .sort((a, b) => a._sort - b._sort);
}

export async function readNewsBucket(env, key) {
  try {
    const raw = await env['didinska-kv'].get(key);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// Gabung item baru ke bucket yang sudah ada, dedupe by judul (case-
// insensitive), cap ke NEWS_BUCKET_MAX_ITEMS (item baru diprioritaskan
// karena kemungkinan lebih relevan/fresh daripada yang lama).
export async function appendNewsToBucket(env, key, newItems) {
  if (!newItems || !newItems.length) return;
  const existing = await readNewsBucket(env, key);
  const merged = [...newItems, ...existing];
  const seen = new Set();
  const deduped = [];
  for (const it of merged) {
    const dedupeKey = (it.title || "").trim().toLowerCase();
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(it);
    if (deduped.length >= NEWS_BUCKET_MAX_ITEMS) break;
  }
  await env['didinska-kv'].put(key, JSON.stringify(deduped), { expirationTtl: NEWS_BUCKET_TTL_SECONDS });
}

// ──────────────────────────────────────────────────────────
//  Entry point dipanggil dari scheduled() handler di worker.js
// ──────────────────────────────────────────────────────────
export async function refreshNearestEventNews(env) {
  try {
    const events = await fetchManualEconomicEvents();
    const nearest = pickNearestEvent(events);
    if (!nearest) {
      console.log("[CRON economic-news] Tidak ada event mendatang di data/jadwal.js.");
      await appendLog(env, { level: "info", message: "Tidak ada event mendatang di data/jadwal.js." });
      return { ok: true, event: null };
    }

    const key = newsBucketKey(nearest.event, nearest.date);
    const searchData = await serperSearch(env, `${nearest.event} dampak market analisis`, "news", 10);
    const items = extractItems(searchData, "news");
    await appendNewsToBucket(env, key, items);

    console.log(`[CRON economic-news] "${nearest.event}" (${nearest.date}) — +${items.length} item mentah digabung ke bucket "${key}".`);
    await appendLog(env, {
      level: "info",
      message: `+${items.length} item berita baru digabung ke bucket.`,
      event: nearest.event,
      eventDate: nearest.date,
    });
    return { ok: true, event: nearest.event, date: nearest.date, itemsFetched: items.length };
  } catch (e) {
    await appendLog(env, { level: "error", message: e.message });
    throw e; // tetap dilempar biar worker.js bisa console.error sebagai fallback terakhir
  }
}
