# Rancangan Manager Urwah (disetujui 13 Nov 2026)

## Ringkas
App Android pribadi (Expo) yang meniru alur inti Plaud: rekam → transkrip → ringkasan → tugas → pengingat. Rilis lewat GitHub Releases.

## Keputusan
| Topik | Keputusan |
|---|---|
| Platform | Expo SDK 58 (React Native 0.88), APK di GitHub Releases |
| Pengguna | Hanya pemilik, bisa >1 HP |
| AI | Gemini API (free tier), kunci milik pemilik di `expo-secure-store` |
| Bahasa transkrip | Indonesia, Arab, Inggris; ringkasan selalu Bahasa Indonesia |
| Durasi | rata-rata 120 menit, maks 3 jam; disimpan per potongan 30 menit |
| Pembicara | label otomatis + jumlah pembicara + contoh suara ▶ per pembicara; ganti nama, gabung, pindah kalimat |
| Tugas | AI menemukan → pemilik konfirmasi → dipasang |
| Pengingat | (1) alarm app sendiri, tanggal+jam, layar penuh; (2) notifikasi + Live Update (pulau/Fluid Cloud); (3) kalender HP; (4) opsional cadangan Google |
| Google | Tidak wajib. Kalender lewat kalender HP (tanpa login). Cadangan Drive opsional (izin `drive.file`) |
| Tampilan | rasa ColorOS 17 "Living Flow": kaca tembus pandang, gerak pegas, tombol memantul; terang/gelap ikut HP |

## Fitur v1
Tandai momen + catatan · transkrip + pembicara + contoh suara · kamus istilah · 4 template (Rapat, Kajian, Wawancara, Umum) · Tanya Rekaman (dengan menit sumber, lintas rekaman) · tugas → pengingat 4 lapis · ekspor TXT/Markdown/PDF · ekspor/impor cadangan · cadangan Google opsional · cek versi baru dari GitHub.

v2: foto saat merekam, mind map, asisten suara cepat, template kustom, widget.

## Database (SQLite)
- `recordings`(id, title, template, started_at, duration_sec, status[recording|processing|ready|error], speaker_count, summary_md, created_at, updated_at)
- `chunks`(id, recording_id, idx, file_uri, duration_sec, status[pending|uploaded|transcribed|error], error_msg, created_at, updated_at)
- `segments`(id, recording_id, speaker_id, start_ms, end_ms, text, lang, created_at, updated_at)
- `speakers`(id, recording_id, label, display_name, created_at, updated_at)
- `marks`(id, recording_id, at_ms, note, created_at, updated_at)
- `tasks`(id, recording_id NULL, title, assignee, due_at, status[draft|confirmed|done|dismissed], alarm_id, notif_id, calendar_event_id, created_at, updated_at)
- `glossary`(id, term, note, created_at, updated_at)
- `qa`(id, recording_id NULL, question, answer, sources_json, created_at, updated_at)

## AI (tanpa server)
1. `transcribeChunk` — audio potongan + kamus → kalimat {speaker, start_ms, end_ms, text, lang}
2. `finalizeRecording` — semua transkrip + template → {speaker_map, speaker_count, summary_md, tasks[]}
3. `askRecordings` — pertanyaan + transkrip → {answer, sources[{recording_id, start_ms}]}

## Modul native (buatan sendiri, Expo Modules API)
- `alarm` — pasang/batal/daftar alarm `setAlarmClock`, aktif lagi setelah restart, layar penuh.
- `live-update` — notifikasi berjalan (rekam/proses/tugas), ProgressStyle di Android 16+.

## Layar
Sambutan · Beranda · Rekam · Proses · Detail (Ringkasan/Transkrip/Pembicara/Tugas/Tanya) · Konfirmasi tugas · Semua tugas · Alarm penuh · Pengaturan. Setiap layar: kosong, memuat, gagal, berhasil.

## Tahapan (target yang bisa dicek)
1. Kerangka + APK otomatis → APK terpasang di HP.
2. Rekam → 3 jam tanpa putus, layar mati aman, pulau notifikasi tampil.
3. AI → transkrip, pembicara, ringkasan dari rekaman uji.
4. Pembicara → ▶ contoh suara, ganti nama/gabung.
5. Pengingat → alarm berbunyi tepat tanggal+jam, kalender terisi.
6. Tanya Rekaman, kamus, template, ekspor.
7. Cadangan Google opsional + ekspor/impor.
8. Uji menyeluruh → rilis v1.0.

## Risiko yang diketahui
- Label pembicara antar-potongan bisa tertukar → langkah finalisasi + edit manual.
- Penanda waktu AI bisa meleset beberapa detik → putar mulai 2 detik lebih awal.
- Tampil di Fluid Cloud ditentukan ColorOS; cadangannya notifikasi biasa + pulau di dalam app.
- ColorOS agresif menghemat baterai → panduan izin "Alarm & pengingat" dan aktivitas latar belakang.
- Free tier Gemini: data boleh dipakai Google; kuota hanya terlihat di AI Studio.
