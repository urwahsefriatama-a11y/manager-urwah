// Beranda: salam, lintasan waktu shalat, pengingat berikutnya, fitur penting, tugas, alarm.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon, type IconName } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { MenuSheet } from '../src/ui/MenuSheet';
import { PrayerArc } from '../src/ui/PrayerArc';
import { FadeIn, Label, RoundBtn } from '../src/ui/bits';
import { AlarmRow, ProgressRing, TaskRow } from '../src/ui/lists';
import { AddAlarmSheet, AddTaskSheet } from '../src/ui/forms';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import { listTasks, toggleTask, deleteTask, type Task } from '../src/data/tasks';
import { deleteAlarm, listAlarms, setAlarmEnabled, type Alarm } from '../src/data/alarms';
import { lastRecording } from '../src/data/recordings';
import { getFlag, getSetting } from '../src/data/settings';
import { fivePrayers, nextPrayer, currentPlace } from '../src/lib/prayer';
import { duration, greetingWord, hhmm, longDate, nextAtWib, pad, untilText } from '../src/lib/time';

type Card = { label: string; value: string; icon: IconName; href: Href; hot?: boolean; soon?: boolean };

export default function Home() {
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [menu, setMenu] = useState(false);
  const [addTask, setAddTask] = useState(false);
  const [addAlarm, setAddAlarm] = useState(false);
  const [lastRecTitle, setLastRecTitle] = useState<string | null>(null);
  const [lastRecDur, setLastRecDur] = useState(0);

  const reload = useCallback(() => {
    setTasks(listTasks());
    setAlarms(listAlarms());
    const r = lastRecording();
    setLastRecTitle(r ? r.title : null);
    setLastRecDur(r ? r.duration_sec : 0);
    setNow(Date.now());
  }, []);

  useFocusEffect(reload);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const prayers = useMemo(() => fivePrayers(now), [now]);
  const np = useMemo(() => nextPrayer(now), [now]);

  // Pengingat berikutnya: tugas aktif berjam atau alarm menyala, yang paling dekat.
  const next = useMemo(() => {
    const items: { title: string; at: number }[] = [];
    for (const t of tasks) if (t.status !== 'done' && t.due_at && t.due_at > now) items.push({ title: t.title, at: t.due_at });
    for (const a of alarms) if (a.enabled) items.push({ title: a.label, at: nextAtWib(a.hour, a.minute, now) });
    items.sort((x, y) => x.at - y.at);
    return items[0] ?? null;
  }, [tasks, alarms, now]);

  const done = tasks.filter((t) => t.status === 'done').length;
  const nextAlarm = alarms
    .filter((a) => a.enabled)
    .map((a) => ({ a, at: nextAtWib(a.hour, a.minute, now) }))
    .sort((x, y) => x.at - y.at)[0];

  const cards: Card[] = [
    { label: 'Mulai rekam', value: 'REC', icon: 'rec', href: '/rekam', hot: true },
    { label: 'Tugas hari ini', value: `${done}/${tasks.length}`, icon: 'task', href: '/tugas' },
    { label: 'Alarm berikutnya', value: nextAlarm ? hhmm(nextAlarm.at) : '--:--', icon: 'alarm', href: '/tugas' },
    { label: `Shalat ${np.name}`, value: hhmm(np.at), icon: 'shalat', href: '/shalat' },
    { label: lastRecTitle ?? 'Belum ada rekaman', value: lastRecTitle ? duration(lastRecDur) : '00:00', icon: 'file', href: '/rekaman' },
    { label: 'Asisten AI', value: 'v0.3', icon: 'ask', href: '/segera?fitur=asisten', soon: true },
    { label: 'Chat WA terjadwal', value: 'v0.4', icon: 'chat', href: '/segera?fitur=chat', soon: true },
    { label: 'Pindai dokumen', value: 'v0.4', icon: 'scan', href: '/segera?fitur=pindai', soon: true },
  ];

  const name = getSetting('name') || 'Urwah';

  return (
    <Screen
      bg="home"
      bottomSpace={96}
      footer={
        <PressableScale accessibilityLabel="Tanya asisten, hadir di versi 0.3" onPress={() => router.navigate('/segera?fitur=asisten')} style={styles.composer}>
          <T size={15} muted style={{ flex: 1, paddingLeft: 14 }} numberOfLines={1}>
            Tanya asisten…
          </T>
          <View style={styles.soonPill}>
            <T size={11} weight="heavy" style={{ color: color.ink }}>
              v0.3
            </T>
          </View>
          <View style={styles.mic}>
            <Icon name="mic" size={20} color="#7A3412" strokeWidth={2.2} />
          </View>
        </PressableScale>
      }
    >
      <FadeIn>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <T size={12} weight="semibold" muted>
              {longDate(now)}
            </T>
            <T size={13} weight="semibold" style={{ marginTop: 8, color: 'rgba(255,255,255,0.8)' }}>
              {`Assalamu'alaikum, ${name}`}
            </T>
            <T size={19} weight="bold" style={{ marginTop: 2 }}>
              {`${greetingWord(now)}, semoga berkah`}
            </T>
          </View>
          <RoundBtn icon="menu" label="Buka menu" onPress={() => setMenu(true)} />
        </View>
      </FadeIn>

      {getFlag('home_prayer') ? (
        <FadeIn delay={80}>
          <PressableScale accessibilityLabel={`Jadwal shalat. Berikutnya ${np.name} ${hhmm(np.at)}`} onPress={() => router.navigate('/shalat')} style={{ marginTop: 14 }}>
            <PrayerArc prayers={prayers} now={now} nextKey={np.key} />
            <T size={14} weight="bold" style={{ textAlign: 'center', marginTop: 2 }}>
              {`${np.name} `}
              <T pixel size={18}>
                {hhmm(np.at)}
              </T>
              <T size={13} muted>{`  ·  ${untilText(np.at, now)} · ${currentPlace().name}`}</T>
            </T>
          </PressableScale>
        </FadeIn>
      ) : null}

      {getFlag('home_next') ? (
        <FadeIn delay={160} style={{ marginTop: 26 }}>
          {next ? (
            <>
              <T size={40} weight="semibold" style={styles.big} numberOfLines={3} maxFontSizeMultiplier={1.15}>
                {next.title}
              </T>
              <View style={styles.timeRow}>
                <T pixel size={40} maxFontSizeMultiplier={1}>
                  {hhmm(next.at)}
                </T>
                <View style={styles.rule} />
                <T size={12} weight="heavy" muted style={{ letterSpacing: 2 }}>
                  WIB
                </T>
              </View>
              <T size={13} muted style={{ marginTop: 6 }}>
                {untilText(next.at, now)}
              </T>
            </>
          ) : (
            <>
              <T size={34} weight="semibold" style={styles.big}>
                Tidak ada pengingat berikutnya
              </T>
              <T size={14} muted style={{ marginTop: 8 }}>
                Tambahkan tugas berjam atau alarm di bawah.
              </T>
            </>
          )}
        </FadeIn>
      ) : null}

      <FadeIn delay={240}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll} contentContainerStyle={styles.cards}>
          {cards.map((c) => (
            <PressableScale key={c.label} accessibilityLabel={c.soon ? `${c.label}, segera hadir ${c.value}` : c.label} onPress={() => router.navigate(c.href)} style={[styles.card, c.hot ? styles.cardHot : null]}>
              <View style={[styles.cardIcon, c.hot ? styles.cardIconHot : null]}>
                <Icon name={c.icon} size={22} color={c.hot ? '#FFFFFF' : '#FFFFFF'} />
              </View>
              <T pixel size={22} numberOfLines={1} maxFontSizeMultiplier={1} style={[{ marginTop: 'auto' }, c.hot ? { color: color.ink } : null, c.soon ? { color: color.faint } : null]}>
                {c.value}
              </T>
              <T size={12.5} weight="semibold" numberOfLines={2} style={[{ marginTop: 3 }, c.hot ? { color: 'rgba(26,10,4,0.7)' } : { color: color.muted }]}>
                {c.label}
              </T>
            </PressableScale>
          ))}
        </ScrollView>
      </FadeIn>

      {getFlag('home_todo') ? (
        <FadeIn delay={300}>
          <Glass style={styles.section}>
            <View style={styles.sectionHead}>
              <ProgressRing done={done} total={tasks.length} />
              <View style={{ flex: 1 }}>
                <Label>TUGAS HARI INI</Label>
                <T size={17} weight="heavy" style={{ marginTop: 6 }}>
                  {tasks.length === 0 ? 'Belum ada tugas' : done === tasks.length ? 'Semua selesai. Alhamdulillah!' : `${tasks.length - done} tugas lagi`}
                </T>
              </View>
              <RoundBtn icon="plus" label="Tambah tugas" onPress={() => setAddTask(true)} size={40} />
            </View>
            {tasks.slice(0, 6).map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={async () => {
                  await toggleTask(t);
                  reload();
                }}
                onDelete={async () => {
                  await deleteTask(t);
                  reload();
                }}
              />
            ))}
            {tasks.length > 6 ? (
              <PressableScale accessibilityLabel="Lihat semua tugas" onPress={() => router.navigate('/tugas')} style={styles.more}>
                <T size={13} weight="bold" muted>{`Lihat semua (${tasks.length})`}</T>
              </PressableScale>
            ) : null}
          </Glass>
        </FadeIn>
      ) : null}

      {getFlag('home_alarm') ? (
        <FadeIn delay={360}>
          <Glass style={styles.section}>
            <View style={[styles.sectionHead, { marginBottom: 4 }]}>
              <View style={{ flex: 1 }}>
                <Label>ALARM</Label>
              </View>
              <RoundBtn icon="plus" label="Tambah alarm" onPress={() => setAddAlarm(true)} size={40} />
            </View>
            {alarms.length === 0 ? (
              <T size={14} muted style={{ paddingVertical: 10 }}>
                Belum ada alarm. Ketuk + untuk menambah.
              </T>
            ) : (
              alarms.map((a) => (
                <AlarmRow
                  key={a.id}
                  alarm={a}
                  onToggle={async (on) => {
                    await setAlarmEnabled(a, on);
                    toast(on ? `Alarm ${pad(a.hour)}:${pad(a.minute)} menyala.` : `Alarm ${pad(a.hour)}:${pad(a.minute)} dimatikan.`);
                    reload();
                  }}
                  onDelete={async () => {
                    await deleteAlarm(a);
                    reload();
                  }}
                />
              ))
            )}
          </Glass>
        </FadeIn>
      ) : null}

      <MenuSheet open={menu} onClose={() => setMenu(false)} />
      <AddTaskSheet open={addTask} onClose={() => setAddTask(false)} onSaved={(m) => { toast(m); reload(); }} />
      <AddAlarmSheet open={addAlarm} onClose={() => setAddAlarm(false)} onSaved={(m) => { toast(m); reload(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  big: { lineHeight: 46, letterSpacing: -1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  rule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  cardsScroll: { marginTop: 22, marginHorizontal: -20 },
  cards: { paddingHorizontal: 20, gap: 10 },
  card: {
    width: 132,
    height: 132,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(40,10,2,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cardHot: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  cardIconHot: { backgroundColor: '#2A1208' },
  section: { marginTop: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  more: { paddingVertical: 12, alignItems: 'center' },
  composer: {
    width: '100%',
    maxWidth: 560,
    height: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(24,8,4,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  soonPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.85)' },
  mic: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: '#FFEBDD', alignItems: 'center', justifyContent: 'center' },
});
