# Manager Urwah

App Android pribadi: rekam rapat/kajian → transkrip (Indonesia/Arab/Inggris) → ringkasan, jumlah pembicara, tugas → pengingat (alarm, notifikasi, kalender).

Status: **versi 0.1 — kerangka.** Perekam hadir di versi 0.2. Rencana lengkap ada di `docs/rancangan.md`.

## Cara memasang di HP

1. Buka halaman **Releases** repo ini di HP.
2. Unduh file `manager-urwah-vX.Y.Z.apk`.
3. Ketuk file itu. Kalau muncul peringatan, izinkan **"Install dari sumber tidak dikenal"** untuk browser/Files.
4. Selesai. Untuk update, ulangi langkah 1–3. Data lama tetap aman.

## Cara membuat versi baru (rilis)

APK dibuat otomatis oleh **GitHub Actions** (robot gratis milik GitHub):

- Setiap ada perubahan di cabang `main`, robot membuat APK uji. Unduh di tab **Actions** → pilih proses terbaru → bagian **Artifacts**.
- Untuk versi baru: naikkan angka `version` di `app.json` (misalnya `0.2.0`). Robot otomatis membuat rilis `v0.2.0` di halaman **Releases**.

## Istilah singkat

- **Expo / React Native:** alat untuk membuat app HP dengan JavaScript.
- **APK:** file pemasang app Android.
- **GitHub Actions:** robot yang menjalankan perintah otomatis (di sini: membuat APK).
- **Tag:** penanda versi di riwayat kode.

## Catatan

- Saat ini APK ditandatangani dengan kunci bawaan (debug). Sebelum v1.0, kita ganti ke kunci pribadi yang disimpan di *GitHub Secrets*, supaya update aman.
- Kunci Gemini tidak pernah disimpan di repo ini. Anda mengetiknya sendiri di app.
