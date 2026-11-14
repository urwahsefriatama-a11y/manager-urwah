// Cadangan & pulihkan: salinan database (tugas, alarm, catatan, transkrip, ringkasan, template WA).
// Audio rekaman tidak ikut (ukurannya besar) — tetap di HP.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { db } from '../data/db';
import { clearSettingsCache } from '../data/settings';
import { driveDownloadTo, driveUpload } from './google';
import { AiError } from './gemini';
import { isoWib } from './time';

const TABLES = ['recordings', 'chunks', 'marks', 'speakers', 'segments', 'tasks', 'qa', 'glossary', 'alarms', 'settings', 'chat_messages', 'notes', 'wa_templates', 'wa_reminders', 'rec_docs'];

function fileName() {
  return `manager-urwah-cadangan-${isoWib().slice(0, 16).replace(/[:T]/g, '-')}.db`;
}

/** Salinan database yang konsisten (VACUUM INTO). */
export function makeBackupFile(): File {
  const f = new File(Paths.cache, fileName());
  if (f.exists) f.delete();
  const path = decodeURIComponent(f.uri.replace(/^file:\/\//, ''));
  db.execSync(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  return f;
}

export async function shareBackup() {
  const f = makeBackupFile();
  await Sharing.shareAsync(f.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Simpan cadangan Manager Urwah' });
}

export async function backupToDrive() {
  const f = makeBackupFile();
  await driveUpload(f, f.name, 'application/octet-stream');
  return f.name;
}

/** Pulihkan dari file cadangan: data di HP diganti isi cadangan, tabel per tabel. */
export function restoreFrom(f: File) {
  const path = decodeURIComponent(f.uri.replace(/^file:\/\//, ''));
  db.execSync(`ATTACH DATABASE '${path.replace(/'/g, "''")}' AS bak`);
  try {
    const names = new Set(db.getAllSync<{ name: string }>("SELECT name FROM bak.sqlite_master WHERE type = 'table'").map((r) => r.name));
    if (!names.has('tasks')) throw new AiError('File ini bukan cadangan Manager Urwah.');
    db.withTransactionSync(() => {
      for (const t of TABLES) {
        if (!names.has(t)) continue;
        const mine = db.getAllSync<{ name: string }>(`PRAGMA main.table_info(${t})`).map((c) => c.name);
        const theirs = new Set(db.getAllSync<{ name: string }>(`PRAGMA bak.table_info(${t})`).map((c) => c.name));
        const cols = mine.filter((c) => theirs.has(c)).join(', ');
        if (!cols) continue;
        db.execSync(`DELETE FROM main.${t}; INSERT INTO main.${t} (${cols}) SELECT ${cols} FROM bak.${t};`);
      }
    });
  } finally {
    db.execSync('DETACH DATABASE bak');
    clearSettingsCache();
  }
}

export async function restoreFromPicker(): Promise<boolean> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled) return false;
  restoreFrom(new File(r.assets[0].uri));
  return true;
}

export async function restoreFromDrive(id: string) {
  const f = new File(Paths.cache, 'pulihkan.db');
  await driveDownloadTo(id, f);
  restoreFrom(f);
}
