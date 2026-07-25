// ══════════════════════════════════════════════════════════
//  ACCESS GATE — seluruh website butuh access key.
//  Key di-generate lewat bot Telegram (/newkey), dikirim manual ke
//  orang yang dikasih akses, dimasukkan sekali di sini lalu disimpan
//  di localStorage browser. Divalidasi ULANG ke Worker tiap kali situs
//  dibuka (bukan cuma sekali), jadi kalau key di-revoke, akses langsung
//  ke-cabut di kunjungan berikutnya.
//
//  WAJIB dimuat SETELAH app.js (butuh konstanta API_BASE) dan SEBELUM
//  script halaman yang manggil apiGet/apiPost.
// ══════════════════════════════════════════════════════════
const ACCESS_KEY_STORAGE = "didinska_access_key";

function getStoredAccessKey() {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE) || "";
  } catch (e) {
    return "";
  }
}

function setStoredAccessKey(key) {
  try {
    localStorage.setItem(ACCESS_KEY_STORAGE, key);
  } catch (e) { /* localStorage gak tersedia (mis. private mode ketat) — key gak persist, gpp */ }
}

function clearStoredAccessKey() {
  try {
    localStorage.removeItem(ACCESS_KEY_STORAGE);
  } catch (e) {}
}

async function verifyAccessKey(key) {
  if (!key) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    return false; // network error dll — anggap gagal, biar user coba lagi daripada nembus tanpa validasi
  }
}

function showGate(errorMsg) {
  const gate = document.getElementById("access-gate");
  const main = document.getElementById("app-content");
  if (gate) gate.style.display = "flex";
  if (main) main.style.display = "none";
  const errEl = document.getElementById("access-gate-error");
  if (errEl) errEl.textContent = errorMsg || "";
  const input = document.getElementById("access-gate-input");
  if (input) { input.value = ""; input.focus(); }
}

function hideGate() {
  const gate = document.getElementById("access-gate");
  const main = document.getElementById("app-content");
  if (gate) gate.style.display = "none";
  if (main) main.style.display = "";
}

async function submitAccessKey() {
  const input = document.getElementById("access-gate-input");
  const btn = document.getElementById("access-gate-submit");
  const key = (input.value || "").trim();
  if (!key) {
    showGate("Masukkan access key dulu.");
    return;
  }
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Memeriksa...";
  const ok = await verifyAccessKey(key);
  btn.disabled = false;
  btn.textContent = originalLabel;
  if (ok) {
    setStoredAccessKey(key);
    hideGate();
    location.reload(); // reload sekali biar script halaman (yang sempat nunggu gate) mulai bersih dari awal
  } else {
    showGate("Access key salah atau sudah tidak berlaku. Minta key baru ke admin.");
  }
}

// Dipanggil di tiap halaman: await initAccessGate() sebelum manggil
// fungsi load data apapun. Balikin true kalau boleh lanjut, false kalau
// gate lagi ditampilkan (dan submitAccessKey() bakal reload halaman
// sendiri kalau berhasil).
async function initAccessGate() {
  const stored = getStoredAccessKey();
  if (stored) {
    const ok = await verifyAccessKey(stored);
    if (ok) {
      hideGate();
      return true;
    }
    clearStoredAccessKey();
  }
  showGate();
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("access-gate-submit");
  if (btn) btn.addEventListener("click", submitAccessKey);
  const input = document.getElementById("access-gate-input");
  if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitAccessKey(); });
});
