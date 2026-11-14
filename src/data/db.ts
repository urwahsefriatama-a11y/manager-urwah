// Database SQLite di HP. Semua waktu disimpan UTC (milidetik).
// Nama tabel & kolom mengikuti docs/rancangan.md. Tabel baru: alarms, settings.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('manager-urwah.db');

const SCHEMA_VERSION = 3;

export function initDb() {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current < 1) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        template TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'recording',
        speaker_count INTEGER,
        summary_md TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY NOT NULL,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        idx INTEGER NOT NULL,
        file_uri TEXT NOT NULL,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error_msg TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS marks (
        id TEXT PRIMARY KEY NOT NULL,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        at_ms INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        recording_id TEXT,
        title TEXT NOT NULL,
        assignee TEXT,
        due_at INTEGER,
        status TEXT NOT NULL DEFAULT 'confirmed',
        alarm_id TEXT,
        notif_id TEXT,
        calendar_event_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY NOT NULL,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        label TEXT NOT NULL,
        repeat TEXT NOT NULL DEFAULT 'once',
        enabled INTEGER NOT NULL DEFAULT 1,
        notif_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_rec ON chunks(recording_id, idx);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(status, due_at);
    `);
  }
  if (current < 2) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS speakers (
        id TEXT PRIMARY KEY NOT NULL,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        display_name TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS segments (
        id TEXT PRIMARY KEY NOT NULL,
        recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
        speaker_id TEXT,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        text TEXT NOT NULL,
        lang TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS qa (
        id TEXT PRIMARY KEY NOT NULL,
        recording_id TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        sources_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS glossary (
        id TEXT PRIMARY KEY NOT NULL,
        term TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        attachments_json TEXT,
        actions_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        analysis_md TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wa_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wa_reminders (
        id TEXT PRIMARY KEY NOT NULL,
        contact_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        body TEXT NOT NULL,
        at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        notif_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_segments_rec ON segments(recording_id, start_ms);
    `);
    const now = Date.now();
    const seed = [
      ['tpl_donatur', 'Follow-up donatur', "Assalamu'alaikum {nama}, semoga sehat selalu. Kami ingin mengabarkan program terbaru yayasan. Boleh kami telepon {tanggal}?"],
      ['tpl_rapat', 'Undangan rapat', "Assalamu'alaikum {nama}. Mengundang rapat {tanggal} pukul {waktu}. Mohon konfirmasi kehadiran. Jazakallah khair."],
      ['tpl_terima', 'Terima kasih', 'Jazakallah khair {nama} atas dukungannya. Semoga Allah membalas dengan kebaikan.'],
    ];
    for (const t of seed) db.runSync('INSERT OR IGNORE INTO wa_templates (id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [t[0], t[1], t[2], now, now]);
  }
  if (current < 3) {
    // Dokumen pendukung rekaman (agenda/notulen PDF atau Markdown) sebagai konteks ringkasan.
    db.execSync(`
      CREATE TABLE IF NOT EXISTS rec_docs (
        id TEXT PRIMARY KEY,
        recording_id TEXT,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        uri TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recdocs_rec ON rec_docs(recording_id);
    `);
  }
  if (current < SCHEMA_VERSION) db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // Rekaman yang terputus (app ditutup paksa saat merekam) ditandai, tidak hilang.
  db.runSync("UPDATE recordings SET status = 'error', updated_at = ? WHERE status = 'recording'", [Date.now()]);
  // Proses AI yang terputus bisa diulang dari layar detail.
  db.runSync("UPDATE recordings SET status = 'ready', updated_at = ? WHERE status = 'processing'", [Date.now()]);
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
