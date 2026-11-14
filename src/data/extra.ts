// Data fitur tambahan: percakapan asisten, catatan, template & jadwal WhatsApp, kamus istilah.
import { db, newId } from './db';
import { cancel, scheduleAt } from '../lib/notify';
import { hhmm } from '../lib/time';

// ---------- Asisten ----------
export type Attachment = { name: string; mime: string; uri: string };
export type ChatMsg = { id: string; role: 'user' | 'model'; text: string; attachments: Attachment[]; actions: unknown[]; created_at: number };

export function listChat(): ChatMsg[] {
  return db
    .getAllSync<{ id: string; role: 'user' | 'model'; text: string; attachments_json: string | null; actions_json: string | null; created_at: number }>(
      'SELECT id, role, text, attachments_json, actions_json, created_at FROM chat_messages ORDER BY created_at',
    )
    .map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      attachments: r.attachments_json ? JSON.parse(r.attachments_json) : [],
      actions: r.actions_json ? JSON.parse(r.actions_json) : [],
      created_at: r.created_at,
    }));
}

export function addChat(role: 'user' | 'model', text: string, attachments: Attachment[] = [], actions: unknown[] = []) {
  const now = Date.now();
  const id = newId('cm');
  db.runSync('INSERT INTO chat_messages (id, role, text, attachments_json, actions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    id,
    role,
    text,
    attachments.length ? JSON.stringify(attachments) : null,
    actions.length ? JSON.stringify(actions) : null,
    now,
    now,
  ]);
  return id;
}

/** Tandai aksi ke-i dari pesan sudah disetujui/diabaikan (agar kartu tidak muncul lagi). */
export function setActionState(msgId: string, index: number, state: 'done' | 'skip') {
  const row = db.getFirstSync<{ actions_json: string | null }>('SELECT actions_json FROM chat_messages WHERE id = ?', [msgId]);
  if (!row?.actions_json) return;
  const list = JSON.parse(row.actions_json) as Record<string, unknown>[];
  if (list[index]) list[index].state = state;
  db.runSync('UPDATE chat_messages SET actions_json = ?, updated_at = ? WHERE id = ?', [JSON.stringify(list), Date.now(), msgId]);
}

export function clearChat() {
  db.runSync('DELETE FROM chat_messages');
}

// ---------- Catatan ----------
export type Note = { id: string; title: string; body: string; analysis_md: string | null; updated_at: number };

export function listNotes(): Note[] {
  return db.getAllSync<Note>('SELECT id, title, body, analysis_md, updated_at FROM notes ORDER BY updated_at DESC');
}

export function saveNote(id: string | null, title: string, body: string) {
  const now = Date.now();
  if (id) {
    db.runSync('UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?', [title, body, now, id]);
    return id;
  }
  const nid = newId('n');
  db.runSync('INSERT INTO notes (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [nid, title, body, now, now]);
  return nid;
}

export function saveNoteAnalysis(id: string, md: string) {
  db.runSync('UPDATE notes SET analysis_md = ?, updated_at = ? WHERE id = ?', [md, Date.now(), id]);
}

export function deleteNote(id: string) {
  db.runSync('DELETE FROM notes WHERE id = ?', [id]);
}

// ---------- WhatsApp ----------
export type WaTemplate = { id: string; name: string; body: string };
export type WaReminder = { id: string; contact_name: string; phone: string; body: string; at: number; status: string; notif_id: string | null };

export function listTemplates(): WaTemplate[] {
  return db.getAllSync<WaTemplate>('SELECT id, name, body FROM wa_templates ORDER BY created_at');
}

export function saveTemplate(id: string | null, name: string, body: string) {
  const now = Date.now();
  if (id) db.runSync('UPDATE wa_templates SET name = ?, body = ?, updated_at = ? WHERE id = ?', [name, body, now, id]);
  else db.runSync('INSERT INTO wa_templates (id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [newId('tpl'), name, body, now, now]);
}

export function deleteTemplate(id: string) {
  db.runSync('DELETE FROM wa_templates WHERE id = ?', [id]);
}

export function listWaReminders(): WaReminder[] {
  return db.getAllSync<WaReminder>("SELECT id, contact_name, phone, body, at, status, notif_id FROM wa_reminders WHERE status = 'scheduled' ORDER BY at");
}

export async function addWaReminder(name: string, phone: string, body: string, at: number) {
  const now = Date.now();
  const notif = await scheduleAt('Kirim WhatsApp', `Ke ${name} · ${hhmm(at)} — buka app untuk kirim`, at);
  db.runSync('INSERT INTO wa_reminders (id, contact_name, phone, body, at, status, notif_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    newId('wa'),
    name,
    phone,
    body,
    at,
    'scheduled',
    notif,
    now,
    now,
  ]);
}

export async function finishWaReminder(r: WaReminder, status: 'sent' | 'cancelled') {
  await cancel(r.notif_id);
  db.runSync('UPDATE wa_reminders SET status = ?, updated_at = ? WHERE id = ?', [status, Date.now(), r.id]);
}

/** 08xx / +62 xx → 62xx (format wa.me). */
export function normalizePhone(p: string) {
  let d = p.replace(/[^0-9]/g, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  return d;
}

// ---------- Kamus istilah (membantu AI mengeja nama & istilah) ----------
export type Term = { id: string; term: string; note: string | null };

export function listTerms(): Term[] {
  return db.getAllSync<Term>('SELECT id, term, note FROM glossary ORDER BY term');
}

export function addTerm(term: string, note: string) {
  const now = Date.now();
  db.runSync('INSERT INTO glossary (id, term, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [newId('gl'), term.trim(), note.trim() || null, now, now]);
}

export function deleteTerm(id: string) {
  db.runSync('DELETE FROM glossary WHERE id = ?', [id]);
}
