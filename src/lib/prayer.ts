// Waktu shalat dihitung di HP (tanpa internet) dengan pustaka `adhan`.
// Sudut Subuh 20° dan Isya 18° (sama dengan acuan Kemenag RI).
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import * as Location from 'expo-location';
import { getSetting, setSetting } from '../data/settings';
import { cancelMany, CHANNEL_PRAYER, scheduleAt } from './notify';
import { hhmm, todayAtWib } from './time';
import { native } from '../../modules/urwah-native/src';

export type PrayerKey = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';
export type Prayer = { key: PrayerKey | 'terbit'; name: string; at: number };

export function currentPlace() {
  return {
    lat: parseFloat(getSetting('loc_lat')),
    lon: parseFloat(getSetting('loc_lon')),
    name: getSetting('loc_name') || 'Lokasi Anda',
  };
}

export function prayersFor(dayMs: number): Prayer[] {
  const p = currentPlace();
  const params = CalculationMethod.Singapore();
  const t = new PrayerTimes(new Coordinates(p.lat, p.lon), new Date(dayMs), params);
  return [
    { key: 'subuh', name: 'Subuh', at: t.fajr.getTime() },
    { key: 'terbit', name: 'Terbit', at: t.sunrise.getTime() },
    { key: 'dzuhur', name: 'Dzuhur', at: t.dhuhr.getTime() },
    { key: 'ashar', name: 'Ashar', at: t.asr.getTime() },
    { key: 'maghrib', name: 'Maghrib', at: t.maghrib.getTime() },
    { key: 'isya', name: 'Isya', at: t.isha.getTime() },
  ];
}

/** Lima waktu shalat (tanpa Terbit) hari ini. */
export function fivePrayers(now = Date.now()) {
  return prayersFor(now).filter((x) => x.key !== 'terbit');
}

/** Shalat berikutnya (bisa Subuh besok). */
export function nextPrayer(now = Date.now()): Prayer {
  const today = fivePrayers(now).find((x) => x.at > now);
  if (today) return today;
  return fivePrayers(now + 24 * 60 * 60 * 1000)[0];
}

/**
 * Perbarui lokasi dari GPS. Bila gagal (izin ditolak, GPS mati, atau HP tanpa layanan Google),
 * lokasi terakhir tetap dipakai — app tidak berhenti.
 */
export async function refreshLocation(): Promise<'ok' | 'denied' | 'failed'> {
  if (getSetting('loc_auto') !== '1') return 'ok';
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return 'denied';
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 6 * 60 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!pos) return 'failed';
    setSetting('loc_lat', String(pos.coords.latitude));
    setSetting('loc_lon', String(pos.coords.longitude));
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const pl = places[0];
      const name = pl?.city || pl?.subregion || pl?.district || pl?.region;
      if (name) setSetting('loc_name', name);
    } catch {
      setSetting('loc_name', 'Lokasi Anda');
    }
    setSetting('loc_at', String(Date.now()));
    return 'ok';
  } catch {
    return 'failed';
  }
}

// ---------- Pengaturan per waktu shalat ----------
export type PrayerMode = 'off' | 'notif' | 'adzan';
export const MODE_LABEL: Record<PrayerMode, string> = { off: 'Mati', notif: 'Notifikasi', adzan: 'Adzan' };

export function prayerMode(key: PrayerKey): PrayerMode {
  const v = getSetting(`pm_${key}`);
  if (v === 'off' || v === 'notif' || v === 'adzan') return v;
  return getSetting('prayer_notif') === '1' ? 'notif' : 'off';
}
export function setPrayerMode(key: PrayerKey, m: PrayerMode) {
  setSetting(`pm_${key}`, m);
}
export function adzanFile() {
  return getSetting('adzan_uri');
}

/**
 * Pasang pengingat untuk shalat yang belum lewat (hari ini & besok). Dipanggil saat app dibuka & saat pengaturan berubah.
 * - Notifikasi: lewat expo-notifications.
 * - Adzan: layanan native memutar file adzan pilihan pemilik.
 * - Senyap otomatis: HP masuk mode getar/senyap selama N menit sejak waktu shalat.
 * - Pengingat Jumat & saran masjid terdekat.
 */
export async function schedulePrayerReminders() {
  await cancelMany(getSetting('prayer_notif_ids'));
  for (const id of getSetting('prayer_native_ids').split(',').filter(Boolean)) native.cancelPrayer(id);
  const now = Date.now();
  const list = [...fivePrayers(now), ...fivePrayers(now + 24 * 60 * 60 * 1000)].filter((x) => x.at > now);
  const ids: string[] = [];
  const nids: string[] = [];
  const silentMin = getSetting('auto_silent') === '1' ? parseInt(getSetting('silent_min') || '20', 10) : 0;
  const file = adzanFile();
  const place = currentPlace().name;
  for (const p of list) {
    const key = p.key as PrayerKey;
    const mode = prayerMode(key);
    if (mode === 'notif' || (mode === 'adzan' && !file)) {
      const id = await scheduleAt(`Waktu ${p.name}`, `${hhmm(p.at)} · ${place}`, p.at, CHANNEL_PRAYER);
      if (id) ids.push(id);
    }
    const useAdzan = mode === 'adzan' && !!file && native.available;
    if ((useAdzan || (silentMin > 0 && mode !== 'off')) && native.available) {
      const nid = `prayer-${key}-${p.at}`;
      native.schedulePrayer(nid, p.at, `Waktu ${p.name} · ${hhmm(p.at)}`, useAdzan ? file : '', silentMin);
      nids.push(nid);
    }
    // Saran masjid terdekat 10 menit sebelum Dzuhur/Ashar/Maghrib/Isya.
    if (getSetting('mosque_hint') === '1' && mode !== 'off' && key !== 'subuh' && p.at - 10 * 60000 > now) {
      const id = await scheduleAt(`${p.name} 10 menit lagi`, 'Ketuk untuk melihat masjid terdekat', p.at - 10 * 60000, CHANNEL_PRAYER, { url: 'masjid' });
      if (id) ids.push(id);
    }
  }
  // Pengingat Jumat: Kamis 20.00 (Al-Kahfi malam Jumat) & Jumat 11.00 (bersiap ke masjid).
  if (getSetting('jumat') === '1') {
    for (let d = 0; d < 7; d++) {
      const day = now + d * 864e5;
      const dow = new Date(day + 7 * 3600e3).getUTCDay(); // hari dalam WIB
      if (dow === 4) {
        const at = todayAtWib(20, 0, day);
        if (at > now) {
          const id = await scheduleAt('Malam Jumat', 'Waktunya membaca Al-Kahfi dan memperbanyak shalawat.', at, CHANNEL_PRAYER);
          if (id) ids.push(id);
        }
      }
      if (dow === 5) {
        const at = todayAtWib(11, 0, day);
        if (at > now) {
          const id = await scheduleAt('Jumat', 'Mandi, wangi, dan berangkat lebih awal ke masjid.', at, CHANNEL_PRAYER, { url: 'masjid' });
          if (id) ids.push(id);
        }
      }
    }
  }
  setSetting('prayer_notif_ids', ids.join(','));
  setSetting('prayer_native_ids', nids.join(','));
}
