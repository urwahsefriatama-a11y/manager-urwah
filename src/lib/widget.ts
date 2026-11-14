// Perbarui widget layar utama dengan data terbaru.
import { native } from '../../modules/urwah-native/src';
import { listTasks } from '../data/tasks';
import { listAlarms } from '../data/alarms';
import { getSetting } from '../data/settings';
import { nextPrayer } from './prayer';
import { greetingWord, hhmm, nextAtWib } from './time';

export function updateWidget() {
  if (!native.available) return;
  try {
    const now = Date.now();
    const tasks = listTasks();
    const items: { title: string; at: number }[] = [];
    for (const t of tasks) if (t.status !== 'done' && t.due_at && t.due_at > now) items.push({ title: t.title, at: t.due_at });
    for (const a of listAlarms()) if (a.enabled) items.push({ title: a.label, at: nextAtWib(a.hour, a.minute, now) });
    items.sort((x, y) => x.at - y.at);
    const n = items[0];
    const p = nextPrayer(now);
    const done = tasks.filter((t) => t.status === 'done').length;
    native.setWidgetData({
      greet: `${greetingWord(now)}, ${getSetting('name') || 'Urwah'}`,
      next_title: n ? n.title : 'Tidak ada pengingat',
      next_time: n ? hhmm(n.at) : '--:--',
      prayer: `${p.name} ${hhmm(p.at)}`,
      tasks: `Tugas ${done}/${tasks.length}`,
    });
  } catch {
    // Widget opsional: kegagalan tidak boleh mengganggu app.
  }
}
