// Pengaturan sederhana (kunci → nilai) di SQLite. Rahasia (kunci Gemini) TIDAK di sini, tapi di SecureStore.
import { db } from './db';

const DEFAULTS: Record<string, string> = {
  name: 'Urwah',
  haptic: '1',
  reduce_motion: '0',
  home_prayer: '1',
  home_next: '1',
  home_todo: '1',
  home_alarm: '1',
  prayer_notif: '1',
  // Lokasi terakhir (default: Jakarta) dipakai bila GPS belum tersedia.
  loc_lat: '-6.2088',
  loc_lon: '106.8456',
  loc_name: 'Jakarta',
  loc_auto: '1',
};

const cache = new Map<string, string>();

export function getSetting(key: string): string {
  if (cache.has(key)) return cache.get(key) as string;
  let value = DEFAULTS[key] ?? '';
  try {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    if (row) value = row.value;
  } catch {
    // Tabel belum siap: pakai bawaan.
  }
  cache.set(key, value);
  return value;
}

export function setSetting(key: string, value: string) {
  cache.set(key, value);
  db.runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export function getFlag(key: string) {
  return getSetting(key) === '1';
}

export function setFlag(key: string, on: boolean) {
  setSetting(key, on ? '1' : '0');
}

export function resetSettings() {
  db.runSync("DELETE FROM settings WHERE key NOT LIKE 'loc_%'");
  cache.clear();
}
