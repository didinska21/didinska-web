// ⚙️ GANTI INI ke URL worker Cloudflare kamu setelah deploy, misalnya:
// const API_BASE = "https://didinska-bot.username.workers.dev";
const API_BASE = "https://didinska-api.mr-didinska21.workers.dev";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server tidak merespons dengan format yang benar (HTTP ${res.status}). Coba lagi beberapa saat lagi.`);
  }
  if (!data.ok) throw new Error(data.error || "Gagal ambil data.");
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server tidak merespons dengan format yang benar (HTTP ${res.status}). Coba lagi beberapa saat lagi.`);
  }
  if (!data.ok) throw new Error(data.error || "Gagal memproses.");
  return data;
}

function sentimentBadge(sentiment) {
  const map = {
    Bullish: { cls: "bull", icon: "▲" },
    Bearish: { cls: "bear", icon: "▼" },
    Netral: { cls: "neutral", icon: "●" },
  };
  const s = map[sentiment] || map["Netral"];
  return `<span class="badge ${s.cls}">${s.icon} ${sentiment}</span>`;
}

function fmtUsd(n) {
  if (n == null) return "-";
  return n >= 1 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${n}`;
}

// Signature element: strip harga sebelum -> sesudah dengan panah & persen berwarna.
function impactStrip(impact, coinSymbol) {
  if (!impact) return "";
  const up = impact.pct_change >= 0;
  const arrowCls = up ? "up" : "down";
  const arrow = up ? "→ ▲" : "→ ▼";
  const sign = up ? "+" : "";
  return `
    <div class="impact">
      <span class="price">${coinSymbol || ""} ${fmtUsd(impact.price_before)}</span>
      <span class="arrow ${arrowCls}">${arrow}</span>
      <span class="price">${fmtUsd(impact.price_after)}</span>
      <span class="pct ${arrowCls}">${sign}${impact.pct_change}%</span>
    </div>
    <div class="impact-note">Harga ${impact.price_after_date === "sekarang" ? "saat ini" : `per ${impact.price_after_date}`} vs saat event terjadi.</div>
  `;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ══════════════════════════════════════════════════════════
//  JADWAL EKONOMI MANUAL — Sprint 12
//  Economic Calendar tidak lagi lewat Worker/API pihak ketiga. Sumber
//  datanya file statis data/jadwal.js (window.ECONOMIC_EVENTS), di-edit
//  manual. Helper di bawah menormalkan bentuknya supaya sama persis
//  dengan event crypto dari backend ({date, time_wib, event,
//  date_iso_full, category, _sort, ...}), jadi bisa digabung & dirender
//  pakai kode yang sama (eventCardHtml) di index.html/jadwal.html/analisa.html.
// ══════════════════════════════════════════════════════════
const MONTH_NAMES_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function fmtManualDate(dateISO) {
  // Sengaja TIDAK pakai `new Date(dateISO).getDate()/.getMonth()` — itu
  // baca timezone LOKAL runtime (browser/server), bukan WIB, jadi bisa
  // salah mundur/maju 1 hari tergantung timezone user. dateISO
  // ("YYYY-MM-DD") sudah berupa tanggal kalender WIB apa adanya, jadi
  // cukup di-parse sebagai string.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return dateISO;
  const day = parseInt(m[3], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${day} ${MONTH_NAMES_ID[monthIdx] || m[2]}`;
}

// Baca window.ECONOMIC_EVENTS, buang yang sudah lewat, urutkan naik,
// maks 15 (sama seperti aturan schedule crypto backend).
function getManualEconomicEvents() {
  const raw = Array.isArray(window.ECONOMIC_EVENTS) ? window.ECONOMIC_EVENTS : [];
  const now = Date.now();
  return raw
    .map((it) => {
      const timeOk = it.time && it.time !== "-";
      // Tanggal+jam manual dianggap WIB (waktu Indonesia, sama seperti
      // seluruh tampilan jam di situs ini).
      const sortDate = new Date(`${it.date}T${timeOk ? it.time : "00:00"}:00+07:00`);
      if (isNaN(sortDate.getTime())) return null;
      return {
        id: it.id,
        category: "economic",
        event: it.event,
        date: fmtManualDate(it.date),
        time_wib: timeOk ? it.time : "-",
        date_iso_full: it.date,
        currency: it.currency || "",
        impact: it.impact || null,
        forecast: it.forecast || "",
        previous: it.previous || "",
        description: it.description || "",
        affected: Array.isArray(it.affected) ? it.affected : [],
        notes: it.notes || "",
        source: it.source || "Manual",
        _sort: sortDate.getTime(),
      };
    })
    .filter((it) => it && it._sort >= now - 24 * 3600 * 1000)
    .sort((a, b) => a._sort - b._sort)
    .slice(0, 15);
}

function impactBadge(impact) {
  const map = {
    HIGH: { cls: "impact-high", label: "HIGH" },
    MEDIUM: { cls: "impact-medium", label: "MEDIUM" },
    LOW: { cls: "impact-low", label: "LOW" },
  };
  const s = map[impact];
  return s ? `<span class="badge ${s.cls}">${s.label}</span>` : "";
}

// Satu kartu event, dipakai index.html/jadwal.html/analisa.html supaya
// field manual (forecast/previous/affected/notes/dst) tampil konsisten
// tanpa nge-duplikasi template di 3 tempat. footerHtml opsional buat
// halaman yang butuh tambahan (mis. tombol Analisa).
function eventCardHtml(it, { cardId, footerHtml } = {}) {
  const tag = it.category === "crypto" ? "🪙 Crypto" : "🏛️ Makro";
  const jam = it.time_wib && it.time_wib !== "-" ? `${it.time_wib} WIB` : "jam belum diketahui";
  const isManual = it.category === "economic";

  const meta = isManual ? `
    <div class="event-meta">
      ${it.currency ? `<span class="meta-chip">${escapeHtml(it.currency)}</span>` : ""}
      ${impactBadge(it.impact)}
      ${it.forecast ? `<span class="meta-chip">Forecast: ${escapeHtml(it.forecast)}</span>` : ""}
      ${it.previous ? `<span class="meta-chip">Previous: ${escapeHtml(it.previous)}</span>` : ""}
    </div>
    ${it.description ? `<div class="event-desc">${escapeHtml(it.description)}</div>` : ""}
    ${it.affected && it.affected.length ? `<div class="event-affected">${it.affected.map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join("")}</div>` : ""}
    ${it.notes ? `<div class="event-notes">📝 ${escapeHtml(it.notes)}</div>` : ""}
  ` : "";

  return `
    <div class="card"${cardId ? ` id="${cardId}"` : ""}>
      <div class="card-row">
        <div>
          <span class="card-tag">${tag}</span>
          <div class="card-title">${escapeHtml(it.event)}</div>
        </div>
        <div class="card-date">${it.date}<br>${jam}</div>
      </div>
      ${meta}
      ${footerHtml || ""}
    </div>`;
}
