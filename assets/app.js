// ⚙️ GANTI INI ke URL worker Cloudflare kamu setelah deploy, misalnya:
// const API_BASE = "https://didinska-bot.username.workers.dev";
const API_BASE = "https://GANTI-DENGAN-URL-WORKER-KAMU.workers.dev";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Gagal ambil data.");
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
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
