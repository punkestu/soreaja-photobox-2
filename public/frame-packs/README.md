# Panduan Menambahkan Paket Bingkai Baru (Frame Pack)

SoreAja Photobox mendukung sistem modular **Frame Pack** (Packet). Anda dapat menambahkan paket bingkai baru semudah menambahkan folder baru di direktori ini!

---

## 📁 Struktur Folder

Setiap folder di dalam `public/frame-packs/` merupakan satu paket bingkai mandiri:

```
public/frame-packs/
├── packs.json                         <-- Manifest daftar seluruh paket (dihasilkan otomatis oleh Vite)
├── default/                           <-- Paket bawaan (SoreAja Classic Pack)
│   └── pack.json
├── pasar-sejati/                      <-- Paket event khusus
│   └── pack.json
└── [nama-paket-baru]/                 <-- FOLDER BARU ANDA
    ├── pack.json                      <-- File konfigurasi wajib
    └── frames/                        <-- Gambar PNG transparan & preview (opsional subfolder)
        ├── frame_1.png
        └── frame_1_preview.png
```

---

## 📄 Format `pack.json`

Buat file bernama `pack.json` di dalam folder paket baru Anda:

```json
{
  "id": "wedding-intimate-2026",
  "name": "Wedding Intimate Collection",
  "description": "Koleksi bingkai bertema floral & earthy tones untuk resepsi pernikahan",
  "author": "SoreAja Studio",
  "version": "1.0.0",
  "coverImg": "/frame-packs/wedding-intimate-2026/frames/frame_1_preview.png",
  "frames": [
    {
      "id": "floral-strip-3",
      "name": "Eucalyptus Strip (3-Cut)",
      "subtitle": "3-Cut Vertical Ivory White",
      "theme": "light",
      "canvasWidth": 602,
      "canvasHeight": 1794,
      "previewImg": "/frame-packs/wedding-intimate-2026/frames/frame_1_preview.png",
      "frameImg": "/frame-packs/wedding-intimate-2026/frames/frame_1.png",
      "photoCount": 3,
      "positions": [
        { "x": 76, "y": 140, "width": 450, "height": 340 },
        { "x": 76, "y": 510, "width": 450, "height": 340 },
        { "x": 76, "y": 880, "width": 450, "height": 340 }
      ]
    }
  ]
}
```

> **Tips Path Gambar**:
> - Anda bisa menggunakan path absolut seperti `/frame-packs/nama-paket/frames/frame_1.png`
> - Atau path relatif: jika Anda mengisi `previewImg: "frames/frame_1_preview.png"`, sistem akan otomatis melengkapinya menjadi `/frame-packs/nama-paket/frames/frame_1_preview.png`.

---

## 🚀 Cara Mengaktifkan dari Halaman Admin

1. Letakkan folder baru Anda di `public/frame-packs/[nama-paket]/`.
2. Buka menu **Admin Settings** (`/admin/settings`) atau **Katalog Bingkai** (`/admin/frames`).
3. Klik tombol **"Pindai Ulang Folder"** (Rescan Folders).
4. Paket baru Anda akan langsung muncul di daftar!
5. Klik **"Aktifkan Paket Ini"** untuk langsung menerapkannya ke layar Kiosk Photobox.
6. Klik **"Unduh & Simpan Semua Pack untuk Offline"** agar semua aset langsung tersimpan di cache browser perangkat, siap dipakai tanpa internet.

