// Rekaman & potongannya (tabel recordings, chunks, marks).
import { File } from 'expo-file-system';
import { db, newId } from './db';

export type Recording = {
  id: string;
  title: string;
  template: string;
  started_at: number;
  duration_sec: number;
  status: string;
  chunk_count: number;
  mark_count: number;
};

export type Chunk = { id: string; idx: number; file_uri: string; duration_sec: number };

export function createRecording(title: string, template: string) {
  const id = newId('r');
  const now = Date.now();
  db.runSync(
    "INSERT INTO recordings (id, title, template, started_at, duration_sec, status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 'recording', ?, ?)",
    [id, title, template, now, now, now],
  );
  return id;
}

export function addChunk(recordingId: string, idx: number, uri: string, durationSec: number) {
  const now = Date.now();
  db.runSync(
    "INSERT INTO chunks (id, recording_id, idx, file_uri, duration_sec, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
    [newId('c'), recordingId, idx, uri, Math.round(durationSec), now, now],
  );
}

export function addMark(recordingId: string, atMs: number) {
  const now = Date.now();
  db.runSync('INSERT INTO marks (id, recording_id, at_ms, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    newId('m'),
    recordingId,
    Math.round(atMs),
    now,
    now,
  ]);
}

/** Selesai merekam. Belum ada AI di versi ini, jadi status langsung 'ready'. */
export function finishRecording(recordingId: string, durationSec: number) {
  db.runSync("UPDATE recordings SET status = 'ready', duration_sec = ?, updated_at = ? WHERE id = ?", [
    Math.round(durationSec),
    Date.now(),
    recordingId,
  ]);
}

export function listRecordings(): Recording[] {
  return db.getAllSync<Recording>(`
    SELECT r.id, r.title, r.template, r.started_at, r.duration_sec, r.status,
      (SELECT COUNT(*) FROM chunks c WHERE c.recording_id = r.id) AS chunk_count,
      (SELECT COUNT(*) FROM marks m WHERE m.recording_id = r.id) AS mark_count
    FROM recordings r WHERE r.status != 'recording' ORDER BY r.started_at DESC`);
}

export function chunksOf(recordingId: string): Chunk[] {
  return db.getAllSync<Chunk>('SELECT id, idx, file_uri, duration_sec FROM chunks WHERE recording_id = ? ORDER BY idx', [recordingId]);
}

export function deleteRecording(recordingId: string) {
  for (const c of chunksOf(recordingId)) {
    try {
      const f = new File(c.file_uri);
      if (f.exists) f.delete();
    } catch {
      // File sudah tidak ada: lanjut.
    }
  }
  db.runSync('DELETE FROM recordings WHERE id = ?', [recordingId]);
}

export function renameRecording(recordingId: string, title: string) {
  db.runSync('UPDATE recordings SET title = ?, updated_at = ? WHERE id = ?', [title, Date.now(), recordingId]);
}

export function lastRecording(): Recording | null {
  return listRecordings()[0] ?? null;
}
