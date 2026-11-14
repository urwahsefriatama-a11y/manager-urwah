// Lapis 3 pengingat: acara di kalender HP (Google Calendar/Samsung Calendar ikut sinkron bila akun terhubung).
import * as Calendar from 'expo-calendar/legacy';
import { getSetting } from '../data/settings';

async function writableCalendarId(): Promise<string | null> {
  const perm = await Calendar.requestCalendarPermissionsAsync();
  if (!perm.granted) return null;
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ok = cals.filter((c) => c.allowsModifications);
  const pick = ok.find((c) => c.isPrimary) ?? ok[0];
  return pick ? pick.id : null;
}

/** Buat acara 15 menit dengan pengingat tepat waktu. Hasil: id acara atau null. */
export async function addCalendarEvent(title: string, atMs: number): Promise<string | null> {
  if (getSetting('cal_sync') !== '1') return null;
  try {
    const calId = await writableCalendarId();
    if (!calId) return null;
    return await Calendar.createEventAsync(calId, {
      title,
      startDate: new Date(atMs),
      endDate: new Date(atMs + 15 * 60 * 1000),
      timeZone: 'Asia/Jakarta',
      alarms: [{ relativeOffset: 0 }],
      notes: 'Dibuat oleh Manager Urwah',
    });
  } catch {
    return null;
  }
}

export async function removeCalendarEvent(id: string | null | undefined) {
  if (!id) return;
  try {
    await Calendar.deleteEventAsync(id);
  } catch {
    // Sudah dihapus dari kalender: abaikan.
  }
}

/** Buat acara atas permintaan pemilik (disetujui di kartu asisten), tanpa melihat pengaturan sinkron. */
export async function createCalendarEvent(title: string, atMs: number, minutes = 60): Promise<string | null> {
  const calId = await writableCalendarId();
  if (!calId) return null;
  return Calendar.createEventAsync(calId, {
    title,
    startDate: new Date(atMs),
    endDate: new Date(atMs + minutes * 60 * 1000),
    timeZone: 'Asia/Jakarta',
    alarms: [{ relativeOffset: -10 }],
    notes: 'Dibuat oleh Manager Urwah',
  });
}
