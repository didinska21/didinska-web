# PODWATCH — On-chain Whale Radar

Dashboard whale tracker + sinyal edukatif + PnL tracker manual. Jalan otomatis
pakai GitHub Actions, hosting statis di GitHub Pages, tanpa VPS.

## Struktur

```
repo-kamu/
├── .github/workflows/whale-tracker.yml   <- robot yang jalan tiap 15 menit
├── scripts/fetch_whales.py               <- ambil & proses data whale
├── data/
│   ├── whales.json    <- daftar transaksi whale terbaru
│   ├── state.json     <- posisi terakhir tiap chain (jangan diedit manual)
│   └── signal.json    <- sinyal net flow ke/dari exchange
├── index.html          <- halaman dashboard utama
└── pnl.html            <- halaman PnL tracker
```

⚠️ **Ini bakal menimpa `index.html` lama kamu.** Kalau mau simpan portfolio lama,
rename dulu file `index.html` yang sekarang jadi misal `portfolio-lama.html`
sebelum upload yang baru.

## Cara pasang

1. Upload semua file di atas ke root repo `didinska-web` (pakai cara "satu-satu"
   yang udah kita bahas: Add file → Create new file, ketik path lengkapnya,
   paste isinya).
2. Daftar API key gratis:
   - Etherscan: https://etherscan.io/apis
   - BscScan: https://bscscan.com/apis
3. Masukin ke GitHub Secrets (Settings → Secrets and variables → Actions):
   - `ETHERSCAN_API_KEY`
   - `BSCSCAN_API_KEY`
4. Tab **Actions** → pilih workflow "Whale Tracker" → **Run workflow** buat tes manual.
5. Buka `https://didinska.my.id` — dashboard whale + `https://didinska.my.id/pnl.html` buat PnL tracker.

## Soal "sinyal" di dashboard

Sinyal (Netral / Tekanan Jual / Tekanan Beli) dihitung dari net flow whale
ke/dari alamat exchange yang dikenal publik (Binance, Kraken, Coinbase, dll),
dalam 24 jam terakhir. Ini **indikator edukatif dari data on-chain**, bukan
rekomendasi trading — daftar alamat exchange-nya juga belum lengkap
(bisa ditambah di `EXCHANGE_ADDRESSES` dalam `fetch_whales.py`).

Threshold sinyal (`SIGNAL_THRESHOLD_USD`, default $5,000,000) dan threshold
whale (`THRESHOLD_USD`, default $1,000,000) bisa diubah di file workflow
`.github/workflows/whale-tracker.yml`.

## Soal PnL Tracker

Halaman `pnl.html` murni client-side — posisi yang kamu catat cuma tersimpan
di browser HP/laptop kamu sendiri (localStorage), belum konek ke exchange
manapun. Kalau ganti HP atau clear data browser, catatan posisi bakal hilang.
Harga live diambil dari CoinGecko tiap 30 detik.
