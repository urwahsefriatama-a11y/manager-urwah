// Alarm buatan pemilik. Versi ini: berbunyi lewat notifikasi pengingat (bunyi + getar).
// Alarm layar penuh (modul native setAlarmClock) menyusul di tahap Pengingat.
import { db, newId } from './db';
import { cancel, pendingIds, scheduleAt, scheduleDaily } from '../lib/notify';
import { nextAtWib, pad } from '../lib/time';

export type Alarm = {
  id: string;
  hour: number;
  minute: number;
  label: string;
  repeat: 'once' | 'daily';
  enabled: number;
  notif_id: string | null;
};

export function listAlarms(): Alarm[] {
  return db.getAllSync<Alarm>('SELECT id, hour, minute, label, repeat, enabled, notif_id FROM alarms ORDER BY hour, minute');
}

async function schedule(a: Pick<Alarm, 'hour' | 'minute' | 'label' | 'repeat'>) {
  const title = `Alarm ${pad(a.hour)}:${pad(a.minute)}`;
  return a.repeat === 'daily'
    ? scheduleDaily(title, a.label, a.hour, a.minute)
    : scheduleAt(title, a.label, nextAtWib(a.hour, a.minute));
}

export async function addAlarm(hour: number, minute: number, label: string, repeat: 'once' | 'daily') {
  const id = newId('a');
  const now = Date.now();
  const notifId = await schedule({ hour, minute, label, repeat });
  db.runSync(
    'INSERT INTO alarms (id, hour, minute, label, repeat, enabled, notif_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
    [id, hour, minute, label, repeat, notifId, now, now],
  );
}

export async function setAlarmEnabled(a: Alarm, on: boolean) {
  await cancel(a.notif_id);
  const notifId = on ? await schedule(a) : null;
  db.runSync('UPDATE alarms SET enabled = ?, notif_id = ?, updated_at = ? WHERE id = ?', [on ? 1 : 0, notifId, Date.now(), a.id]);
}

export async function deleteAlarm(a: Alarm) {
  await cancel(a.notif_id);
  db.runSync('DELETE FROM alarms WHERE id = ?', [a.id]);
}

/** Alarm "sekali" yang sudah berbunyi otomatis tampil mati saat app dibuka lagi. */
export async function syncOnceAlarms() {
  const pending = await pendingIds();
  if (!pending) return;
  for (const a of listAlarms()) {
    if (a.repeat === 'once' && a.enabled && a.notif_id && !pending.has(a.notif_id)) {
      db.runSync('UPDATE alarms SET enabled = 0, notif_id = NULL, updated_at = ? WHERE id = ?', [Date.now(), a.id]);
    }
  }
}
