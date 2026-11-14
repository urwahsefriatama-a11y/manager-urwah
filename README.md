# Manager Urwah

App Android pribadi: rekam rapat/kajian → transkrip (Indonesia/Arab/Inggris) → ringkasan, jumlah pembicara, tugas → pengingat (alarm, notifikasi, kalender).

Status: **versi 0.4 — semua fitur rancangan sudah aktif.** Rencana lengkap ada di `docs/rancangan.md`.

### Yang berfungsi
- **Beranda**: salam, lintasan matahari & shalat berikutnya, pengingat berikutnya, kartu semua fitur, saran asisten, tugas, alarm, kolom tanya asisten.
- **Pulau notifikasi** (dynamic island) di dalam app + **Live Update** di bilah status/Now Bar saat app ditutup: pengingat (30 menit sebelum), rekaman berjalan, proses AI.
- **Rekam** (bisa dikecilkan ke pulau) → **Detail**: transkrip (Gemini), pembicara, ringkasan & tugas (Claude), dokumen pendukung, tanya isi rekaman, bagikan audio.
- **Asisten (Claude)**: membaca tugas, alarm, catatan, rekaman, kalender, kontak, dan Google Drive; lampiran PDF/Markdown/gambar; mode bicara dengan jawaban bersuara; panggilan **"Halo asisten"** saat app terbuka; bisa dibuka dari tombol samping HP (sebagai aplikasi asisten digital). Semua perubahan lewat kartu yang disetujui.
- **Shalat**: pengingat per waktu (Mati/Notifikasi/Adzan dari file pilihan sendiri), senyap otomatis, pengingat Jumat, saran masjid, kiblat.
- **Catatan**, **Chat WhatsApp terjadwal**, **Pindai dokumen**, **Alarm layar penuh**, **Widget**, **kalender HP**, **cadangan & pulihkan** (Google Drive atau file).

### Butuh langkah dari pemilik
- Kunci **Claude** (berbayar sesuai pemakaian) dan kunci **Gemini** (gratis, untuk transkrip audio).
- **Google Drive**: daftar sekali di Google Cloud (panduan di Pengaturan → Google Drive & cadangan; SHA-1 tertulis di setiap rilis GitHub).

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
- Untuk versi baru: naikkan angka `version` di `app.json` (misalnya `0.4.0`). Robot otomatis membuat rilis `v0.4.0` di halaman **Releases**.

## Istilah singkat

- **Expo / React Native:** alat untuk membuat app HP dengan JavaScript.
- **APK:** file pemasang app Android.
- **GitHub Actions:** robot yang menjalankan perintah otomatis (di sini: membuat APK).
- **Tag:** penanda versi di riwayat kode.

## Catatan

- Saat ini APK ditandatangani dengan kunci bawaan (debug). Sebelum v1.0, kita ganti ke kunci pribadi yang disimpan di *GitHub Secrets*, supaya update aman.
- Kunci Gemini tidak pernah disimpan di repo ini. Anda mengetiknya sendiri di app.
