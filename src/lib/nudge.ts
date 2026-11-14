// Asisten menyapa bila app tidak dibuka seharian: pengingat dipasang untuk besok malam,
// dan dipasang ulang setiap kali app dibuka (jadi hanya muncul bila memang tidak dibuka).
import { getSetting, setSetting } from '../data/settings';
import { listTasks } from '../data/tasks';
import { cancel, scheduleAt } from './notify';
import { todayAtWib } from './time';

export async function rescheduleNudge() {
  await cancel(getSetting('nudge_id'));
  if (getSetting('nudge') === '0') {
    setSetting('nudge_id', '');
    return;
  }
  const left = listTasks().filter((t) => t.status !== 'done').length;
  const at = todayAtWib(20, 0) + 24 * 60 * 60 * 1000;
  const body = left > 0 ? `Seharian belum buka Manager Urwah. Masih ada ${left} tugas — mau saya bantu susun?` : 'Seharian belum buka Manager Urwah. Ada yang perlu saya ingatkan untuk besok?';
  const id = await scheduleAt('Asisten', body, at);
  setSetting('nudge_id', id ?? '');
}
