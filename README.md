# Manager Urwah

App Android pribadi: rekam rapat/kajian → transkrip (Indonesia/Arab/Inggris) → ringkasan, jumlah pembicara, tugas → pengingat (alarm, notifikasi, kalender).

Status: **versi 0.2.** Rencana lengkap ada di `docs/rancangan.md`.

### Yang sudah berfungsi di v0.2
- **Beranda** bergaya baru: salam, lintasan matahari & waktu shalat, pengingat berikutnya, kartu fitur, tugas, alarm.
- **Rekam**: siap → hitung mundur 3-2-1 → merekam (tetap jalan saat layar mati), tandai momen, jeda, disimpan per 30 menit.
- **Rekaman**: daftar rekaman, putar ulang per potongan, hapus.
- **Tugas & alarm**: tambah, centang, hapus; pengingat lewat notifikasi berbunyi.
- **Shalat**: jadwal dari lokasi HP (dihitung di HP, tanpa internet), pengingat tiap waktu shalat.
- **Pengaturan** berkategori, kunci Gemini disimpan terenkripsi.

### Belum (ditandai jelas di app)
Transkrip & ringkasan AI, Asisten (v0.3) · Chat WA, Pindai, Catatan (v0.4) · alarm layar penuh, widget, cadangan Google.

### HP yang diuji/ditargetkan
- **Samsung Galaxy S25 Ultra (Android 15/16):** didukung. Agar rekaman panjang & pengingat tidak dihentikan sistem: Pengaturan → Baterai → Batas penggunaan latar belakang → *Aplikasi tidak pernah tidur* → tambah Manager Urwah.
- **Huawei MatePad Mini (HarmonyOS 5/6):** belum bisa. HarmonyOS 5 ke atas tidak menjalankan APK Android.

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
