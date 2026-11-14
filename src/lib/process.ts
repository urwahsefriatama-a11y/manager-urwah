// Proses AI satu rekaman: unggah tiap potongan → transkrip → finalisasi (ringkasan, pembicara, tugas).
// Bisa dilanjutkan: potongan yang sudah selesai tidak diulang.
import { db } from '../data/db';
import {
  addDraftTask,
  addSegment,
  chunksOf,
  ensureSpeaker,
  getRecording,
  glossaryTerms,
  saveFinal,
  segmentsOf,
  setChunkStatus,
  setStatus,
  speakersOf,
  renameSpeaker,
} from '../data/recordings';
import { finalizeRecording, transcribeChunk } from './ai';
import { mimeOf, uploadFile } from './gemini';
import { isoWib } from './time';

export type Progress = { step: string; done: number; total: number };

function chunkState(chunkId: string) {
  return db.getFirstSync<{ status: string }>('SELECT status FROM chunks WHERE id = ?', [chunkId])?.status ?? 'pending';
}

const running = new Set<string>();

export function isProcessing(recordingId: string) {
  return running.has(recordingId);
}

export async function processRecording(recordingId: string, onProgress: (p: Progress) => void) {
  if (running.has(recordingId)) throw new Error('Rekaman ini sedang diproses. Tunggu sampai selesai.');
  running.add(recordingId);
  try {
    return await processInner(recordingId, onProgress);
  } finally {
    running.delete(recordingId);
  }
}

async function processInner(recordingId: string, onProgress: (p: Progress) => void) {
  const rec = getRecording(recordingId);
  if (!rec) throw new Error('Rekaman tidak ditemukan.');
  const chunks = chunksOf(recordingId);
  if (chunks.length === 0) throw new Error('Rekaman ini tidak punya file audio.');
  setStatus(recordingId, 'processing');
  const total = chunks.length + 1;
  const glossary = glossaryTerms();

  try {
    let offsetMs = 0;
    for (const c of chunks) {
      if (chunkState(c.id) !== 'transcribed') {
        onProgress({ step: `Mengunggah potongan ${c.idx + 1} dari ${chunks.length}…`, done: c.idx, total });
        const mime = mimeOf(c.file_uri, 'audio/mp4');
        const fileUri = await uploadFile(c.file_uri, mime, `${rec.title} #${c.idx + 1}`);
        setChunkStatus(c.id, 'uploaded');

        onProgress({ step: `Menulis transkrip potongan ${c.idx + 1}…`, done: c.idx + 0.5, total });
        const known = speakersOf(recordingId).map((s) => {
          const first = segmentsOf(recordingId).find((g) => g.speaker_id === s.id);
          return { label: s.label, hint: first ? `"${first.text.slice(0, 80)}"` : 'pembicara' };
        });
        const segs = await transcribeChunk({ fileData: { mimeType: mime, fileUri } }, known, glossary);
        db.withTransactionSync(() => {
          for (const g of segs) {
            const sid = ensureSpeaker(recordingId, (g.speaker || 'S1').toUpperCase());
            addSegment(recordingId, sid, offsetMs + (g.start_ms || 0), offsetMs + (g.end_ms || g.start_ms || 0), g.text.trim(), g.lang ?? null);
          }
        });
        setChunkStatus(c.id, 'transcribed');
      }
      offsetMs += c.duration_sec * 1000;
    }

    onProgress({ step: 'Menyusun ringkasan, pembicara, dan tugas…', done: chunks.length, total });
    const spk = speakersOf(recordingId);
    const labelOf = new Map(spk.map((s) => [s.id, s.label]));
    const transcript = segmentsOf(recordingId)
      .map((g) => `[${g.start_ms}] ${labelOf.get(g.speaker_id ?? '') ?? 'S?'}: ${g.text}`)
      .join('\n');
    const fin = await finalizeRecording(transcript, rec.template, isoWib());
    saveFinal(recordingId, fin.title, fin.summary_md, fin.speaker_count || spk.length);
    for (const s of fin.speakers) {
      const found = spk.find((x) => x.label === (s.label || '').toUpperCase());
      if (found && s.guess_name && !found.display_name) renameSpeaker(found.id, s.guess_name);
    }
    db.runSync("DELETE FROM tasks WHERE recording_id = ? AND status = 'draft'", [recordingId]);
    for (const t of fin.tasks) {
      const due = t.due_iso ? Date.parse(t.due_iso) : NaN;
      addDraftTask(recordingId, t.title, t.assignee || null, Number.isFinite(due) ? due : null);
    }
    onProgress({ step: 'Selesai', done: total, total });
  } catch (e) {
    setStatus(recordingId, 'ready');
    throw e;
  }
}
