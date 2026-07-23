# Panduan Deploy — Didinska

Ada 2 bagian: **worker** (backend, Cloudflare Workers — sudah kamu punya, ini versi upgrade-nya) dan **site** (website statis buat GitHub Pages).

## 1. Deploy worker

1. Buka worker Cloudflare kamu yang lama (yang sudah jalan buat bot Telegram).
2. Ganti isi file worker-nya dengan `worker/worker.js` di sini (ini versi lama + endpoint API baru, nggak ada yang dihapus).
3. Pastikan secret/binding ini masih ada (harusnya udah ada semua dari sebelumnya):
   - `TELEGRAM_BOT_TOKEN`
   - `SERPER_API_KEY`
   - `GROQ_API_KEY` (atau `GROQ_API_KEY_1`, `_2`, dst.)
   - `BOT_KV` (KV namespace)
   - `TELEGRAM_WEBHOOK_SECRET` (opsional)
   - `ALLOWED_USER_IDS` (opsional)
4. Deploy (`wrangler deploy` atau lewat dashboard).
5. Catat URL worker-nya, contoh: `https://didinska-bot.username.workers.dev`

### Endpoint baru yang tersedia setelah ini:
- `GET  /api/jadwal` → jadwal event mendatang (macro + crypto)
- `POST /api/analisa` → jalankan analisa AI untuk 1 event, body: `{"source":"schedule","idx":0,"n_ai":5}`
- `GET  /api/riwayat` → daftar event yang sudah pernah dianalisa + dampak harga

Coba dulu di browser: buka `https://url-worker-kamu.workers.dev/api/jadwal` — harusnya keluar JSON.

## 2. Sambungkan website ke worker

Buka `site/assets/app.js`, baris pertama:

```js
const API_BASE = "https://GANTI-DENGAN-URL-WORKER-KAMU.workers.dev";
```

Ganti dengan URL worker kamu dari langkah 1.5.

## 3. Upload ke GitHub Pages

1. Upload semua isi folder `site/` (index.html, jadwal.html, analisa.html, assets/) ke repo GitHub kamu (`didinska.my.id` yang sudah ada), **timpa file lama**.
2. Pastikan GitHub Pages aktif di repo tersebut (Settings → Pages).
3. Tunggu beberapa menit, buka `didinska.my.id` lagi.

## Cara "Sudah terjadi" keisi datanya

Riwayat di tab "Sudah terjadi" **tidak otomatis muncul sendiri** dari internet — dia keisi setiap kali ada event yang dianalisa (baik dari tombol "Analisa" di website, atau dari bot Telegram kamu seperti biasa), asal:
- Event-nya punya tanggal yang jelas, dan
- Nama event-nya mengandung nama koin yang dikenali (BTC/Bitcoin, ETH/Ethereum, SOL/Solana, BNB, XRP/Ripple, DOGE, ADA/Cardano)

Kalau dua syarat itu terpenuhi, sistem otomatis ambil harga koin itu dari CoinGecko (harga saat event vs 3 hari sesudahnya) dan hitung persentase kenaikan/penurunannya.

**Supaya tab "Sudah terjadi" cepat keisi**, paling gampang: pakai bot Telegram kamu seperti biasa buat analisa beberapa event dulu (terutama yang nyebut BTC/ETH secara eksplisit) — otomatis kekirim juga ke website.

## Yang perlu kamu tahu / batasan saat ini

- Koin yang dikenali baru 7: BTC, ETH, SOL, BNB, XRP, DOGE, ADA. Gampang ditambah kalau mau lebih banyak (tinggal edit `COIN_MAP` di worker.js).
- Forex & saham belum ada logic dampak harganya (nunggu confirm kamu, sesuai obrolan sebelumnya).
- CORS di worker dibuka buat semua domain (`*`). Kalau situs ini sudah stabil di `didinska.my.id`, sebaiknya nanti dibatasi (edit `CORS_ALLOW_ORIGIN` di worker.js) biar API-nya nggak sembarangan dipanggil orang lain.
- Setiap analisa AI makan quota Groq — tombol "10 AI" 2x lebih mahal dari "5 AI".
