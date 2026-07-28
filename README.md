# Didinska

News & Economic Calendar Analyst — pantau jadwal event ekonomi (FOMC, CPI, PPI, NFP) & kripto, lalu jalankan analisa dampaknya ke market pakai konsensus beberapa AI. Diakses lewat website statis dan bot Telegram.

⚠️ Alat bantu analisis edukatif, bukan nasihat finansial. Selalu cek ulang ke sumber resmi sebelum ambil keputusan.

## Arsitektur

```
Telegram  ──┐
            ├──▶  Cloudflare Worker  ──▶  Groq (AI) · Serper (search) · CoinGecko (harga)
Website   ──┘            │
   (GitHub Pages)         └──▶  KV Storage (session, cache, riwayat, log, memori, access key)
```

- **Backend**: 1 Cloudflare Worker (`worker/`), semua logic ekonomi/crypto/AI ada di sini.
- **Frontend**: situs statis (`index.html`, `jadwal.html`, `analisa.html`) di-hosting GitHub Pages, manggil Worker lewat `/api/*`.
- **Bot Telegram**: jalur terpisah (`/webhook`), berbagi logic yang sama dengan website (`services/analysis.js`, `services/calendar.js`) tapi tidak lewat pengecekan access key.
- **Cron**: tiap 2 jam, Worker gali berita buat 1 event ekonomi terdekat (dari `data/jadwal.js`) di background, supaya pas "Analisa" dijalankan AI sudah punya lebih banyak konteks.

## Fitur

- **Jadwal News** — daftar event ekonomi (manual, dari `data/jadwal.js`) + crypto (hasil pencarian AI), diurutkan berdasarkan waktu.
- **Analisa News** — konsensus 5 atau 10 panggilan AI (campuran `openai/gpt-oss-120b` & `openai/gpt-oss-20b` via Groq) buat nentuin sentimen (Bullish/Bearish/Netral) & dampak ke harga koin terkait (CoinGecko, before/after 3 hari).
- **Memori AI** — catatan manual (`/inget`) + riwayat analisa event serupa sebelumnya, otomatis jadi konteks tambahan tiap analisa dijalankan.
- **Gali berita background** — cron tiap 2 jam ngumpulin berita buat event terdekat, biar analisa on-demand lebih kaya konteks & lebih hemat API call.
- **Access key** — seluruh website butuh key (di-generate lewat bot Telegram), biar cuma orang yang dikasih akses yang bisa pakai. Bot Telegram sendiri diproteksi terpisah lewat whitelist `ALLOWED_USER_IDS`.
- **Log & observability** — riwayat cron (`/log`), isi berita yang dikumpulkan (`/berita`), semuanya bisa dicek langsung dari bot tanpa buka Cloudflare Dashboard.

## Struktur folder

```
├── index.html              Beranda — event terdekat
├── jadwal.html              Daftar semua event mendatang
├── analisa.html              Pilih event, jalankan analisa AI
├── data/jadwal.js            Kalender ekonomi manual (diedit tangan tiap minggu)
├── assets/
│   ├── style.css              Desain (dark + gold, animasi)
│   ├── app.js                 Helper bersama (fetch API, render kartu event, dst)
│   └── auth.js                Access key gate
└── worker/
    ├── worker.js               Entry point — router HTTP + cron trigger
    ├── wrangler.toml           Config Cloudflare (KV binding, cron schedule)
    ├── providers/
    │   ├── crypto.js             Jadwal & harga crypto (Serper search, CoinGecko)
    │   ├── economic-news.js      Fetch+parse data/jadwal.js, bucket berita background
    │   └── groq.js               Client Groq API (rotasi key, retry, timeout)
    ├── services/
    │   ├── calendar.js           Gabung jadwal crypto + manual
    │   └── analysis.js           Jalankan konsensus AI + simpan riwayat
    └── utils/
        ├── access-keys.js        Generate/validasi access key website
        ├── cors.js                Header CORS
        ├── history.js             Riwayat analisa (buat memori & tampilan)
        ├── log.js                 Log cron (auto-expire)
        ├── memory.js              Catatan manual + konteks riwayat serupa
        ├── session.js             Session per user Telegram
        ├── telegram.js            Semua logic bot (command, keyboard, dll)
        └── timezone.js            Konversi WIB
```

## Setup — Cloudflare Worker

1. **KV namespace**: buat 1 KV namespace, bind dengan nama `didinska-kv` di `wrangler.toml` (sudah ada di file, tinggal ganti `id` ke namespace kamu).

2. **Secrets** (`wrangler secret put <NAMA>`):

   | Nama | Wajib? | Keterangan |
   |---|---|---|
   | `TELEGRAM_BOT_TOKEN` | Ya | Token bot dari @BotFather |
   | `SERPER_API_KEY` | Ya | Buat search berita & jadwal crypto |
   | `GROQ_API_KEY_1` s/d `_10` | Ya (minimal 1) | Rotasi otomatis kalau lebih dari 1. Fallback ke `GROQ_API_KEY` (tanpa angka) kalau cuma punya 1 |
   | `TELEGRAM_WEBHOOK_SECRET` | Opsional | Validasi header `X-Telegram-Bot-Api-Secret-Token` di `/webhook` |
   | `ALLOWED_USER_IDS` | Opsional | Telegram user ID yang boleh pakai bot, pisah koma. Kosong = semua orang boleh |

3. **Deploy**: `wrangler deploy` dari folder `worker/`.

4. **Set webhook Telegram** (ganti `<TOKEN>` dan `<URL_WORKER>`):
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<URL_WORKER>/webhook
   ```
   Verifikasi: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

5. **Cron**: sudah otomatis kedaftar dari `[triggers]` di `wrangler.toml` (tiap 2 jam) begitu di-deploy, gak perlu setting manual di Dashboard.

## Setup — Website (GitHub Pages)

1. Buka `assets/app.js`, baris pertama — ganti `API_BASE` ke URL Worker kamu:
   ```js
   const API_BASE = "https://nama-worker-kamu.workers.dev";
   ```
2. Push semua file ke repo GitHub, aktifkan GitHub Pages (Settings → Pages).
3. Generate access key lewat bot Telegram (`/newkey`), masukin key itu pas pertama kali buka situs.

## Access Key

Seluruh website (`index.html`, `jadwal.html`, `analisa.html`) minta access key sebelum bisa dipakai — dicek server-side (bukan cuma client-side), jadi orang yang gak punya key gak bisa manggil API-nya sama sekali.

- `/newkey [label]` — generate key baru, tampil format monospace (tap buat copy)
- `/keys` — lihat semua key aktif
- `/revokekey <key>` — cabut 1 key (langsung berlaku di kunjungan berikutnya)

Key disimpan di `localStorage` browser setelah divalidasi sekali, jadi gak perlu masukin ulang tiap buka situs — kecuali key-nya dicabut atau browser/device beda.

## Command bot Telegram

| Command | Kegunaan |
|---|---|
| `/start` | Mulai / tampilkan menu utama |
| `/help` | Bantuan & penjelasan fitur |
| `/log` | Riwayat cron gali-berita background |
| `/berita` | Isi berita yang sudah dikumpulkan (judul, ringkasan, sumber) buat event terdekat |
| `/inget <teks>` | Simpan catatan yang ikut jadi konteks tiap Analisa News |
| `/memori` | Lihat semua catatan tersimpan |
| `/lupa <id>` | Hapus 1 catatan |
| `/clearlog` | Kosongkan riwayat log cron |
| `/newkey [label]` | Generate access key baru buat website |
| `/keys` | Lihat semua access key aktif |
| `/revokekey <key>` | Cabut 1 access key |

Menu utama (📅 Jadwal News / 📰 Analisa News / ❓ Bantuan) muncul otomatis sebagai keyboard reply setelah `/start`.

## Update jadwal ekonomi manual

Edit langsung `data/jadwal.js` — format array biasa (komentar & trailing comma boleh, file ini di-parse pakai regex di Worker, bukan `JSON.parse`). Field wajib per event: `id`, `date` (`YYYY-MM-DD`), `time` (`HH:MM` WIB atau `"-"`), `event`. Field lain (`currency`, `impact`, `forecast`, `previous`, `description`, `affected`, `notes`, `source`) opsional tapi harus tetap ada key-nya (boleh string/array kosong).

**Jangan isi `forecast`/`previous` dengan angka karangan** — isi manual mendekati tanggal rilis dari sumber kayak investing.com/forexfactory.

## Batasan yang perlu diketahui

- Koin yang dikenali buat hitung dampak harga: BTC, ETH, SOL, BNB, XRP, DOGE, ADA (`providers/crypto.js` → `COIN_MAP`).
- Forex & saham belum ada logic dampak harga.
- CORS Worker terbuka untuk semua origin (`*`) — proteksinya ada di level access key, bukan di level domain.
- Jadwal crypto (`getCryptoEvents`) hasil pencarian AI, bisa kosong kalau lagi gak ada berita relevan yang ketemu — beda dari jadwal ekonomi (`data/jadwal.js`) yang manual dan selalu ada isinya.
- Tiap analisa AI makan kuota Groq & Serper — mode "10 AI" ~2x lebih banyak panggilan dibanding "5 AI".
