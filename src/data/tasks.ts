// Tugas / to-do. Tabel `tasks` (lihat rancangan). Status: confirmed (aktif) | done.
import { db, newId } from './db';
import { cancel, scheduleAt } from '../lib/notify';
import { hhmm } from '../lib/time';
import { addCalendarEvent, removeCalendarEvent } from '../lib/calendar';
import { native } from '../../modules/urwah-native/src';
import { getSetting } from './settings';

// Live Update hitung mundur muncul 30 menit sebelum tugas berjam.
function liveFor(id: string, title: string, dueAt: number | null) {
  if (dueAt && dueAt > Date.now() && getSetting('live_updates') !== '0') native.scheduleLive(id, dueAt, title, 30);
}

export type Task = {
  id: string;
  title: string;
  due_at: number | null;
  status: 'draft' | 'confirmed' | 'done' | 'dismissed';
  notif_id: string | null;
  calendar_event_id?: string | null;
  recording_id?: string | null;
  assignee?: string | null;
};

export function listTasks(): Task[] {
  return db.getAllSync<Task>(
    "SELECT id, title, due_at, status, notif_id, calendar_event_id, recording_id, assignee FROM tasks WHERE status IN ('confirmed','done') ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at, created_at",
  );
}

export async function addTask(title: string, dueAt: number | null, recordingId: string | null = null, assignee: string | null = null) {
  const id = newId('t');
  const now = Date.now();
  const notifId = dueAt ? await scheduleAt('Pengingat tugas', `${title} · ${hhmm(dueAt)}`, dueAt) : null;
  const calId = dueAt && dueAt > now ? await addCalendarEvent(title, dueAt) : null;
  db.runSync(
    "INSERT INTO tasks (id, recording_id, title, assignee, due_at, status, notif_id, calendar_event_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)",
    [id, recordingId, title, assignee, dueAt, notifId, calId, now, now],
  );
  liveFor(id, title, dueAt);
  return id;
}

/** Tugas temuan AI (draft) disetujui pemilik → dipasang jadi pengingat. */
export async function confirmDraft(draftId: string, title: string, dueAt: number | null) {
  const now = Date.now();
  const notifId = dueAt ? await scheduleAt('Pengingat tugas', `${title} · ${hhmm(dueAt)}`, dueAt) : null;
  const calId = dueAt && dueAt > now ? await addCalendarEvent(title, dueAt) : null;
  db.runSync("UPDATE tasks SET title = ?, due_at = ?, status = 'confirmed', notif_id = ?, calendar_event_id = ?, updated_at = ? WHERE id = ?", [
    title,
    dueAt,
    notifId,
    calId,
    now,
    draftId,
  ]);
  liveFor(draftId, title, dueAt);
}

export function dismissDraft(draftId: string) {
  db.runSync("UPDATE tasks SET status = 'dismissed', updated_at = ? WHERE id = ?", [Date.now(), draftId]);
}

export async function toggleTask(t: Task) {
  const now = Date.now();
  if (t.status === 'done') {
    const notifId = t.due_at ? await scheduleAt('Pengingat tugas', `${t.title} · ${hhmm(t.due_at)}`, t.due_at) : null;
    db.runSync("UPDATE tasks SET status = 'confirmed', notif_id = ?, updated_at = ? WHERE id = ?", [notifId, now, t.id]);
    liveFor(t.id, t.title, t.due_at);
  } else {
    native.cancelLive(t.id);
    await cancel(t.notif_id);
    db.runSync("UPDATE tasks SET status = 'done', notif_id = NULL, updated_at = ? WHERE id = ?", [now, t.id]);
  }
}

export async function deleteTask(t: Task) {
  native.cancelLive(t.id);
  await cancel(t.notif_id);
  await removeCalendarEvent(t.calendar_event_id);
  db.runSync('DELETE FROM tasks WHERE id = ?', [t.id]);
}

/** Tugas temuan AI yang belum dikonfirmasi (untuk saran di Beranda). */
export function pendingDrafts(): { count: number; recordingId: string | null } {
  const r = db.getFirstSync<{ n: number; rid: string | null }>(
    "SELECT COUNT(*) AS n, MAX(recording_id) AS rid FROM tasks WHERE status = 'draft'",
  );
  return { count: r?.n ?? 0, recordingId: r?.rid ?? null };
}
