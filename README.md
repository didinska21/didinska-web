# 🌐 Website Portfolio Didin S.

Website portfolio modern dan profesional dengan desain yang menarik dan responsif untuk semua perangkat.

## 📁 Struktur File

```
website/
│
├── index.html          # Halaman utama / welcome
├── profil.html         # Halaman profil dengan hero section
├── skill.html          # Halaman skill dengan progress bars
├── airdrop.html        # Halaman airdrop tracker
├── social.html         # Halaman social media links
├── donasi.html         # Halaman donasi / support
│
├── css/
│   ├── base.css        # Reset CSS & variabel dasar
│   ├── layout.css      # Layout & grid system
│   ├── components.css  # Komponen UI (buttons, cards, dll)
│   └── pages.css       # Style khusus per halaman
│
└── js/
    └── main.js         # JavaScript utama
```

## 🚀 Cara Menggunakan

### 1. Setup File
1. Buat folder `website` di komputer Anda
2. Di dalam folder `website`, buat folder `css` dan `js`
3. Copy semua file HTML ke folder `website`
4. Copy semua file CSS ke folder `css`
5. Copy file JavaScript ke folder `js`

### 2. Struktur Folder
```
website/
├── index.html
├── profil.html
├── skill.html
├── airdrop.html
├── social.html
├── donasi.html
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── pages.css
└── js/
    └── main.js
```

### 3. Buka di Browser
- Double click file `index.html` atau
- Klik kanan → Open with → Browser pilihan Anda

## ✏️ Kustomisasi

### Mengubah Informasi Pribadi

#### 1. Nama & Branding
Edit di semua file HTML:
```html
<!-- Ubah "Didin S." menjadi nama Anda -->
<span class="brand-text">Nama Anda</span>

<!-- Ubah inisial "DS" -->
<span class="brand-mark">XY</span>
```

#### 2. Foto Profil
Ganti URL gambar di `profil.html`:
```html
<img src="https://images.unsplash.com/photo-xxx" alt="Nama Anda">
```
Atau gunakan foto lokal:
```html
<img src="images/foto-saya.jpg" alt="Nama Anda">
```

#### 3. Hero Text
Edit di `profil.html`:
```html
<h1>Hi, Saya [Nama Anda]</h1>
<div class="hero-subtitle">[Profesi Anda]</div>
<p class="hero-description">
  [Deskripsi singkat tentang Anda...]
</p>
```

#### 4. Social Media Links
Edit di `social.html`:
```html
<a href="https://instagram.com/[username_anda]" target="_blank" class="social-card">
```

#### 5. Wallet Address (Donasi)
Edit di `donasi.html`:
```html
<div class="wallet-address" id="btc-address">
  [Alamat Bitcoin Anda]
</div>
```

### Mengubah Warna Theme

Edit variabel di `css/base.css`:
```css
:root {
  /* Ubah warna primary */
  --color-primary: #00aeef;  /* Ganti dengan warna favorit */
  --color-primary-dark: #0096d1;
  
  /* Contoh warna alternatif: */
  /* Purple: #8b5cf6 */
  /* Green: #10b981 */
  /* Orange: #f59e0b */
  /* Red: #ef4444 */
}
```

### Menambah Skill Baru

Edit di `skill.html`:
```html
<div class="skill-item">
  <div class="skill-header">
    <span class="skill-name">Nama Skill</span>
    <span class="skill-level">90%</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" data-progress="90"></div>
  </div>
</div>
```

### Menambah Airdrop Baru

Edit di `airdrop.html`:
```html
<div class="airdrop-item">
  <div class="airdrop-header">
    <div>
      <h3 class="airdrop-title">🚀 Nama Airdrop</h3>
      <span class="airdrop-status status-active">Aktif</span>
    </div>
  </div>
  <p class="airdrop-description">
    Deskripsi airdrop...
  </p>
  <div class="skill-item" style="margin-bottom: var(--spacing-md);">
    <div class="skill-header">
      <span class="skill-name">Progress</span>
      <span class="skill-level">12,450 Points</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" data-progress="65"></div>
    </div>
  </div>
  <div class="airdrop-footer">
    <a href="#" class="btn btn-primary btn-sm">Link Referral</a>
    <a href="#" class="btn btn-outline btn-sm">Official Website</a>
  </div>
</div>
```

## 🎨 Fitur Desain

### ✨ Efek Visual
- Gradient background dengan animasi glow
- Hover effects pada semua elemen interaktif
- Smooth transitions dan animations
- Progress bar dengan shimmer effect
- Card hover dengan transform effect

### 📱 Responsive Design
- Desktop: Layout 2-3 kolom
- Tablet: Layout 2 kolom
- Mobile: Layout 1 kolom
- Mobile navigation yang user-friendly

### 🎯 UI Components
- **Buttons**: Primary, Secondary, Outline
- **Cards**: Dengan hover effects dan top border
- **Progress Bars**: Animated dengan shimmer
- **Social Links**: Circular dengan hover effect
- **Badges**: Untuk status dan tags
- **Info Box**: Untuk pesan penting

## 🔧 JavaScript Features

### Auto Year Update
Footer otomatis menampilkan tahun saat ini

### Scroll Reveal Animation
Elemen muncul dengan smooth animation saat di-scroll

### Progress Bar Animation
Progress bar di halaman skill ter-animate saat terlihat

### Copy to Clipboard
Tombol copy untuk wallet address dengan feedback visual

### Counter Animation
Angka statistik ter-animate dari 0 ke target value

### Smooth Scroll
Scroll smooth untuk internal links

## 📝 Tips & Best Practices

### Untuk Foto/Gambar
1. Gunakan foto dengan resolusi tinggi (minimal 600x600px)
2. Format yang disarankan: JPG atau PNG
3. Compress gambar untuk loading lebih cepat
4. Gunakan service seperti TinyPNG untuk kompresi

### Untuk SEO
1. Ubah `<title>` di setiap halaman
2. Tambahkan meta description
3. Gunakan alt text untuk gambar
4. Pastikan loading time cepat

### Untuk Performance
1. Minimize file CSS jika sudah final
2. Optimize gambar sebelum upload
3. Gunakan CDN untuk hosting yang lebih baik
4. Enable caching di server

## 🌐 Deployment

### GitHub Pages (Gratis)
1. Upload semua file ke repository GitHub
2. Settings → Pages
3. Source: Deploy from branch → main
4. Website akan live di `username.github.io/repository-name`

### Netlify (Gratis)
1. Drag & drop folder website ke Netlify
2. Atau connect dengan GitHub repository
3. Auto deploy setiap kali ada update

### Vercel (Gratis)
1. Import dari GitHub
2. Auto deploy dan preview
3. Support custom domain

## 🐛 Troubleshooting

### CSS Tidak Muncul?
- Pastikan struktur folder benar (`css/`, `js/`)
- Check path di `<link>` tag
- Clear browser cache (Ctrl + F5)

### JavaScript Tidak Jalan?
- Buka Console (F12) untuk cek error
- Pastikan file `main.js` ada di folder `js/`
- Check path di `<script>` tag

### Layout Berantakan di Mobile?
- Pastikan sudah ada `<meta name="viewport">`
- Test di berbagai device/browser
- Gunakan Chrome DevTools untuk debug

### Gambar Tidak Muncul?
- Check path gambar (relative atau absolute)
- Pastikan file gambar ada dan accessible
- Check typo di nama file

## 📞 Support & Kontribusi

Jika ada pertanyaan atau menemukan bug:
1. Check dokumentasi ini dulu
2. Test di browser berbeda
3. Check Console untuk error messages

## 📄 License

Free to use untuk personal dan commercial projects.

## 🎉 Selamat!

Website portfolio Anda sudah siap! Jangan lupa untuk:
- ✅ Update semua informasi personal
- ✅ Ganti foto profil
- ✅ Update social media links
- ✅ Tambahkan konten yang relevan
- ✅ Test di berbagai device
- ✅ Deploy ke hosting

**Good luck dan happy coding! 🚀**
