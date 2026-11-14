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

// ---------- Hasil AI: pembicara & kalimat ----------
export type Speaker = { id: string; label: string; display_name: string | null };
export type Segment = { id: string; speaker_id: string | null; start_ms: number; end_ms: number; text: string };

export function getRecording(id: string) {
  return db.getFirstSync<{ id: string; title: string; template: string; started_at: number; duration_sec: number; status: string; speaker_count: number | null; summary_md: string | null }>(
    'SELECT id, title, template, started_at, duration_sec, status, speaker_count, summary_md FROM recordings WHERE id = ?',
    [id],
  );
}

export function speakersOf(id: string): Speaker[] {
  return db.getAllSync<Speaker>('SELECT id, label, display_name FROM speakers WHERE recording_id = ? ORDER BY label', [id]);
}

export function segmentsOf(id: string): Segment[] {
  return db.getAllSync<Segment>('SELECT id, speaker_id, start_ms, end_ms, text FROM segments WHERE recording_id = ? ORDER BY start_ms', [id]);
}

export function setStatus(id: string, status: string) {
  db.runSync('UPDATE recordings SET status = ?, updated_at = ? WHERE id = ?', [status, Date.now(), id]);
}

export function setChunkStatus(chunkId: string, status: string, err?: string) {
  db.runSync('UPDATE chunks SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?', [status, err ?? null, Date.now(), chunkId]);
}

export function clearAiResults(id: string) {
  db.runSync('DELETE FROM segments WHERE recording_id = ?', [id]);
  db.runSync('DELETE FROM speakers WHERE recording_id = ?', [id]);
}

export function ensureSpeaker(recordingId: string, label: string): string {
  const row = db.getFirstSync<{ id: string }>('SELECT id FROM speakers WHERE recording_id = ? AND label = ?', [recordingId, label]);
  if (row) return row.id;
  const id = newId('s');
  const now = Date.now();
  db.runSync('INSERT INTO speakers (id, recording_id, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, recordingId, label, now, now]);
  return id;
}

export function addSegment(recordingId: string, speakerId: string, startMs: number, endMs: number, text: string, lang: string | null) {
  const now = Date.now();
  db.runSync(
    'INSERT INTO segments (id, recording_id, speaker_id, start_ms, end_ms, text, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [newId('g'), recordingId, speakerId, Math.round(startMs), Math.round(endMs), text, lang, now, now],
  );
}

export function saveFinal(id: string, title: string, summary: string, speakerCount: number) {
  db.runSync(
    "UPDATE recordings SET title = CASE WHEN ? = '' THEN title ELSE ? END, summary_md = ?, speaker_count = ?, status = 'ready', updated_at = ? WHERE id = ?",
    [title, title, summary, speakerCount, Date.now(), id],
  );
}

export function renameSpeaker(speakerId: string, name: string) {
  db.runSync('UPDATE speakers SET display_name = ?, updated_at = ? WHERE id = ?', [name.trim() || null, Date.now(), speakerId]);
}

/** Gabungkan pembicara `from` ke `into` (bila AI salah memisahkan satu orang). */
export function mergeSpeakers(fromId: string, intoId: string) {
  db.runSync('UPDATE segments SET speaker_id = ?, updated_at = ? WHERE speaker_id = ?', [intoId, Date.now(), fromId]);
  db.runSync('DELETE FROM speakers WHERE id = ?', [fromId]);
}

export function marksOf(id: string) {
  return db.getAllSync<{ id: string; at_ms: number }>('SELECT id, at_ms FROM marks WHERE recording_id = ? ORDER BY at_ms', [id]);
}

export function draftTasksOf(id: string) {
  return db.getAllSync<{ id: string; title: string; assignee: string | null; due_at: number | null; status: string }>(
    "SELECT id, title, assignee, due_at, status FROM tasks WHERE recording_id = ? ORDER BY created_at",
    [id],
  );
}

export function addDraftTask(recordingId: string, title: string, assignee: string | null, dueAt: number | null) {
  const now = Date.now();
  db.runSync(
    "INSERT INTO tasks (id, recording_id, title, assignee, due_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
    [newId('t'), recordingId, title, assignee, dueAt, now, now],
  );
}

export function saveQa(recordingId: string, q: string, a: string, sources: unknown) {
  const now = Date.now();
  db.runSync('INSERT INTO qa (id, recording_id, question, answer, sources_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    newId('q'),
    recordingId,
    q,
    a,
    JSON.stringify(sources),
    now,
    now,
  ]);
}

export function qaOf(recordingId: string) {
  return db.getAllSync<{ id: string; question: string; answer: string; sources_json: string | null }>(
    'SELECT id, question, answer, sources_json FROM qa WHERE recording_id = ? ORDER BY created_at DESC',
    [recordingId],
  );
}

export function glossaryTerms(): string[] {
  return db.getAllSync<{ term: string }>('SELECT term FROM glossary ORDER BY term').map((r) => r.term);
}

export function chunkAt(recordingId: string, idx: number) {
  return db.getFirstSync<Chunk>('SELECT id, idx, file_uri, duration_sec FROM chunks WHERE recording_id = ? AND idx = ?', [recordingId, idx]);
}
