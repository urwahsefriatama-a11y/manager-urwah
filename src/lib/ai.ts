// Fungsi AI (nama mengikuti rancangan): transcribeChunk, finalizeRecording, askRecordings,
// plus asisten, analisa catatan, dan baca teks dari foto.
// Otak: Claude (bila kuncinya diisi) untuk semua teks/gambar/PDF; Gemini khusus audio (Claude tidak menerima audio).
import { generate, hasKey, parseJson, type Part, type Turn } from './gemini';
import { claudeAgent, claudeGenerate, hasClaude } from './claude';

/** Pilih otak untuk tugas teks/gambar/PDF. */
async function think(turns: Turn[], opts: { system?: string; json?: boolean } = {}) {
  if (await hasClaude()) return claudeGenerate(turns, opts);
  return generate(turns, opts);
}

/** Nama otak yang sedang dipakai, untuk ditampilkan di UI. */
export async function brainName() {
  if (await hasClaude()) return 'Claude Sonnet';
  if (await hasKey()) return 'Gemini Flash';
  return '';
}

/** Ada kunci AI apa saja yang terisi. */
export async function hasAnyKey() {
  return (await hasClaude()) || (await hasKey());
}

/** Pesan suara singkat → teks (Gemini). */
export async function transcribeVoice(audio: Part): Promise<string> {
  const raw = await generate([
    { role: 'user', parts: [audio, { text: `Tuliskan ucapan dalam rekaman ini apa adanya (${'Bahasa Indonesia, Arab, atau Inggris'}). Hanya teksnya.` }] },
  ]);
  return raw.trim();
}

export type RawSegment = { speaker: string; start_ms: number; end_ms: number; text: string; lang?: string };

const LANGS = 'Bahasa Indonesia, Arab, dan Inggris (bisa bercampur dalam satu kalimat)';

/** Audio satu potongan → kalimat per pembicara. `known` = pembicara dari potongan sebelumnya. */
export async function transcribeChunk(audio: Part, known: { label: string; hint: string }[], glossary: string[]): Promise<RawSegment[]> {
  const prompt = [
    `Transkripsikan rekaman ini secara lengkap kata per kata. Bahasa: ${LANGS}. Tulis kata Arab dalam huruf Arab bila diucapkan dalam bahasa Arab.`,
    'Pisahkan per pembicara dengan label "S1", "S2", dst. Satu orang = satu label yang sama sepanjang rekaman.',
    known.length ? `Pembicara yang sudah dikenali dari bagian sebelumnya (pakai label yang sama bila suaranya sama): ${known.map((k) => `${k.label} = ${k.hint}`).join('; ')}.` : '',
    glossary.length ? `Istilah penting yang harus dieja dengan benar: ${glossary.join(', ')}.` : '',
    'Balas HANYA JSON: {"segments":[{"speaker":"S1","start_ms":0,"end_ms":4200,"text":"...","lang":"id|ar|en"}]}. start_ms/end_ms dihitung dari awal potongan ini.',
  ]
    .filter(Boolean)
    .join('\n');
  const raw = await generate([{ role: 'user', parts: [audio, { text: prompt }] }], { json: true });
  const data = parseJson<{ segments?: RawSegment[] }>(raw);
  return (data.segments ?? []).filter((s) => s && typeof s.text === 'string' && s.text.trim());
}

export type Finalized = {
  title: string;
  summary_md: string;
  speaker_count: number;
  speakers: { label: string; guess_name?: string }[];
  tasks: { title: string; assignee?: string; due_iso?: string }[];
};

/** Semua transkrip + jenis rekaman → ringkasan, jumlah pembicara, dan tugas. */
export async function finalizeRecording(transcript: string, template: string, nowIso: string, docs: Part[] = []): Promise<Finalized> {
  const prompt = `Ini transkrip ${template.toLowerCase()} (label S1, S2, ... = pembicara). Waktu sekarang: ${nowIso} (WIB, UTC+7).
Buat dalam Bahasa Indonesia:
1. "title": judul singkat (maks 8 kata).
2. "summary_md": ringkasan Markdown: ## Inti (3–5 poin), ## Keputusan, ## Poin penting per pembicara, ## Tindak lanjut. ${template === 'Kajian' ? 'Untuk kajian: sertakan ayat/hadits yang disebut dan pelajaran utama.' : ''}
3. "speaker_count": jumlah orang berbeda yang berbicara.
4. "speakers": [{"label":"S1","guess_name":"nama bila disebut, kosongkan bila tidak tahu"}].
5. "tasks": tugas/janji yang disebut: [{"title":"...","assignee":"siapa","due_iso":"2026-11-16T10:00:00+07:00 atau kosong"}]. Jangan mengarang tugas yang tidak disebut.
Bila ada dokumen pendukung (agenda/notulen) terlampir, pakai sebagai konteks.
Balas HANYA JSON dengan kunci di atas.

TRANSKRIP:
${transcript}`;
  const raw = await think([{ role: 'user', parts: [...docs, { text: prompt }] }], { json: true });
  const d = parseJson<Partial<Finalized>>(raw);
  return {
    title: d.title || '',
    summary_md: d.summary_md || '',
    speaker_count: typeof d.speaker_count === 'number' ? d.speaker_count : (d.speakers ?? []).length,
    speakers: d.speakers ?? [],
    tasks: d.tasks ?? [],
  };
}

/** Tanya isi rekaman. */
export async function askRecordings(question: string, transcript: string): Promise<{ answer: string; sources: { start_ms: number }[] }> {
  const prompt = `Jawab pertanyaan berdasarkan transkrip berikut saja. Bila tidak ada di transkrip, katakan tidak ditemukan.
Balas JSON: {"answer":"jawaban Bahasa Indonesia yang ringkas","sources":[{"start_ms":12345}]} (start_ms = waktu kalimat sumber).
Pertanyaan: ${question}

TRANSKRIP (format [ms] Sx: teks):
${transcript}`;
  const raw = await think([{ role: 'user', parts: [{ text: prompt }] }], { json: true });
  const d = parseJson<{ answer?: string; sources?: { start_ms: number }[] }>(raw);
  return { answer: d.answer || 'Tidak ditemukan.', sources: d.sources ?? [] };
}

export type AssistantAction = {
  type: 'reminder' | 'task' | 'alarm' | 'event' | 'note' | 'whatsapp';
  title: string;
  at_iso?: string;
  body?: string;
  phone?: string;
  contact_name?: string;
};
export type AssistantReply = { reply: string; actions: AssistantAction[] };

const PERSONA = `Kamu "Manager Urwah", asisten pribadi Urwah: Muslim, ketua yayasan Utlul Qur'an, pemilik 521 Coffee, desainer & videografer, pengajar fotografi/film.
Gaya: Bahasa Indonesia yang hangat, ringkas, tegas, sangat terstruktur — seperti kepala staf terbaik. Langsung ke inti.
Cara berpikir: pahami tujuan sebenarnya → cek data nyata dulu (pakai alat: tugas, alarm, kalender, catatan, rekaman, kontak, Drive) → beri jawaban/rencana konkret.
Untuk masalah: inti → penyebab → pilihan (untung-rugi) → rekomendasi → langkah berikutnya dengan waktu.
Jangan mengarang fakta, nomor, atau isi file; bila belum tahu, pakai alat atau katakan terus terang. Untuk soal agama, sebutkan dalil hanya bila yakin dan sarankan cek ke ustadz.
Markdown sederhana (##, -, **tebal**). Untuk mode suara: jawab pendek dan enak didengar.`;

const ASSISTANT_SYSTEM = `${PERSONA}
Bila pengguna minta diingatkan atau menyebut tugas, isi "actions" — pengguna yang akan menyetujui.
Selalu balas JSON: {"reply":"teks Markdown","actions":[{"type":"reminder","title":"...","at_iso":"2026-11-16T09:00:00+07:00"},{"type":"task","title":"..."}]}`;

const AGENT_SYSTEM = `${PERSONA}
Kamu punya alat. Pakai alat baca kapan pun perlu data nyata. Untuk SEMUA perubahan (pengingat, tugas, alarm, acara kalender, catatan, chat WA) panggil alat "propose" — pemilik akan menyetujui lewat kartu; jangan bilang sudah dipasang.
Jawaban akhir: teks Markdown biasa (bukan JSON).`;

export async function askAssistant(history: Turn[], nowIso: string, onStep?: (s: string) => void, voice = false): Promise<AssistantReply> {
  if (await hasClaude()) {
    const { toolDefs, runTool } = await import('./assistantTools');
    const { getSetting } = await import('../data/settings');
    const proposals: AssistantAction[] = [];
    const reply = await claudeAgent(history, {
      system: `${AGENT_SYSTEM}\nWaktu sekarang: ${nowIso} (WIB).${voice ? '\nSaat ini mode SUARA: jawab maksimal 3 kalimat, tanpa Markdown.' : ''}`,
      tools: toolDefs(),
      run: (name, input) => runTool(name, input, proposals),
      webSearch: getSetting('web_search') === '1',
      onStep,
    });
    return { reply, actions: proposals.filter((a) => a.title) };
  }
  const raw = await generate(history, { system: `${ASSISTANT_SYSTEM}\nWaktu sekarang: ${nowIso} (WIB).`, json: true });
  try {
    const d = parseJson<{ reply?: string; actions?: AssistantAction[] }>(raw);
    return { reply: d.reply || '', actions: (d.actions ?? []).filter((a) => a && (a.type === 'reminder' || a.type === 'task') && a.title) };
  } catch {
    return { reply: raw, actions: [] };
  }
}

/** Analisa catatan → Markdown. */
export async function analyzeNote(title: string, body: string): Promise<string> {
  const prompt = `Analisa catatan berikut dalam Bahasa Indonesia. Format Markdown:
## Inti
## Poin penting
## Risiko / hal yang perlu diperhatikan
## Tugas yang bisa dikerjakan
Ringkas dan jelas.

Judul: ${title}
${body}`;
  return think([{ role: 'user', parts: [{ text: prompt }] }]);
}

/** Foto dokumen → teks apa adanya. */
export async function readTextFromImage(image: Part): Promise<string> {
  return think([
    {
      role: 'user',
      parts: [image, { text: 'Salin semua teks di gambar dokumen ini apa adanya, pertahankan baris dan urutan. Hanya teksnya saja, tanpa komentar.' }],
    },
  ]);
}
