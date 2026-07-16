# ROADMAP — Didinska Web

Repo: https://github.com/didinska21/didinska-web
Live: https://didinska.my.id

Status per 17 Juli 2026: frontend `index.html` (News & Analysis) sudah jadi & live,
backend/data belum ada. Roadmap ini urutan kerja dari sini sampai semua fitur jalan.

---

## FASE 0 — Konsolidasi (housekeeping, belum ngoding fitur baru)
- [ ] Kumpulkan isi file yang belum di-share: `pnl.html`, `watchlist.html`,
      `scripts/fetch_whales.py`, `.github/workflows/whale-tracker.yml`
- [ ] Rename/pindah isi whale tracker lama → `wallet.html`
- [ ] Update nav di `pnl.html` & `watchlist.html` biar konsisten sama `index.html`
      (nav: News | Wallet | Watchlist | PnL)
- [ ] Update `README.md` pakai isi `PROJECT-SUMMARY.md`

**Output fase ini:** struktur menu final tanpa fitur baru, semua nav nyambung.

---

## FASE 1 — Data Berita (News)
- [ ] Buat `scripts/fetch_news.py`
  - Ambil dari RSS gratis: CoinTelegraph, Decrypt, CoinDesk, Bitcoin.com, dll
  - Parse jadi `data/news.json` (title, url, summary, source, published_at)
  - Dedup + limit (misal ambil 40-60 berita terbaru)
- [ ] Buat `.github/workflows/news.yml` — jalan tiap 30 menit, commit `data/news.json`
- [ ] Test manual: Actions → Run workflow → cek `index.html` nampilin berita di tab "Berita"

**Output fase ini:** tab Berita di Highlight sudah hidup.

---

## FASE 2 — Data Event (Kalender)
- [ ] Buat `scripts/fetch_events.py`
  - Sumber: CoinMarketCal (API gratis) atau sumber gratis lain
  - Output `data/events.json` (title, description, event_date, category, coins[])
  - Termasuk event yang **akan datang** dan yang **baru saja terjadi**
- [ ] Gabungkan ke workflow yang sama di Fase 1 (atau workflow terpisah, jalan tiap 30-60 menit)
- [ ] Test: tab "Event" & "Semua" di Highlight

**Output fase ini:** Highlight section (Semua/Berita/Event) fully jalan.

---

## FASE 3 — Data Harga (buat porsi teknikal 10%)
- [ ] Buat/reuse script ambil harga dari CoinGecko (mirip yang dipakai `pnl.html`)
  - Simpan ke `data/prices.json` — harga + %change 24h buat coin-coin di watchlist + market cap total
- [ ] Indikator teknikal simpel dulu (misal: %change 24h, %change 7d) — nggak perlu RSI/MACD ribet
  di awal, bisa dikembangkan belakangan

**Output fase ini:** bahan mentah teknikal siap dipakai script analisa.

---

## FASE 4 — Analisa Groq (inti fitur "News-based Analysis")
- [ ] Setup GitHub Secrets: `GROQ_API_KEY_1` s/d `GROQ_API_KEY_5` (buat rotasi hindari rate limit)
- [ ] Buat `scripts/analyze_groq.py`
  - Input: `news.json` + `events.json` + `prices.json`
  - Prompt ke Groq: minta analisa **90% berdasarkan news/event, 10% teknikal**
  - Analisa 2 level: **general market** + **per-coin** (dari watchlist)
  - Rotasi 5 API key kalau salah satu limit/error
  - Output `data/analysis.json`:
    ```json
    {
      "final_label": "Bullish|Bearish|Netral",
      "final_score": -100..100,
      "summary": "...",
      "breakdown": { "news_score": ..., "technical_score": ... },
      "per_coin": [ { "coin": "BTC", "label": "...", "score": ..., "reason": "..." } ],
      "updated_at": "ISO8601"
    }
    ```
- [ ] Gabungkan ke workflow, jalan tiap 30 menit (setelah fetch_news & fetch_events selesai)

**Output fase ini:** Market Pulse card di index.html hidup penuh — bias badge, skor, ringkasan.

---

## FASE 5 — Per-Coin Analysis Display
- [ ] Tambah section baru di `index.html` (atau halaman baru `analysis.html` kalau kepanjangan)
  buat nampilin analisa per-coin dari `per_coin` array di `analysis.json`
- [ ] Bisa filter/link ke watchlist user

**Output fase ini:** user bisa lihat analisa spesifik per koin, bukan cuma general market.

---

## FASE 6 — Polish & Reliability
- [ ] Error handling: kalau salah satu sumber (RSS/CoinMarketCal/Groq) down, jangan sampai
      seluruh workflow gagal — fallback ke data lama
- [ ] Cache/rate-limit awareness biar nggak boros quota Groq/API gratis lain
- [ ] Cek mobile responsiveness (index.html kayaknya udah mobile-friendly, tinggal cross-check)
- [ ] Tambah disclaimer/edukasi kalau perlu diperjelas lagi

---

## Prioritas kalau waktu terbatas
1. Fase 1 (News) — paling gampang, RSS gratis, langsung keliatan hasilnya
2. Fase 4 (Analisa Groq) — inti value proposition web ini
3. Fase 2 (Events) — pelengkap, boleh nyusul
4. Fase 3, 5, 6 — penyempurnaan

---

## Catatan konteks (biar AI lain paham cepat)
- Semua keputusan besar udah difix: sumber gratis, Groq 5 key, bobot 90/10, per-coin + general market,
  index cuma news+analisa, tools lain jadi sub-menu.
- Lihat `PROJECT-SUMMARY.md` buat detail struktur file & keputusan lengkap.
