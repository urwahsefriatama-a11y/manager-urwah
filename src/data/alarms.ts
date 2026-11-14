// Alarm buatan pemilik. Lapis 1: alarm native layar penuh (setAlarmClock) — berbunyi walau app ditutup,
// aktif lagi setelah HP dinyalakan ulang. Bila modul native tidak tersedia, jatuh ke notifikasi biasa.
import { db, newId } from './db';
import { cancel, pendingIds, scheduleAt, scheduleDaily } from '../lib/notify';
import { nextAtWib, pad } from '../lib/time';
import { native } from '../../modules/urwah-native/src';
import { getSetting } from './settings';

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

/** Pasang alarm. Hasil disimpan di notif_id: "native:<waktu ms>" atau id notifikasi. */
async function schedule(a: Pick<Alarm, 'id' | 'hour' | 'minute' | 'label' | 'repeat'>): Promise<string | null> {
  const title = `Alarm ${pad(a.hour)}:${pad(a.minute)}`;
  const at = nextAtWib(a.hour, a.minute);
  if (native.available) {
    native.scheduleAlarm(a.id, at, title, a.label, a.repeat === 'daily');
    if (getSetting('live_updates') !== '0') native.scheduleLive(a.id, at, a.label || title, 30);
    return `native:${at}`;
  }
  return a.repeat === 'daily' ? scheduleDaily(title, a.label, a.hour, a.minute) : scheduleAt(title, a.label, at);
}

async function unschedule(a: Pick<Alarm, 'id' | 'notif_id'>) {
  if (a.notif_id?.startsWith('native:')) {
    native.cancelAlarm(a.id);
    native.cancelAlarm(`${a.id}#snooze`);
    native.cancelLive(a.id);
  } else await cancel(a.notif_id);
}

export async function addAlarm(hour: number, minute: number, label: string, repeat: 'once' | 'daily') {
  const id = newId('a');
  const now = Date.now();
  const notifId = await schedule({ id, hour, minute, label, repeat });
  db.runSync(
    'INSERT INTO alarms (id, hour, minute, label, repeat, enabled, notif_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
    [id, hour, minute, label, repeat, notifId, now, now],
  );
}

export async function setAlarmEnabled(a: Alarm, on: boolean) {
  await unschedule(a);
  const notifId = on ? await schedule(a) : null;
  db.runSync('UPDATE alarms SET enabled = ?, notif_id = ?, updated_at = ? WHERE id = ?', [on ? 1 : 0, notifId, Date.now(), a.id]);
}

export async function deleteAlarm(a: Alarm) {
  await unschedule(a);
  db.runSync('DELETE FROM alarms WHERE id = ?', [a.id]);
}

/** Alarm "sekali" yang sudah lewat otomatis tampil mati saat app dibuka lagi. */
export async function syncOnceAlarms() {
  const pending = await pendingIds();
  const now = Date.now();
  for (const a of listAlarms()) {
    if (a.repeat !== 'once' || !a.enabled || !a.notif_id) continue;
    const passed = a.notif_id.startsWith('native:') ? Number(a.notif_id.slice(7)) < now : pending ? !pending.has(a.notif_id) : false;
    if (passed) db.runSync('UPDATE alarms SET enabled = 0, notif_id = NULL, updated_at = ? WHERE id = ?', [now, a.id]);
  }
}

/** Saat alarm sekali dimatikan dari layar alarm. */
export function markFired(alarmId: string) {
  const a = db.getFirstSync<Alarm>('SELECT id, hour, minute, label, repeat, enabled, notif_id FROM alarms WHERE id = ?', [alarmId.replace('#snooze', '')]);
  if (a && a.repeat === 'once') db.runSync('UPDATE alarms SET enabled = 0, notif_id = NULL, updated_at = ? WHERE id = ?', [Date.now(), a.id]);
}
