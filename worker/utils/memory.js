// ══════════════════════════════════════════════════════════
//  MEMORY — dua sumber digabung jadi 1 blok konteks yang disisipkan
//  ke prompt analyzeEvent(), biar analisa baru "nyambung":
//
//   1. Catatan manual ("/inget ...") — fakta/preferensi yang kamu
//      simpan sendiri lewat bot Telegram.
//   2. Riwayat analisa AI SEBELUMNYA (dari history.js) buat event yang
//      SAMA/SERUPA — jadi AI tau pola historis (mis. "CPI bulan lalu
//      sentimennya Bearish, harga BTC turun 3%").
//
//  BUKAN "memori" beneran ala vault/agent otonom — cuma konteks
//  tambahan yang disisip ke prompt tiap kali analyzeEvent() jalan.
// ══════════════════════════════════════════════════════════
import { readHistory } from "./history.js";
import { IMPACT_WINDOW_DAYS } from "../providers/crypto.js";

export const MEMORY_NOTES_KEY = "memory_notes_v1";
const MEMORY_NOTES_MAX = 50;
const RELEVANT_HISTORY_MAX = 3;

async function readNotes(env) {
  try {
    const raw = await env['didinska-kv'].get(MEMORY_NOTES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function writeNotes(env, list) {
  await env['didinska-kv'].put(MEMORY_NOTES_KEY, JSON.stringify(list));
}

export async function addNote(env, text) {
  const list = await readNotes(env);
  const note = { id: crypto.randomUUID().slice(0, 8), text, createdAt: new Date().toISOString() };
  list.unshift(note);
  if (list.length > MEMORY_NOTES_MAX) list.length = MEMORY_NOTES_MAX;
  await writeNotes(env, list);
  return note;
}

export async function listNotes(env) {
  return readNotes(env);
}

export async function deleteNote(env, id) {
  const list = await readNotes(env);
  const filtered = list.filter((n) => n.id !== id);
  if (filtered.length === list.length) return false;
  await writeNotes(env, filtered);
  return true;
}

// Normalisasi nama event buat matching "serupa" — buang isi kurung &
// lowercase, biar "CPI (Consumer Price Index)" bulan ini ketemu sama
// entry riwayat "CPI (Consumer Price Index)" bulan lalu.
function normalizeEventName(name) {
  return (name || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

async function getRelevantHistory(env, eventName) {
  const target = normalizeEventName(eventName);
  if (!target) return [];
  const history = await readHistory(env);
  return history
    .filter((h) => normalizeEventName(h.event) === target)
    .slice(0, RELEVANT_HISTORY_MAX);
}

// Bangun 1 blok teks konteks memori, siap disisip ke prompt AI.
// Balikin string kosong "" kalau gak ada memori sama sekali (biar
// gampang di-skip pemanggil tanpa nambah noise ke prompt).
export async function buildMemoryContext(env, eventName) {
  const [notes, relevantHistory] = await Promise.all([
    readNotes(env),
    getRelevantHistory(env, eventName),
  ]);

  if (!notes.length && !relevantHistory.length) return "";

  const parts = [];

  if (notes.length) {
    parts.push("Catatan yang perlu diingat:\n" + notes.map((n) => `- ${n.text}`).join("\n"));
  }

  if (relevantHistory.length) {
    const lines = relevantHistory.map((h) => {
      const impact = h.impact
        ? `dampak ${h.coin || "?"} ${h.impact.pct_change > 0 ? "+" : ""}${h.impact.pct_change}% dalam ${IMPACT_WINDOW_DAYS} hari`
        : "dampak harga tidak terdeteksi";
      return `- ${h.date} (sentimen ${h.sentiment}): ${impact}`;
    });
    parts.push(`Riwayat analisa event serupa sebelumnya (buat referensi pola, BUKAN prediksi pasti):\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}
