// Data HP yang diizinkan pemilik: kalender, kontak, file (dipilih sendiri). Tiap jenis bisa dimatikan di Pengaturan.
import * as Calendar from 'expo-calendar/legacy';
import * as Contacts from 'expo-contacts/legacy';
import { getSetting } from '../data/settings';
import { AiError } from './gemini';
import { dayDateTime } from './time';

export const allowCalendar = () => getSetting('allow_calendar') !== '0';
export const allowContacts = () => getSetting('allow_contacts') !== '0';

export async function calendarEvents(fromMs: number, toMs: number) {
  if (!allowCalendar()) throw new AiError('Akses kalender dimatikan di Pengaturan.');
  const p = await Calendar.requestCalendarPermissionsAsync();
  if (!p.granted) throw new AiError('Izin kalender belum diberikan.');
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!cals.length) return [];
  const evs = await Calendar.getEventsAsync(
    cals.map((c) => c.id),
    new Date(fromMs),
    new Date(toMs),
  );
  return evs
    .map((e) => ({ title: e.title, start: new Date(e.startDate).getTime(), end: new Date(e.endDate).getTime(), allDay: !!e.allDay, location: e.location ?? '' }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 60);
}

export function describeEvents(evs: Awaited<ReturnType<typeof calendarEvents>>) {
  if (!evs.length) return 'Tidak ada acara.';
  return evs.map((e) => `- ${e.allDay ? 'Seharian' : dayDateTime(e.start)} · ${e.title}${e.location ? ` @ ${e.location}` : ''}`).join('\n');
}

export async function searchContacts(name: string) {
  if (!allowContacts()) throw new AiError('Akses kontak dimatikan di Pengaturan.');
  const p = await Contacts.requestPermissionsAsync();
  if (!p.granted) throw new AiError('Izin kontak belum diberikan.');
  const r = await Contacts.getContactsAsync({ name, fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers], pageSize: 10 });
  return r.data.map((c) => ({ name: c.name ?? '', phones: (c.phoneNumbers ?? []).map((n) => n.number ?? '').filter(Boolean) }));
}
