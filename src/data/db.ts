// Database SQLite di HP. Semua waktu disimpan UTC (milidetik).
// Nama tabel & kolom mengikuti docs/rancangan.md. Tabel baru: alarms, settings.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('manager-urwah.db');

const SCHEMA_VERSION = 1;

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
  if (current < SCHEMA_VERSION) db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // Rekaman yang terputus (app ditutup paksa saat merekam) ditandai, tidak hilang.
  db.runSync("UPDATE recordings SET status = 'error', updated_at = ? WHERE status = 'recording'", [Date.now()]);
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
