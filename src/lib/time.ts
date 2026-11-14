// Semua waktu disimpan UTC (milidetik) dan ditampilkan sebagai WIB (UTC+7),
// tanpa bergantung pada zona waktu HP.
const WIB = 7 * 60 * 60 * 1000;

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const pad = (n: number) => String(n).padStart(2, '0');

function wib(ms: number) {
  return new Date(ms + WIB);
}

/** "09:41" */
export function hhmm(ms: number) {
  const d = wib(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Jam desimal WIB, mis. 9.68 untuk 09:41. */
export function hourOfDay(ms: number) {
  const d = wib(ms);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

/** "Jumat, 13 November" */
export function longDate(ms: number) {
  const d = wib(ms);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "13 Nov · 09:41" */
export function shortDateTime(ms: number) {
  const d = wib(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} · ${hhmm(ms)}`;
}

/** Waktu UTC (ms) untuk jam:menit WIB hari ini. */
export function todayAtWib(hour: number, minute: number, now = Date.now()) {
  const d = wib(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute) - WIB;
}

/** Kejadian berikutnya untuk jam:menit WIB (hari ini bila belum lewat, kalau tidak besok). */
export function nextAtWib(hour: number, minute: number, now = Date.now()) {
  const t = todayAtWib(hour, minute, now);
  return t > now ? t : t + 24 * 60 * 60 * 1000;
}

/** "dalam 1 jam 58 menit" */
export function untilText(targetMs: number, now = Date.now()) {
  let m = Math.max(0, Math.round((targetMs - now) / 60000));
  if (m === 0) return 'sekarang';
  if (m < 60) return `dalam ${m} menit`;
  const h = Math.floor(m / 60);
  m = m % 60;
  return m === 0 ? `dalam ${h} jam` : `dalam ${h} jam ${m} menit`;
}

/** "Selamat pagi" dst. */
export function greetingWord(ms = Date.now()) {
  const h = hourOfDay(ms);
  if (h >= 3 && h < 10) return 'Selamat pagi';
  if (h >= 10 && h < 15) return 'Selamat siang';
  if (h >= 15 && h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** "1:02:05" atau "02:05" */
export function duration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
}

export { pad };

/** "2026-11-14T09:35:00+07:00" */
export function isoWib(ms = Date.now()) {
  const d = wib(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+07:00`;
}

/** "Sen, 16 Nov 09:00" */
export function dayDateTime(ms: number) {
  const d = wib(ms);
  return `${DAYS[d.getUTCDay()].slice(0, 3)}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${hhmm(ms)}`;
}
