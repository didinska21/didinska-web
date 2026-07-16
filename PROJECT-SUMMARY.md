# Didinska Web — Ringkasan Project (buat lanjut di chat/AI lain)

Repo: https://github.com/didinska21/didinska-web
Live: https://didinska.my.id
Hosting: GitHub Pages (statis, tanpa VPS) + GitHub Actions buat update data otomatis

## Visi

Halaman utama (index.html) fokus ke **news & analisa crypto**, bukan tools tracking.
Semua tools tracking (whale, wallet, watchlist, PnL) dipindah jadi **sub-menu**, tidak tampil di index.

### Struktur menu (final)
- **News** (index.html) — highlight berita crypto + analisa market
- **Wallet** (wallet.html) — ganti nama dari whale tracker lama (dulu ada di index.html)
- **Watchlist** (watchlist.html) — sudah ada
- **PnL** (pnl.html) — sudah ada, client-side, localStorage

## Isi Index.html (SUDAH SELESAI dibuat, tinggal isi datanya)

Frontend index.html **sudah jadi** dan sudah live di https://didinska.my.id. Strukturnya:

1. **Market pulse / Analysis card** — badge bias (Bullish/Bearish/Netral), skor gabungan,
   ringkasan analisa, breakdown skor: **Skor News (90%)** dan **Skor Teknikal (10%)**.
   Data diambil dari `data/analysis.json` lewat fetch JS.
2. **Highlight section** — tab Semua / Berita / Event, list card berita & event,
   diurutkan by waktu. Data dari `data/news.json` dan `data/events.json`.
3. Auto-refresh tiap 60 detik di browser, footer bilang "update tiap 30 menit" (dari backend).

File `index.html` sudah di-share lengkap di chat sebelumnya — style dark theme (teal/coral accent,
font Space Grotesk + IBM Plex Mono + Inter).

## Yang BELUM ADA (backend/data) — INI YANG PERLU DIKERJAKAN

Semua elemen di index.html masih nampilin "Memuat data..." karena file JSON-nya belum ada / belum di-generate.

### 1. `data/news.json`
Perlu script `scripts/fetch_news.py` yang ambil berita dari **RSS feed gratis**
(CoinTelegraph, Decrypt, CoinDesk, Bitcoin.com, dll — user bilang "semuanya asal gratis").
Format tiap item kira-kira:
```json
{ "source": "CoinTelegraph", "title": "...", "url": "...", "summary": "...", "published_at": "ISO8601" }
```

### 2. `data/events.json`
Perlu script `scripts/fetch_events.py` buat ambil kalender event crypto (misal CoinMarketCal API gratis,
atau sumber gratis lain) — "jadwal yang akan datang". Format:
```json
{ "title": "...", "description": "...", "event_date": "ISO8601", "category": "...", "coins": ["BTC","ETH"] }
```

### 3. `data/analysis.json`
Perlu script `scripts/analyze_groq.py` yang:
- Baca `news.json` + `events.json` + data harga singkat (bisa dari CoinGecko, sama seperti di pnl.html)
- Kirim ke **Groq API** (user punya 5 API key Groq, kemungkinan buat rotasi biar gak kena rate limit)
- Bikin analisa dengan bobot **90% dari news, 10% dari teknikal**
- Analisa mencakup **per-coin (watchlist)** dan **general market**
- Output format kira-kira:
```json
{
  "final_label": "Bullish",
  "final_score": 42,
  "summary": "...",
  "breakdown": { "news_score": 45, "technical_score": 20 },
  "updated_at": "ISO8601"
}
```

### 4. `wallet.html`
Rename/pindahkan isi whale tracker lama (yang dulu ada di index.html — dashboard PODWATCH
on-chain whale radar) ke file baru `wallet.html`, sesuaikan nav-nya biar konsisten sama index.html
yang baru (nav: News | Wallet | Watchlist | PnL).

### 5. GitHub Actions Workflow
Tambah/perluas workflow (mirip `whale-tracker.yml` yang sudah ada, jalan tiap 15 menit) buat
jalanin `fetch_news.py`, `fetch_events.py`, `analyze_groq.py` tiap 30 menit, commit hasil JSON
ke folder `data/`.

## File yang SUDAH ADA di repo (per README lama)
```
.github/workflows/whale-tracker.yml   <- jalan tiap 15 menit, whale tracker
scripts/fetch_whales.py               <- ambil & proses data whale
data/whales.json, state.json, signal.json
index.html   <- SUDAH DIGANTI ke versi News & Analysis (lihat di atas)
pnl.html     <- PnL tracker manual, client-side, localStorage, harga dari CoinGecko
watchlist.html
CNAME (custom domain didinska.my.id)
```
File yang **belum sempat dishare** di chat: `wallet.html` (belum dibuat), `pnl.html` isi lengkap,
`watchlist.html` isi lengkap, `scripts/fetch_whales.py` isi lengkap, `whale-tracker.yml` isi lengkap.

## Keputusan yang sudah difix bareng user
- Sumber news: **bebas, yang penting gratis** (RSS dari situs2 crypto)
- Analisa pakai **Groq API** (user sudah punya 5 API key, kemungkinan besar buat rotasi/hindari limit)
- Analisa mencakup **general market DAN per-coin** (watchlist)
- Bobot analisa: **90% news, 10% teknikal** (sudah tercermin di UI index.html)
- Semua tools (wallet/whale, watchlist, pnl) jadi **sub-menu**, TIDAK tampil di index

## Next steps kalau lanjut chat baru
1. Share isi `pnl.html`, `watchlist.html`, `scripts/fetch_whales.py`, `whale-tracker.yml` yang sekarang
2. Minta AI buatkan: `wallet.html`, `scripts/fetch_news.py`, `scripts/fetch_events.py`,
   `scripts/analyze_groq.py`, dan workflow Actions yang jalanin semua otomatis
3. Setup GitHub Secrets buat API key Groq (5 biji, kasih nama misal `GROQ_API_KEY_1` s/d `GROQ_API_KEY_5`)
   + API key lain kalau perlu (misal CoinMarketCal)
4. Test manual lewat tab Actions → Run workflow
5. Cek live di https://didinska.my.id
