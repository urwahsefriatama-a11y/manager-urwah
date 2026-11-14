// Beranda: salam, lintasan waktu shalat, pengingat berikutnya, fitur penting, tugas, alarm.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass, GlassBlur } from '../src/ui/Glass';
import { Icon, type IconName } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { MenuSheet } from '../src/ui/MenuSheet';
import { PrayerArc } from '../src/ui/PrayerArc';
import { FadeIn, Label, RoundBtn } from '../src/ui/bits';
import { AlarmRow, ProgressRing, TaskRow } from '../src/ui/lists';
import { AddAlarmSheet, AddTaskSheet } from '../src/ui/forms';
import { useToast } from '../src/ui/Toast';
import { color, font, radius } from '../src/ui/theme';
import { island, mirrorLive, clearLive } from '../src/lib/island';
import { listTasks, toggleTask, deleteTask, pendingDrafts, type Task } from '../src/data/tasks';
import { deleteAlarm, listAlarms, setAlarmEnabled, type Alarm } from '../src/data/alarms';
import { lastRecording } from '../src/data/recordings';
import { getFlag, getSetting } from '../src/data/settings';
import { fivePrayers, nextPrayer, currentPlace } from '../src/lib/prayer';
import { updateWidget } from '../src/lib/widget';
import { duration, greetingWord, hhmm, longDate, nextAtWib, pad, untilText } from '../src/lib/time';

type Card = { label: string; value: string; icon: IconName; href: Href; hot?: boolean };

export default function Home() {
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const [drafts, setDrafts] = useState({ count: 0, recordingId: null as string | null });
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
    setDrafts(pendingDrafts());
    updateWidget();
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
    { label: 'Asisten AI', value: 'TANYA', icon: 'spark', href: '/asisten' },
    { label: 'Tugas hari ini', value: `${done}/${tasks.length}`, icon: 'task', href: '/tugas' },
    { label: 'Alarm berikutnya', value: nextAlarm ? hhmm(nextAlarm.at) : '--:--', icon: 'alarm', href: '/tugas' },
    { label: `Shalat ${np.name}`, value: hhmm(np.at), icon: 'shalat', href: '/shalat' },
    { label: lastRecTitle ?? 'Belum ada rekaman', value: lastRecTitle ? duration(lastRecDur) : '00:00', icon: 'file', href: '/rekaman' },
    { label: 'Arah kiblat', value: 'QIBLA', icon: 'compass', href: '/kiblat' },
    { label: 'Chat WhatsApp', value: 'WA', icon: 'chat', href: '/chat' },
    { label: 'Pindai dokumen', value: 'SCAN', icon: 'scan', href: '/pindai' },
    { label: 'Catatan', value: 'NOTE', icon: 'note', href: '/catatan' },
  ];

  const name = getSetting('name') || 'Urwah';

  const askNow = () => {
    const t = q.trim();
    if (!t) return;
    setQ('');
    router.navigate({ pathname: '/asisten', params: { q: t, t: String(Date.now()) } });
  };

  // Tombol lonceng: tampilkan pulau + Live Update sistem untuk dicoba (hitung mundur 2 menit).
  const demoIsland = () => {
    const at = Date.now() + 2 * 60000;
    const target = next ?? { title: 'Contoh pengingat', at };
    island.show(
      {
        type: 'next',
        pill: target.title,
        right: hhmm(target.at),
        kicker: 'Berikutnya',
        title: target.title,
        sub: `Pukul ${hhmm(target.at)} WIB · Live Update dikirim ke bilah status`,
        pct: 35,
        b: { label: 'Tugas', run: () => { island.setMode('pill'); router.navigate('/tugas'); } },
      },
      'open',
      true,
    );
    mirrorLive('demo', { title: target.title, text: `Pukul ${hhmm(target.at)} WIB`, whenMs: target.at, countdown: true, shortText: hhmm(target.at), path: 'tugas' });
    setTimeout(() => clearLive('demo'), Math.max(30000, target.at - Date.now() + 60000));
  };

  return (
    <Screen
      bg="home"
      bottomSpace={96}
      footer={
        <View style={styles.composerWrap}>
          <GlassBlur style={styles.composer}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Tanya asisten…"
              placeholderTextColor={color.faint}
              style={styles.qInput}
              returnKeyType="send"
              onSubmitEditing={askNow}
              maxFontSizeMultiplier={1.3}
            />
            {q.trim() ? (
              <PressableScale accessibilityLabel="Kirim" onPress={askNow} style={styles.sendB}>
                <Icon name="send" size={18} color={color.ink} strokeWidth={2.4} />
              </PressableScale>
            ) : null}
            <PressableScale accessibilityLabel="Bicara ke asisten" onPress={() => router.navigate({ pathname: '/asisten', params: { mode: 'voice', t: String(Date.now()) } })} style={styles.mic}>
              <Icon name="mic" size={20} color="#7A3412" strokeWidth={2.2} />
            </PressableScale>
          </GlassBlur>
        </View>
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <RoundBtn icon="bell" label="Coba pulau notifikasi" onPress={demoIsland} />
            <RoundBtn icon="menu" label="Buka menu" onPress={() => setMenu(true)} />
          </View>
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
            <PressableScale key={c.label} accessibilityLabel={c.label} onPress={() => router.navigate(c.href)} style={styles.cardWrap}>
              {c.hot ? (
                <View style={[styles.card, styles.cardHot]}>
                  <View style={[styles.cardIcon, styles.cardIconHot]}>
                    <Icon name={c.icon} size={22} color="#FFFFFF" />
                  </View>
                  <T pixel size={22} numberOfLines={1} maxFontSizeMultiplier={1} style={{ marginTop: 'auto', color: color.ink }}>
                    {c.value}
                  </T>
                  <T size={12.5} weight="semibold" numberOfLines={2} style={{ marginTop: 3, color: 'rgba(26,10,4,0.7)' }}>
                    {c.label}
                  </T>
                </View>
              ) : (
                <Glass style={styles.card}>
                  <Glass strong style={styles.cardIcon}>
                    <Icon name={c.icon} size={22} color="#FFFFFF" />
                  </Glass>
                  <T pixel size={22} numberOfLines={1} maxFontSizeMultiplier={1} style={{ marginTop: 'auto' }}>
                    {c.value}
                  </T>
                  <T size={12.5} weight="semibold" numberOfLines={2} style={{ marginTop: 3, color: color.muted }}>
                    {c.label}
                  </T>
                </Glass>
              )}
            </PressableScale>
          ))}
        </ScrollView>
      </FadeIn>

      {drafts.count > 0 ? (
        <FadeIn delay={180}>
          <Glass style={styles.sugCard}>
            <T size={11} weight="heavy" style={{ letterSpacing: 1, color: color.accentSoft }}>
              ASISTEN MENYARANKAN
            </T>
            <T size={15} weight="semibold" style={{ marginTop: 6, lineHeight: 21 }}>
              {`Ada ${drafts.count} tugas dari rekaman yang belum Anda konfirmasi. Tinjau sekarang supaya bisa dipasang sebagai pengingat?`}
            </T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <PressableScale
                accessibilityLabel="Tinjau tugas"
                onPress={() => drafts.recordingId && router.navigate({ pathname: '/detail', params: { id: drafts.recordingId } })}
                style={styles.sugYes}
              >
                <T size={13} weight="heavy" style={{ color: color.ink }}>
                  Tinjau
                </T>
              </PressableScale>
            </View>
          </Glass>
        </FadeIn>
      ) : null}

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
  cardWrap: { width: 132, height: 132, borderRadius: radius.md },
  card: { flex: 1, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(40,10,2,0.22)' },
  cardHot: { backgroundColor: '#FFFFFF' },
  cardIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardIconHot: { backgroundColor: '#2A1208' },
  section: { marginTop: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  more: { paddingVertical: 12, alignItems: 'center' },
  composerWrap: { width: '100%', maxWidth: 560, borderRadius: radius.pill },
  composer: { height: 58, borderRadius: radius.pill, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  qInput: { flex: 1, height: 46, color: '#FFFFFF', fontFamily: font.semibold, fontSize: 15, paddingLeft: 14, paddingRight: 8 },
  sendB: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  spark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sugCard: { marginTop: 12, borderRadius: 26, padding: 18, backgroundColor: 'rgba(26,6,0,0.3)' },
  sugYes: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF' },
  mic: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: '#FFE9D9', alignItems: 'center', justifyContent: 'center' },
});
