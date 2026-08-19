# 📦 Sistem Pencatatan Aset

Aplikasi web pencatatan aset yang dibangun dengan HTML, CSS, dan JavaScript murni.

## 🚀 Deploy ke GitHub Pages

### Cara Cepat (1 Menit):

1. **Buat Repository Baru di GitHub:**
   - Login ke [github.com](https://github.com)
   - Klik **+** → **New repository**
   - Nama: `aset-manager` (atau bebas)
   - Pilih **Public**
   - Klik **Create repository**

2. **Upload Semua File:**
   ```bash
   # Clone repo kamu
   git clone https://github.com/YOUR-USERNAME/aset-manager.git
   cd aset-manager
   
   # Copy file index.html, style.css, app.js ke folder ini
   # Lalu push
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Aktifkan GitHub Pages:**
   - Buka repo kamu di GitHub
   - Klik tab **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / **(root)**
   - Klik **Save**

4. **Selesai! 🎉**
   - Website langsung online di:
   ```
   https://YOUR-USERNAME.github.io/aset-manager/
   ```

---

## 📁 Struktur File

```
├── index.html    # Halaman utama
├── style.css     # Styling
├── app.js        # Logic aplikasi
└── README.md     # Dokumentasi ini
```

---

## ✨ Fitur

- ✅ Dashboard statistik aset
- ✅ Tambah/Edit/Hapus aset
- ✅ Search & Filter
- ✅ Export ke CSV
- ✅ Responsive (HP & Desktop)
- ✅ Data tersimpan di localStorage
- ✅ Deploy GRATIS ke GitHub Pages

---

## 🛠️ Teknologi

- HTML5
- CSS3 (Modern, Responsive)
- JavaScript (Vanilla JS)
- Chart.js (untuk grafik)
- Font Awesome (untuk ikon)

---

## 💡 Tips

### Simpan Data Online (Opsional)
Data tersimpan di browser lokal. Kalau mau data online:
- Buka browser yang sama
- Data otomatis tersimpan selama belum clear cache
- Bisa pakai extension seperti "LocalStorage Manager" untuk backup

### Backup Data
1. Buka browser DevTools (F12)
2. Tab Application → Local Storage
3. Copy semua data di `assets`
4. Simpan ke file .json

---

Made with ❤️ for asset management
