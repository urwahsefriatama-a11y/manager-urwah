// Mengisi pulau secara otomatis: pengingat terdekat (≤ 60 menit) dan shalat berikutnya (≤ 15 menit).
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { island } from './island';
import { listTasks } from '../data/tasks';
import { listAlarms } from '../data/alarms';
import { nextPrayer, currentPlace } from './prayer';
import { hhmm, nextAtWib, pad } from './time';
import { native } from '../../modules/urwah-native/src';

function left(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}` : `${m} mnt`;
}

export function tickIsland() {
  const cur = island.get();
  if (cur.data && (cur.data.type === 'rec' || cur.data.type === 'proc') && cur.mode !== 'hidden') return;
  const now = Date.now();

  const p = nextPrayer(now);
  if (p.at - now <= 15 * 60000 && p.at > now) {
    const place = currentPlace();
    island.show({
      type: 'shalat',
      pill: p.name,
      right: hhmm(p.at),
      kicker: `Shalat berikutnya · ${left(p.at - now)} lagi`,
      title: `${p.name} pukul ${hhmm(p.at)}`,
      sub: `${place.name} · siapkan diri`,
      pct: Math.round(100 - ((p.at - now) / (15 * 60000)) * 100),
      a: {
        label: 'Senyapkan',
        run: () => {
          native.schedulePrayer('manual-silent', Date.now() + 500, '', '', 30);
          island.setMode('pill');
        },
      },
      b: { label: 'Masjid', run: () => Linking.openURL(`https://www.google.com/maps/search/masjid/@${place.lat},${place.lon},16z`) },
    });
    return;
  }

  const items: { title: string; at: number }[] = [];
  for (const t of listTasks()) if (t.status !== 'done' && t.due_at && t.due_at > now) items.push({ title: t.title, at: t.due_at });
  for (const a of listAlarms()) if (a.enabled) items.push({ title: a.label, at: nextAtWib(a.hour, a.minute, now) });
  items.sort((x, y) => x.at - y.at);
  const n = items[0];
  if (n && n.at - now <= 60 * 60000) {
    island.show({
      type: 'next',
      pill: n.title,
      right: hhmm(n.at),
      kicker: `Berikutnya · ${left(n.at - now)} lagi`,
      title: n.title,
      sub: `Pukul ${hhmm(n.at)} WIB`,
      pct: Math.round(100 - ((n.at - now) / (60 * 60000)) * 100),
      b: { label: 'Lihat', run: () => { island.setMode('pill'); router.navigate('/tugas'); } },
    });
    return;
  }
  if (cur.data && (cur.data.type === 'next' || cur.data.type === 'shalat')) island.hide();
}
