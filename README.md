# Manager Urwah

App Android pribadi: rekam rapat/kajian → transkrip (Indonesia/Arab/Inggris) → ringkasan, jumlah pembicara, tugas → pengingat (alarm, notifikasi, kalender).

Status: **versi 0.3.** Rencana lengkap ada di `docs/rancangan.md`.

### Yang sudah berfungsi di v0.3
- **Beranda**: salam, lintasan waktu shalat, pengingat berikutnya, kartu semua fitur, tugas, alarm, kolom asisten.
- **Rekam** → **Detail rekaman**: proses AI (Gemini) menjadi transkrip Indonesia/Arab/Inggris, jumlah & nama pembicara (dengar contoh suara, ganti nama, gabung), ringkasan, tugas temuan AI (dipasang setelah disetujui), dan tanya isi rekaman.
- **Asisten AI**: tanya apa saja, lampirkan PDF/Markdown/gambar, pesan suara; "ingatkan saya…" jadi kartu yang disetujui dulu.
- **Catatan** + analisa AI · **Chat WhatsApp** dengan template {nama}/{tanggal}/{waktu}, kirim sekarang/terjadwal · **Pindai dokumen** (salin teks, PDF, bagikan) · **Arah kiblat** & masjid terdekat.
- **Alarm layar penuh** (berbunyi tepat waktu, tampil di layar kunci, geser untuk mematikan, tunda 5/10/15 menit, tetap ada setelah HP restart).
- **Widget layar utama**, salinan ke **kalender HP** (opsional), sapaan asisten harian, kamus istilah.

### Belum (ditandai jelas di app, versi 0.4)
Adzan penuh & mode senyap otomatis · Live Update di bilah status · cadangan Google Drive.

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
- Untuk versi baru: naikkan angka `version` di `app.json` (misalnya `0.3.0`). Robot otomatis membuat rilis `v0.3.0` di halaman **Releases**.

## Istilah singkat

- **Expo / React Native:** alat untuk membuat app HP dengan JavaScript.
- **APK:** file pemasang app Android.
- **GitHub Actions:** robot yang menjalankan perintah otomatis (di sini: membuat APK).
- **Tag:** penanda versi di riwayat kode.

## Catatan

- Saat ini APK ditandatangani dengan kunci bawaan (debug). Sebelum v1.0, kita ganti ke kunci pribadi yang disimpan di *GitHub Secrets*, supaya update aman.
- Kunci Gemini tidak pernah disimpan di repo ini. Anda mengetiknya sendiri di app.
