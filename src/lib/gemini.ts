// Klien Gemini (REST langsung, tanpa server). Kunci diambil dari SecureStore, tidak pernah dicatat ke log.
// Model memakai alias resmi `gemini-flash-latest` agar selalu ke versi Flash terbaru dari Google.
import * as SecureStore from 'expo-secure-store';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export const GEMINI_KEY = 'gemini_api_key';
const BASE = 'https://generativelanguage.googleapis.com';
export const MODEL = 'gemini-flash-latest';

export class AiError extends Error {}

export async function getKey(): Promise<string> {
  const k = await SecureStore.getItemAsync(GEMINI_KEY);
  if (!k) throw new AiError('Kunci Gemini belum diisi. Buka Pengaturan → Asisten & AI.');
  return k;
}

export async function hasKey() {
  try {
    return !!(await SecureStore.getItemAsync(GEMINI_KEY));
  } catch {
    return false;
  }
}

export type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

export type Turn = { role: 'user' | 'model'; parts: Part[] };

function explain(status: number, body: string) {
  if (status === 400 && body.includes('API key')) return 'Kunci Gemini tidak valid. Periksa lagi di Pengaturan.';
  if (status === 403) return 'Kunci Gemini ditolak (403). Pastikan kunci aktif di Google AI Studio.';
  if (status === 429) return 'Batas pemakaian Gemini gratis tercapai. Coba lagi beberapa menit lagi.';
  if (status >= 500) return 'Server Gemini sedang sibuk. Coba lagi sebentar lagi.';
  return `Gagal menghubungi Gemini (${status}).`;
}

/** Panggil generateContent. `json: true` meminta jawaban berformat JSON. */
export async function generate(contents: Turn[], opts: { system?: string; json?: boolean } = {}): Promise<string> {
  const key = await getKey();
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${BASE}/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents,
        ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
        generationConfig: opts.json ? { responseMimeType: 'application/json' } : {},
      }),
    });
  } catch {
    throw new AiError('Tidak ada koneksi internet.');
  }
  const text = await res.text();
  if (!res.ok) throw new AiError(explain(res.status, text));
  try {
    const data = JSON.parse(text) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const out = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!out) throw new AiError('Gemini tidak memberi jawaban. Coba ulangi.');
    return out;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError('Jawaban Gemini tidak terbaca.');
  }
}

/** Ambil JSON dari teks jawaban (kadang dibungkus ```json). */
export function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
}

/** Unggah file besar (audio rekaman) ke Files API Gemini, lalu tunggu sampai siap dipakai. */
export async function uploadFile(uri: string, mimeType: string, displayName: string): Promise<string> {
  const key = await getKey();
  const file = new File(uri);
  if (!file.exists) throw new AiError('File audio tidak ditemukan di HP.');
  const size = file.size ?? 0;

  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) throw new AiError(explain(start.status, await start.text()));
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new AiError('Gemini tidak memberi alamat unggah.');

  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });
  const upText = await up.text();
  if (!up.ok) throw new AiError(explain(up.status, upText));
  const info = JSON.parse(upText) as { file?: { name?: string; uri?: string; state?: string } };
  const name = info.file?.name;
  const fileUri = info.file?.uri;
  if (!name || !fileUri) throw new AiError('Unggahan audio tidak lengkap.');

  // Tunggu file selesai diproses Google (biasanya beberapa detik).
  let state = info.file?.state ?? 'PROCESSING';
  for (let i = 0; i < 60 && state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const g = await fetch(`${BASE}/v1beta/${name}`, { headers: { 'x-goog-api-key': key } });
    if (g.ok) {
      const j = (await g.json()) as { state?: string };
      state = j.state ?? state;
    }
  }
  if (state !== 'ACTIVE') throw new AiError('Audio belum siap diproses Gemini. Coba lagi nanti.');
  return fileUri;
}

/** Baca file kecil (foto, PDF, Markdown) sebagai base64 untuk dikirim langsung. */
export async function inlinePart(uri: string, mimeType: string): Promise<Part> {
  const f = new File(uri);
  const data = await f.base64();
  return { inlineData: { mimeType, data } };
}

export function mimeOf(uri: string, fallback = 'application/octet-stream') {
  const u = uri.toLowerCase();
  if (u.endsWith('.aac')) return 'audio/aac';
  if (u.endsWith('.m4a') || u.endsWith('.mp4')) return 'audio/mp4';
  if (u.endsWith('.mp3')) return 'audio/mp3';
  if (u.endsWith('.wav')) return 'audio/wav';
  if (u.endsWith('.pdf')) return 'application/pdf';
  if (u.endsWith('.md') || u.endsWith('.markdown')) return 'text/markdown';
  if (u.endsWith('.txt')) return 'text/plain';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
}
