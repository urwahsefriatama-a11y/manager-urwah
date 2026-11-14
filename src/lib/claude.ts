// Klien Claude (Anthropic Messages API, REST langsung tanpa server).
// Kunci diketik pemilik di Pengaturan, disimpan terenkripsi di SecureStore, tidak pernah dicatat ke log.
// Catatan: Claude tidak menerima audio. Transkrip rekaman & pesan suara tetap memakai Gemini.
import * as SecureStore from 'expo-secure-store';
import { fetch } from 'expo/fetch';
import { AiError, type Part, type Turn } from './gemini';

export const CLAUDE_KEY = 'claude_api_key';
export const CLAUDE_MODEL = 'claude-sonnet-5-5';
const URL = 'https://api.anthropic.com/v1/messages';

export async function hasClaude() {
  try {
    return !!(await SecureStore.getItemAsync(CLAUDE_KEY));
  } catch {
    return false;
  }
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

function toBlocks(parts: Part[]): Block[] {
  const out: Block[] = [];
  for (const p of parts) {
    if ('text' in p) {
      if (p.text) out.push({ type: 'text', text: p.text });
    } else if ('inlineData' in p) {
      const m = p.inlineData.mimeType;
      if (m === 'application/pdf') out.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.inlineData.data } });
      else if (m.startsWith('image/')) out.push({ type: 'image', source: { type: 'base64', media_type: m === 'image/jpg' ? 'image/jpeg' : m, data: p.inlineData.data } });
      else out.push({ type: 'text', text: '(Lampiran jenis ini tidak bisa dibaca Claude.)' });
    } else {
      out.push({ type: 'text', text: '(Audio tidak bisa dibaca Claude.)' });
    }
  }
  return out.length ? out : [{ type: 'text', text: '…' }];
}

function explain(status: number, body: string) {
  if (status === 401) return 'Kunci Claude tidak valid. Periksa lagi di Pengaturan → Asisten & AI.';
  if (status === 403) return 'Kunci Claude tidak punya izin untuk model ini.';
  if (status === 400 && body.includes('credit')) return 'Saldo kredit Claude habis. Isi ulang di console Anthropic.';
  if (status === 429) return 'Batas pemakaian Claude per menit tercapai. Coba lagi sebentar lagi.';
  if (status === 529 || status >= 500) return 'Server Claude sedang sibuk. Coba lagi sebentar lagi.';
  return `Gagal menghubungi Claude (${status}).`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kirim percakapan ke Claude. Otomatis mencoba ulang bila server sibuk (429/5xx/529). */
export async function claudeGenerate(turns: Turn[], opts: { system?: string; json?: boolean; maxTokens?: number } = {}): Promise<string> {
  const key = await SecureStore.getItemAsync(CLAUDE_KEY);
  if (!key) throw new AiError('Kunci Claude belum diisi. Buka Pengaturan → Asisten & AI.');
  // Claude: pesan harus bergantian user/assistant dan dimulai dari user.
  const messages: { role: 'user' | 'assistant'; content: Block[] }[] = [];
  for (const t of turns) {
    const role = t.role === 'model' ? 'assistant' : 'user';
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...toBlocks(t.parts));
    else messages.push({ role, content: toBlocks(t.parts) });
  }
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  const system = [opts.system, opts.json ? 'Balas HANYA dengan JSON yang valid, tanpa teks lain dan tanpa ```.' : ''].filter(Boolean).join('\n\n');
  const body: Record<string, unknown> = { model: CLAUDE_MODEL, max_tokens: opts.maxTokens ?? 8000, messages, output_config: { effort: 'low' } };
  if (system) body.system = system;

  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AiError('Tidak ada koneksi internet.');
    }
    const text = await res.text();
    if (res.ok) {
      try {
        const data = JSON.parse(text) as { content?: { type: string; text?: string }[] };
        const out = (data.content ?? [])
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('');
        if (!out) throw new AiError('Claude tidak memberi jawaban. Coba ulangi.');
        return out;
      } catch (e) {
        if (e instanceof AiError) throw e;
        throw new AiError('Jawaban Claude tidak terbaca.');
      }
    }
    // Bila pengaturan "effort" tidak diterima model, ulangi tanpa pengaturan itu.
    if (res.status === 400 && 'output_config' in body && /output_config|effort/.test(text)) {
      delete body.output_config;
      continue;
    }
    lastErr = explain(res.status, text);
    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      await wait([1500, 4000, 9000][attempt] ?? 9000);
      continue;
    }
    throw new AiError(lastErr);
  }
  throw new AiError(lastErr || 'Claude sedang sibuk. Coba lagi nanti.');
}

// ---------- Mode agen: Claude boleh memakai alat (data app, kalender, kontak, Drive, pencarian web) ----------
type AnyBlock = Record<string, unknown>;
type Msg = { role: 'user' | 'assistant'; content: AnyBlock[] };

export async function claudeAgent(
  turns: Turn[],
  opts: {
    system: string;
    tools: { name: string; description: string; input_schema: Record<string, unknown> }[];
    run: (name: string, input: Record<string, string>) => Promise<{ text?: string; blocks?: unknown[] }>;
    webSearch?: boolean;
    onStep?: (label: string) => void;
  },
): Promise<string> {
  const key = await SecureStore.getItemAsync(CLAUDE_KEY);
  if (!key) throw new AiError('Kunci Claude belum diisi. Buka Pengaturan → Asisten & AI.');
  const messages: Msg[] = [];
  for (const t of turns) {
    const role = t.role === 'model' ? 'assistant' : 'user';
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...(toBlocks(t.parts) as AnyBlock[]));
    else messages.push({ role, content: toBlocks(t.parts) as AnyBlock[] });
  }
  while (messages.length && messages[0].role === 'assistant') messages.shift();

  const tools: AnyBlock[] = opts.tools.map((t) => ({ ...t }));
  if (opts.webSearch) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 3 });
  let useWeb = !!opts.webSearch;
  let effort: string | null = 'medium';

  for (let round = 0; round < 8; round++) {
    const body: AnyBlock = {
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      system: opts.system,
      messages,
      tools: useWeb ? tools : tools.filter((t) => t.name !== 'web_search'),
    };
    if (effort) body.output_config = { effort };
    let res: Awaited<ReturnType<typeof fetch>> | null = null;
    let text = '';
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        res = await fetch(URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify(body),
        });
      } catch {
        throw new AiError('Tidak ada koneksi internet.');
      }
      text = await res.text();
      if (res.ok) break;
      if (res.status === 400 && effort && /output_config|effort/.test(text)) {
        effort = null;
        delete body.output_config;
        attempt--;
        continue;
      }
      if (res.status === 400 && useWeb && /web_search/.test(text)) {
        // Pencarian web belum diaktifkan admin di console Anthropic: lanjut tanpa itu.
        useWeb = false;
        body.tools = tools.filter((t) => t.name !== 'web_search');
        attempt--;
        continue;
      }
      if (res.status === 429 || res.status === 529 || res.status >= 500) {
        await wait([1500, 4000, 9000][attempt] ?? 9000);
        continue;
      }
      throw new AiError(explain(res.status, text));
    }
    if (!res || !res.ok) throw new AiError(explain(res?.status ?? 0, text));
    const data = JSON.parse(text) as { content: AnyBlock[]; stop_reason: string };
    messages.push({ role: 'assistant', content: data.content });

    const uses = data.content.filter((b) => b.type === 'tool_use') as { id: string; name: string; input: Record<string, string> }[];
    if (data.stop_reason === 'pause_turn') continue; // pencarian web panjang: lanjutkan giliran
    if (data.stop_reason !== 'tool_use' || !uses.length) {
      return data.content
        .filter((b) => b.type === 'text')
        .map((b) => String(b.text ?? ''))
        .join('')
        .trim();
    }
    const results: AnyBlock[] = [];
    for (const u of uses) {
      opts.onStep?.(u.name);
      try {
        const out = await opts.run(u.name, u.input ?? {});
        results.push({ type: 'tool_result', tool_use_id: u.id, content: out.blocks ?? [{ type: 'text', text: out.text ?? 'OK' }] });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }] });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  throw new AiError('Asisten terlalu lama berpikir. Coba sederhanakan pertanyaannya.');
}
