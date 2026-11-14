// Alat yang bisa dipakai asisten (Claude). Alat "baca" dijalankan langsung;
// alat yang mengubah sesuatu (pengingat, tugas, alarm, acara, catatan, chat WA) hanya menyiapkan kartu
// yang wajib disetujui pemilik dulu.
import { listTasks } from '../data/tasks';
import { listAlarms } from '../data/alarms';
import { listNotes, listTemplates } from '../data/extra';
import { listRecordings, getRecording } from '../data/recordings';
import { fivePrayers, currentPlace } from './prayer';
import { calendarEvents, describeEvents, searchContacts, allowCalendar, allowContacts } from './phone';
import { driveEnabled, driveRead, driveSearch } from './google';
import { dayDateTime, hhmm, todayAtWib } from './time';
import type { AssistantAction } from './ai';

export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolOut = { text?: string; blocks?: unknown[] };

const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties: props, required });
const str = (description: string) => ({ type: 'string', description });

export function toolDefs(): ToolDef[] {
  const t: ToolDef[] = [
    { name: 'list_tasks', description: 'Daftar tugas pemilik (belum & sudah selesai) beserta tenggatnya.', input_schema: obj({}) },
    { name: 'list_alarms', description: 'Daftar alarm pemilik.', input_schema: obj({}) },
    { name: 'prayer_times', description: 'Jadwal shalat hari ini di lokasi pemilik.', input_schema: obj({}) },
    { name: 'list_notes', description: 'Catatan pemilik (judul + isi singkat). Isi query untuk menyaring.', input_schema: obj({ query: str('kata kunci, boleh kosong') }) },
    { name: 'search_recordings', description: 'Cari rekaman rapat/kajian dan ringkasannya.', input_schema: obj({ query: str('kata kunci, boleh kosong') }) },
    { name: 'list_wa_templates', description: 'Template pesan WhatsApp milik pemilik.', input_schema: obj({}) },
    {
      name: 'propose',
      description:
        'Siapkan aksi untuk DISETUJUI pemilik (tidak langsung dijalankan). type: reminder (pengingat berjam), task (tugas tanpa jam), alarm (alarm jam:menit), event (acara kalender), note (simpan catatan), whatsapp (buka WA dengan pesan siap kirim).',
      input_schema: obj(
        {
          type: { type: 'string', enum: ['reminder', 'task', 'alarm', 'event', 'note', 'whatsapp'] },
          title: str('judul/isi singkat'),
          at_iso: str('waktu ISO 8601 dengan +07:00 untuk reminder/alarm/event'),
          body: str('isi catatan atau pesan WA'),
          phone: str('nomor WA untuk whatsapp'),
          contact_name: str('nama penerima WA'),
        },
        ['type', 'title'],
      ),
    },
  ];
  if (allowCalendar())
    t.push({ name: 'calendar_events', description: 'Acara di kalender HP pada rentang hari.', input_schema: obj({ from_iso: str('mulai, ISO'), to_iso: str('sampai, ISO') }, ['from_iso', 'to_iso']) });
  if (allowContacts()) t.push({ name: 'search_contacts', description: 'Cari kontak HP berdasarkan nama (untuk nomor WA).', input_schema: obj({ name: str('nama') }, ['name']) });
  if (driveEnabled()) {
    t.push({ name: 'drive_search', description: 'Cari file di Google Drive pemilik.', input_schema: obj({ query: str('kata kunci') }, ['query']) });
    t.push({ name: 'drive_read', description: 'Baca isi file Google Drive berdasarkan id dari drive_search.', input_schema: obj({ id: str('id file') }, ['id']) });
  }
  return t;
}

/** Jalankan alat. `proposals` menampung kartu aksi untuk disetujui. */
export async function runTool(name: string, input: Record<string, string>, proposals: AssistantAction[]): Promise<ToolOut> {
  const q = (input.query ?? '').toLowerCase();
  switch (name) {
    case 'list_tasks': {
      const ts = listTasks();
      return { text: ts.length ? ts.map((t) => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${t.due_at ? ` · ${dayDateTime(t.due_at)}` : ''}`).join('\n') : 'Belum ada tugas.' };
    }
    case 'list_alarms': {
      const as = listAlarms();
      return { text: as.length ? as.map((a) => `- ${hhmm(todayAtWib(a.hour, a.minute))} ${a.label} (${a.repeat === 'daily' ? 'setiap hari' : 'sekali'}, ${a.enabled ? 'aktif' : 'mati'})`).join('\n') : 'Belum ada alarm.' };
    }
    case 'prayer_times': {
      const p = currentPlace();
      return { text: `${p.name}:\n` + fivePrayers(Date.now()).map((x) => `- ${x.name} ${hhmm(x.at)}`).join('\n') };
    }
    case 'list_notes': {
      const ns = listNotes().filter((n) => !q || `${n.title} ${n.body}`.toLowerCase().includes(q)).slice(0, 15);
      return { text: ns.length ? ns.map((n) => `## ${n.title}\n${n.body.slice(0, 1200)}`).join('\n\n') : 'Tidak ada catatan yang cocok.' };
    }
    case 'search_recordings': {
      const rs = listRecordings().filter((r) => !q || r.title.toLowerCase().includes(q)).slice(0, 8);
      const out = rs.map((r) => {
        const full = getRecording(r.id);
        return `## ${r.title} (${dayDateTime(r.started_at)})\n${(full?.summary_md ?? 'Belum diproses AI.').slice(0, 2500)}`;
      });
      return { text: out.length ? out.join('\n\n') : 'Tidak ada rekaman yang cocok.' };
    }
    case 'list_wa_templates':
      return { text: listTemplates().map((t) => `- ${t.name}: ${t.body}`).join('\n') || 'Belum ada template.' };
    case 'calendar_events': {
      const from = Date.parse(input.from_iso);
      const to = Date.parse(input.to_iso);
      return { text: describeEvents(await calendarEvents(Number.isFinite(from) ? from : Date.now(), Number.isFinite(to) ? to : Date.now() + 7 * 864e5)) };
    }
    case 'search_contacts': {
      const cs = await searchContacts(input.name ?? '');
      return { text: cs.length ? cs.map((c) => `- ${c.name}: ${c.phones.join(', ') || '(tanpa nomor)'}`).join('\n') : 'Kontak tidak ditemukan.' };
    }
    case 'drive_search': {
      const fs = await driveSearch(input.query ?? '');
      return { text: fs.length ? fs.map((f) => `- ${f.name} (id: ${f.id}, ${f.mimeType}${f.modifiedTime ? `, diubah ${f.modifiedTime.slice(0, 10)}` : ''})`).join('\n') : 'Tidak ada file yang cocok.' };
    }
    case 'drive_read': {
      const f = await driveRead(input.id);
      if (f.text) return { text: `Isi "${f.name}":\n${f.text}` };
      if (f.base64 && f.mime === 'application/pdf') return { blocks: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.base64 } }, { type: 'text', text: `PDF "${f.name}"` }] };
      if (f.base64 && f.mime.startsWith('image/')) return { blocks: [{ type: 'image', source: { type: 'base64', media_type: f.mime, data: f.base64 } }, { type: 'text', text: `Gambar "${f.name}"` }] };
      return { text: `File "${f.name}" (${f.mime}) tidak bisa dibaca sebagai teks.` };
    }
    case 'propose': {
      proposals.push({
        type: (input.type as AssistantAction['type']) || 'task',
        title: input.title ?? '',
        at_iso: input.at_iso ?? '',
        body: input.body ?? '',
        phone: input.phone ?? '',
        contact_name: input.contact_name ?? '',
      } as AssistantAction);
      return { text: 'Kartu aksi disiapkan; pemilik akan menyetujui atau menolak.' };
    }
  }
  return { text: `Alat ${name} tidak dikenal.` };
}
