// Google Drive: izin lewat akun Google di HP (Google Identity Services), lalu REST API Drive langsung.
// Token akses hanya disimpan di memori (berlaku ±1 jam), tidak pernah ditulis ke penyimpanan atau log.
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { native } from '../../modules/urwah-native/src';
import { AiError } from './gemini';
import { getSetting, setSetting } from '../data/settings';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'];
let token: { v: string; at: number } | null = null;

export function driveEnabled() {
  return getSetting('drive_on') === '1';
}

/** Minta/ambil token. Layar izin Google hanya muncul pertama kali. */
export async function driveToken(interactive = true): Promise<string> {
  if (token && Date.now() - token.at < 45 * 60000) return token.v;
  if (!interactive && !driveEnabled()) throw new AiError('Google Drive belum dihubungkan. Buka Pengaturan → Google Drive.');
  try {
    const v = await native.googleAuthorize(SCOPES);
    token = { v, at: Date.now() };
    setSetting('drive_on', '1');
    return v;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/10:|DEVELOPER_ERROR|developer/i.test(msg))
      throw new AiError('Google menolak: app belum didaftarkan di Google Cloud (paket com.urwah.manager + SHA-1). Ikuti panduan di Pengaturan → Google Drive.');
    throw new AiError(`Gagal terhubung ke Google: ${msg}`);
  }
}

export function driveDisconnect() {
  token = null;
  setSetting('drive_on', '0');
}

async function api(path: string, init: { method?: string; headers?: Record<string, string>; body?: string | File } = {}) {
  const t = await driveToken(false);
  const res = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers ?? {}) } });
  if (res.status === 401) {
    token = null;
    throw new AiError('Sesi Google habis. Coba lagi.');
  }
  return res;
}

export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string };

export async function driveSearch(query: string, limit = 10): Promise<DriveFile[]> {
  const safe = query.replace(/['\\]/g, ' ').trim();
  const q = safe ? `(name contains '${safe}' or fullText contains '${safe}') and trashed = false` : 'trashed = false';
  const res = await api(`/drive/v3/files?pageSize=${limit}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime)&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new AiError(`Drive gagal mencari (${res.status}).`);
  const j = (await res.json()) as { files?: DriveFile[] };
  return j.files ?? [];
}

const EXPORT: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

/** Isi file Drive sebagai teks, atau base64 untuk PDF/gambar. */
export async function driveRead(id: string): Promise<{ name: string; mime: string; text?: string; base64?: string }> {
  const meta = await api(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size`);
  if (!meta.ok) throw new AiError(`File Drive tidak ditemukan (${meta.status}).`);
  const m = (await meta.json()) as { name: string; mimeType: string; size?: string };
  const exp = EXPORT[m.mimeType];
  if (exp) {
    const r = await api(`/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(exp)}`);
    if (!r.ok) throw new AiError(`Gagal membaca ${m.name}.`);
    return { name: m.name, mime: exp, text: (await r.text()).slice(0, 80000) };
  }
  if (Number(m.size ?? 0) > 20 * 1024 * 1024) throw new AiError(`${m.name} terlalu besar untuk dibaca (maks 20 MB).`);
  const r = await api(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
  if (!r.ok) throw new AiError(`Gagal mengunduh ${m.name}.`);
  if (m.mimeType.startsWith('text/') || m.mimeType === 'application/json') return { name: m.name, mime: 'text/plain', text: (await r.text()).slice(0, 80000) };
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { name: m.name, mime: m.mimeType, base64: globalThis.btoa(bin) };
}

/** Unggah file (mis. cadangan database) ke Drive. */
export async function driveUpload(file: File, name: string, mime: string): Promise<string> {
  const create = await api('/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: mime }),
  });
  if (!create.ok) throw new AiError(`Drive menolak membuat file (${create.status}).`);
  const { id } = (await create.json()) as { id: string };
  const up = await api(`/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mime }, body: file });
  if (!up.ok) throw new AiError(`Unggah ke Drive gagal (${up.status}).`);
  return id;
}

export async function driveListBackups(): Promise<DriveFile[]> {
  const q = "name contains 'manager-urwah-cadangan' and trashed = false";
  const res = await api(`/drive/v3/files?pageSize=10&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime)&q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return ((await res.json()) as { files?: DriveFile[] }).files ?? [];
}

export async function driveDownloadTo(id: string, dest: File) {
  const r = await api(`/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
  if (!r.ok) throw new AiError(`Gagal mengunduh cadangan (${r.status}).`);
  const buf = new Uint8Array(await r.arrayBuffer());
  dest.create({ overwrite: true });
  await dest.write(buf);
}
