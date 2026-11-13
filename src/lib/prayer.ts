// Waktu shalat dihitung di HP (tanpa internet) dengan pustaka `adhan`.
// Sudut Subuh 20° dan Isya 18° (sama dengan acuan Kemenag RI).
import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import * as Location from 'expo-location';
import { getSetting, setSetting } from '../data/settings';
import { cancelMany, CHANNEL_PRAYER, scheduleAt } from './notify';
import { hhmm } from './time';

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

/** Pasang pengingat untuk shalat yang belum lewat (hari ini & besok). Dipanggil saat app dibuka. */
export async function schedulePrayerReminders() {
  await cancelMany(getSetting('prayer_notif_ids'));
  if (getSetting('prayer_notif') !== '1') {
    setSetting('prayer_notif_ids', '');
    return;
  }
  const now = Date.now();
  const list = [...fivePrayers(now), ...fivePrayers(now + 24 * 60 * 60 * 1000)].filter((x) => x.at > now);
  const ids: string[] = [];
  for (const p of list) {
    const id = await scheduleAt(`Waktu ${p.name}`, `${hhmm(p.at)} · ${currentPlace().name}`, p.at, CHANNEL_PRAYER);
    if (id) ids.push(id);
  }
  setSetting('prayer_notif_ids', ids.join(','));
}
