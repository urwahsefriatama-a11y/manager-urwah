# CLAUDE.md — Manager Urwah

Panduan untuk siapa pun (termasuk Claude) yang mengerjakan proyek ini.

## 4 Prinsip Kerja

1. **Pikir dulu, tanya kalau ragu.** Jangan menebak maksud pemilik. Kalau ada dua cara yang masuk akal, tanyakan dulu.
2. **Sesederhana mungkin.** Pilih solusi paling sederhana yang berhasil. Tidak ada fitur, library, atau lapisan tambahan "untuk jaga-jaga".
3. **Ubah seperlunya.** Sentuh hanya file yang memang perlu diubah. Jangan merapikan atau mengganti nama hal lain yang tidak diminta.
4. **Target yang bisa dicek.** Setiap tahap punya hasil yang bisa dibuktikan (contoh: "APK terpasang", "alarm berbunyi tepat waktu").

## Tentang Proyek

- App Android pribadi milik Urwah: rekam rapat/kajian → transkrip (Indonesia/Arab/Inggris) → ringkasan, jumlah pembicara, tugas → pengingat.
- Pengguna: hanya pemilik. Tanpa server. Tanpa login, kecuali cadangan Google Drive yang **opsional**.
- Rancangan lengkap: `docs/rancangan.md`. Baca dulu sebelum mengubah apa pun.

## Aturan Khusus Proyek

- **Stack:** Expo SDK 58 + TypeScript + Expo Router. Rilis APK lewat GitHub Releases, tidak lewat Play Store.
- **Rahasia:** kunci Gemini diketik pemilik di app dan disimpan di `expo-secure-store`. Jangan pernah menaruh kunci/secret di kode, repo, atau log.
- **Data:** SQLite di HP. Waktu disimpan UTC (milidetik), ditampilkan WIB.
- **Nama tabel, kolom, dan fungsi publik** di `docs/rancangan.md` tidak boleh diganti tanpa persetujuan pemilik.
- **Clean-room:** fitur terinspirasi Plaud dan tampilan terinspirasi ColorOS 17, tapi tidak ada aset, logo, ikon, font, atau teks yang disalin dari keduanya. Pakai ikon/font open-source.
- **Pengingat 4 lapis:** alarm app sendiri (tanggal+jam), notifikasi/Live Update, kalender HP, (opsional) Google. Tugas hasil AI selalu dikonfirmasi pemilik sebelum dipasang.
- **Tidak ada fungsi palsu.** Fitur yang belum dibuat ditandai jelas di UI ("hadir di versi x"), tidak pura-pura berjalan.
- **Jangan mengarang library/API.** Verifikasi di dokumentasi resmi dulu.
- **Hemat langkah:** pemilik sendiri yang menilai tampilan (tidak perlu screenshot). Perubahan kecil (teks, warna, ikon) cukup satu tes ringan.
- **Bahasa:** UI, komentar penting, dan dokumen dalam Bahasa Indonesia sederhana.
