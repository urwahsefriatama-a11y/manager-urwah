// Detail rekaman: proses AI, ringkasan, transkrip, pembicara, tugas temuan AI, dan tanya isi rekaman.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { Markdown } from '../src/ui/Markdown';
import { PressableScale } from '../src/ui/PressableScale';
import { Sheet } from '../src/ui/Sheet';
import { TimePicker } from '../src/ui/forms';
import { Chip, Empty, FadeIn, Field, GhostBtn, Header, PrimaryBtn } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import {
  chunksOf,
  draftTasksOf,
  getRecording,
  marksOf,
  mergeSpeakers,
  qaOf,
  renameSpeaker,
  saveQa,
  segmentsOf,
  speakersOf,
  type Chunk,
  type Segment,
  type Speaker,
} from '../src/data/recordings';
import { confirmDraft, dismissDraft } from '../src/data/tasks';
import { askRecordings } from '../src/lib/ai';
import { hasKey } from '../src/lib/gemini';
import { processRecording, type Progress } from '../src/lib/process';
import { ensurePermission } from '../src/lib/notify';
import { dayDateTime, duration, hourOfDay, nextAtWib, shortDateTime, todayAtWib } from '../src/lib/time';
import { success } from '../src/lib/haptics';

type Tab = 'ringkasan' | 'transkrip' | 'pembicara' | 'tugas' | 'tanya';
const TABS: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'transkrip', label: 'Transkrip' },
  { key: 'pembicara', label: 'Pembicara' },
  { key: 'tugas', label: 'Tugas' },
  { key: 'tanya', label: 'Tanya' },
];

function mmss(ms: number) {
  return duration(Math.floor(ms / 1000));
}

/** Cari potongan audio yang memuat waktu `ms` (waktu dihitung dari awal rekaman). */
function locate(chunks: Chunk[], ms: number) {
  let start = 0;
  for (const c of chunks) {
    const end = start + c.duration_sec * 1000;
    if (ms < end || c === chunks[chunks.length - 1]) return { chunk: c, sec: Math.max(0, (ms - start) / 1000) };
    start = end;
  }
  return null;
}

function Processing({ progress }: { progress: Progress }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const pct = Math.round((progress.done / Math.max(progress.total, 1)) * 100);
  return (
    <Glass strong style={styles.proc}>
      <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Icon name="spark" size={34} color={color.accentSoft} />
      </Animated.View>
      <T pixel size={44} style={{ marginTop: 10 }} maxFontSizeMultiplier={1}>{`${pct}%`}</T>
      <T size={14} muted style={{ textAlign: 'center', marginTop: 4 }}>
        {progress.step}
      </T>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <T size={12} muted style={{ marginTop: 10, textAlign: 'center' }}>
        Boleh tinggalkan layar ini sebentar, tapi jangan tutup app sampai selesai.
      </T>
    </Glass>
  );
}

export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [rec, setRec] = useState(() => (id ? getRecording(id) : null));
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [drafts, setDrafts] = useState<ReturnType<typeof draftTasksOf>>([]);
  const [qa, setQa] = useState<ReturnType<typeof qaOf>>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [editSpk, setEditSpk] = useState<Speaker | null>(null);
  const [spkName, setSpkName] = useState('');
  const [editTask, setEditTask] = useState<{ id: string; title: string; due: number | null } | null>(null);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);

  const chunks = useMemo(() => (id ? chunksOf(id) : []), [id]);
  const marks = useMemo(() => (id ? marksOf(id) : []), [id]);
  const player = useAudioPlayer(null);

  const reload = useCallback(() => {
    if (!id) return;
    setRec(getRecording(id));
    setSpeakers(speakersOf(id));
    setSegments(segmentsOf(id));
    setDrafts(draftTasksOf(id));
    setQa(qaOf(id));
  }, [id]);
  useFocusEffect(reload);

  useEffect(() => () => player.pause(), [player]);

  const nameOf = (sid: string | null) => {
    const s = speakers.find((x) => x.id === sid);
    return s ? s.display_name || `Pembicara ${s.label.replace(/^S/, '')}` : 'Pembicara';
  };

  const playAt = async (ms: number, key: string) => {
    const hit = locate(chunks, ms);
    if (!hit) return;
    if (nowPlaying === key && player.playing) {
      player.pause();
      setNowPlaying(null);
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    player.replace({ uri: hit.chunk.file_uri });
    await player.seekTo(Math.max(0, hit.sec - 1)).catch(() => {});
    player.play();
    setNowPlaying(key);
  };

  const run = async () => {
    if (!id) return;
    if (!(await hasKey())) {
      Alert.alert('Kunci Gemini belum diisi', 'Isi kunci Gemini di Pengaturan → Asisten AI terlebih dulu.');
      return;
    }
    setProgress({ step: 'Menyiapkan…', done: 0, total: 1 });
    try {
      await processRecording(id, setProgress);
      success();
      toast('Selesai. Ringkasan & transkrip siap.');
      setTab('ringkasan');
    } catch (e) {
      Alert.alert('Proses berhenti', e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
      reload();
    }
  };

  const ask = async () => {
    const q = question.trim();
    if (!id || !q || asking) return;
    setAsking(true);
    try {
      const transcript = segments.map((g) => `[${g.start_ms}] ${nameOf(g.speaker_id)}: ${g.text}`).join('\n');
      const res = await askRecordings(q, transcript);
      saveQa(id, q, res.answer, res.sources);
      setQuestion('');
      reload();
    } catch (e) {
      Alert.alert('Gagal bertanya', e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  };

  if (!rec) {
    return (
      <Screen bg="recordings">
        <Header title="Rekaman" />
        <Empty icon="file" text="Rekaman tidak ditemukan." />
      </Screen>
    );
  }

  const hasAi = segments.length > 0 || !!rec.summary_md;
  const pending = drafts.filter((d) => d.status === 'draft');

  return (
    <Screen bg="recordings">
      <Header title={rec.title} />
      <FadeIn>
        <T size={13} muted>
          {`${shortDateTime(rec.started_at)} · ${duration(rec.duration_sec)} · ${chunks.length} potongan${rec.speaker_count ? ` · ${rec.speaker_count} pembicara` : ''}`}
        </T>
      </FadeIn>

      {progress ? (
        <FadeIn delay={40} style={{ marginTop: 18 }}>
          <Processing progress={progress} />
        </FadeIn>
      ) : !hasAi ? (
        <FadeIn delay={60} style={{ marginTop: 18 }}>
          <Glass strong style={styles.cta}>
            <Icon name="spark" size={30} color={color.accentSoft} />
            <T size={17} weight="heavy" style={{ marginTop: 10 }}>
              Jadikan transkrip & ringkasan
            </T>
            <T size={13.5} muted style={{ textAlign: 'center', marginTop: 6, marginBottom: 16 }}>
              Gemini menulis transkrip (Indonesia/Arab/Inggris), menghitung pembicara, merangkum, dan mencari tugas. Tugas baru dipasang setelah Anda setujui.
            </T>
            <View style={{ alignSelf: 'stretch' }}>
              <PrimaryBtn label="Proses dengan AI" onPress={run} />
            </View>
          </Glass>
        </FadeIn>
      ) : (
        <>
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <Chip
                key={t.key}
                label={t.key === 'tugas' && pending.length ? `${t.label} ${pending.length}` : t.label}
                on={tab === t.key}
                onPress={() => setTab(t.key)}
              />
            ))}
          </View>

          {tab === 'ringkasan' ? (
            <FadeIn key="r">
              <Glass style={styles.card}>{rec.summary_md ? <Markdown text={rec.summary_md} /> : <T muted>Ringkasan belum ada.</T>}</Glass>
              {marks.length ? (
                <Glass style={[styles.card, { marginTop: 12 }]}>
                  <T size={13} weight="heavy" muted style={{ marginBottom: 8 }}>
                    PENANDA
                  </T>
                  {marks.map((m) => (
                    <PressableScale key={m.id} accessibilityLabel={`Putar penanda ${mmss(m.at_ms)}`} onPress={() => playAt(m.at_ms, m.id)} style={styles.markRow}>
                      <Icon name={nowPlaying === m.id ? 'pause' : 'flag'} size={16} />
                      <T pixel size={15} maxFontSizeMultiplier={1}>
                        {mmss(m.at_ms)}
                      </T>
                    </PressableScale>
                  ))}
                </Glass>
              ) : null}
              <View style={{ marginTop: 14 }}>
                <GhostBtn
                  label="Proses ulang"
                  icon="refresh"
                  onPress={() =>
                    Alert.alert('Proses ulang?', 'Ringkasan dibuat lagi. Transkrip yang sudah ada dipakai ulang.', [
                      { text: 'Batal', style: 'cancel' },
                      { text: 'Proses', onPress: run },
                    ])
                  }
                />
              </View>
            </FadeIn>
          ) : null}

          {tab === 'transkrip' ? (
            <FadeIn key="t" style={{ gap: 10 }}>
              {segments.length === 0 ? <Empty icon="file" text="Transkrip belum ada." /> : null}
              {segments.map((g) => (
                <PressableScale key={g.id} accessibilityLabel="Putar kalimat ini" onPress={() => playAt(g.start_ms, g.id)} style={styles.segWrap} depth={0.97}>
                  <Glass style={styles.seg}>
                    <View style={styles.segHead}>
                      <T size={12.5} weight="heavy" style={{ color: color.accentSoft }}>
                        {nameOf(g.speaker_id)}
                      </T>
                      <View style={styles.segTime}>
                        <Icon name={nowPlaying === g.id ? 'pause' : 'play'} size={11} />
                        <T pixel size={13} maxFontSizeMultiplier={1}>
                          {mmss(g.start_ms)}
                        </T>
                      </View>
                    </View>
                    <T size={15} style={{ lineHeight: 22 }}>
                      {g.text}
                    </T>
                  </Glass>
                </PressableScale>
              ))}
            </FadeIn>
          ) : null}

          {tab === 'pembicara' ? (
            <FadeIn key="p" style={{ gap: 10 }}>
              <T size={13} muted>
                Ketuk ▶ untuk mendengar contoh suara, lalu beri nama. Bila satu orang terpecah jadi dua, pakai "Gabung".
              </T>
              {speakers.map((s) => {
                const first = segments.find((g) => g.speaker_id === s.id);
                const count = segments.filter((g) => g.speaker_id === s.id).length;
                return (
                  <Glass key={s.id} style={styles.spk}>
                    <PressableScale
                      accessibilityLabel="Dengar contoh suara"
                      onPress={() => first && playAt(first.start_ms, `s-${s.id}`)}
                      style={styles.spkPlay}
                    >
                      <Icon name={nowPlaying === `s-${s.id}` ? 'pause' : 'play'} size={16} color={color.ink} />
                    </PressableScale>
                    <View style={{ flex: 1 }}>
                      <T size={15} weight="bold" numberOfLines={1}>
                        {nameOf(s.id)}
                      </T>
                      <T size={12} muted>{`${count} kalimat`}</T>
                    </View>
                    <PressableScale
                      accessibilityLabel="Ganti nama"
                      onPress={() => {
                        setEditSpk(s);
                        setSpkName(s.display_name ?? '');
                      }}
                      style={styles.spkBtn}
                    >
                      <Icon name="edit" size={18} />
                    </PressableScale>
                    {speakers.length > 1 ? (
                      <PressableScale
                        accessibilityLabel="Gabung dengan pembicara lain"
                        onPress={() =>
                          Alert.alert(
                            `Gabungkan ${nameOf(s.id)} ke…`,
                            undefined,
                            [
                              ...speakers
                                .filter((o) => o.id !== s.id)
                                .slice(0, 3)
                                .map((o) => ({
                                  text: nameOf(o.id),
                                  onPress: () => {
                                    mergeSpeakers(s.id, o.id);
                                    toast('Pembicara digabung.');
                                    reload();
                                  },
                                })),
                              { text: 'Batal', style: 'cancel' as const },
                            ],
                          )
                        }
                        style={styles.spkBtn}
                      >
                        <Icon name="merge" size={18} />
                      </PressableScale>
                    ) : null}
                  </Glass>
                );
              })}
            </FadeIn>
          ) : null}

          {tab === 'tugas' ? (
            <FadeIn key="g" style={{ gap: 10 }}>
              {drafts.length === 0 ? <Empty icon="task" text="AI tidak menemukan tugas di rekaman ini." /> : null}
              {drafts.map((d) => (
                <Glass key={d.id} style={styles.draft}>
                  <T size={15} weight="bold">
                    {d.title}
                  </T>
                  <T size={12.5} muted style={{ marginTop: 3 }}>
                    {[d.assignee ? `Untuk ${d.assignee}` : null, d.due_at ? dayDateTime(d.due_at) : 'Tanpa tenggat'].filter(Boolean).join(' · ')}
                  </T>
                  {d.status === 'draft' ? (
                    <View style={styles.draftBtns}>
                      <View style={{ flex: 1 }}>
                        <GhostBtn
                          label="Abaikan"
                          onPress={() => {
                            dismissDraft(d.id);
                            reload();
                          }}
                        />
                      </View>
                      <View style={{ flex: 1.4 }}>
                        <PrimaryBtn label="Periksa & pasang" onPress={() => setEditTask({ id: d.id, title: d.title, due: d.due_at })} />
                      </View>
                    </View>
                  ) : (
                    <T size={12.5} weight="bold" style={{ marginTop: 8, color: d.status === 'dismissed' ? color.faint : color.ok }}>
                      {d.status === 'dismissed' ? 'Diabaikan' : 'Sudah dipasang sebagai pengingat'}
                    </T>
                  )}
                </Glass>
              ))}
            </FadeIn>
          ) : null}

          {tab === 'tanya' ? (
            <FadeIn key="q" style={{ gap: 10 }}>
              <Field value={question} onChangeText={setQuestion} placeholder="Contoh: Apa keputusan soal anggaran?" returnKeyType="send" onSubmitEditing={ask} />
              <PrimaryBtn label={asking ? 'Mencari jawaban…' : 'Tanya'} onPress={ask} disabled={!question.trim() || asking} />
              {asking ? <ActivityIndicator color="#FFFFFF" style={{ marginTop: 8 }} /> : null}
              {qa.map((x) => {
                const src = (x.sources_json ? (JSON.parse(x.sources_json) as { start_ms: number }[]) : []).slice(0, 4);
                return (
                  <Glass key={x.id} style={styles.card}>
                    <T size={13} weight="heavy" style={{ color: color.accentSoft }}>
                      {x.question}
                    </T>
                    <View style={{ marginTop: 6 }}>
                      <Markdown text={x.answer} size={14.5} />
                    </View>
                    {src.length ? (
                      <View style={styles.srcRow}>
                        {src.map((s, i) => (
                          <PressableScale key={i} accessibilityLabel={`Putar sumber ${mmss(s.start_ms)}`} onPress={() => playAt(s.start_ms, `${x.id}-${i}`)} style={styles.src}>
                            <Icon name="play" size={10} />
                            <T pixel size={12} maxFontSizeMultiplier={1}>
                              {mmss(s.start_ms)}
                            </T>
                          </PressableScale>
                        ))}
                      </View>
                    ) : null}
                  </Glass>
                );
              })}
            </FadeIn>
          ) : null}
        </>
      )}

      <Sheet open={!!editSpk} onClose={() => setEditSpk(null)} title="Nama pembicara">
        <Field value={spkName} onChangeText={setSpkName} placeholder="Contoh: Ust. Hanif" autoFocus />
        <View style={{ marginTop: 14 }}>
          <PrimaryBtn
            label="Simpan nama"
            onPress={() => {
              if (editSpk) renameSpeaker(editSpk.id, spkName);
              setEditSpk(null);
              reload();
            }}
          />
        </View>
      </Sheet>

      <ConfirmTaskSheet
        draft={editTask}
        onClose={() => setEditTask(null)}
        onDone={(msg) => {
          toast(msg);
          reload();
        }}
      />
    </Screen>
  );
}

function ConfirmTaskSheet({
  draft,
  onClose,
  onDone,
}: {
  draft: { id: string; title: string; due: number | null } | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [withTime, setWithTime] = useState(false);
  const [day, setDay] = useState<'today' | 'tomorrow' | 'ai'>('tomorrow');
  const [t, setT] = useState({ h: 9, m: 0 });

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setWithTime(true);
    if (draft.due && draft.due > Date.now()) {
      setDay('ai');
      const h = hourOfDay(draft.due);
      setT({ h: Math.floor(h), m: Math.round((h % 1) * 60) % 60 });
    } else {
      setDay('tomorrow');
      setT({ h: 9, m: 0 });
    }
  }, [draft]);

  const at = () => {
    if (!withTime) return null;
    if (day === 'ai' && draft?.due) {
      const base = todayAtWib(0, 0, draft.due);
      return base + (t.h * 60 + t.m) * 60000;
    }
    if (day === 'today') return todayAtWib(t.h, t.m);
    return nextAtWib(t.h, t.m, todayAtWib(23, 59) + 60000);
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title="Pasang tugas">
      <Field value={title} onChangeText={setTitle} />
      <View style={styles.chipRow}>
        <Chip label="Tanpa jam" on={!withTime} onPress={() => setWithTime(false)} />
        {draft?.due && draft.due > Date.now() ? <Chip label={`Saran AI`} on={withTime && day === 'ai'} onPress={() => { setWithTime(true); setDay('ai'); }} /> : null}
        <Chip label="Hari ini" on={withTime && day === 'today'} onPress={() => { setWithTime(true); setDay('today'); }} />
        <Chip label="Besok" on={withTime && day === 'tomorrow'} onPress={() => { setWithTime(true); setDay('tomorrow'); }} />
      </View>
      {withTime ? <TimePicker hour={t.h} minute={t.m} onChange={(h, m) => setT({ h, m })} /> : null}
      <View style={{ marginTop: 16 }}>
        <PrimaryBtn
          label="Pasang pengingat"
          disabled={!title.trim()}
          onPress={async () => {
            if (!draft) return;
            const due = at();
            if (due) await ensurePermission();
            await confirmDraft(draft.id, title.trim(), due);
            onClose();
            onDone(due ? `Dipasang: ${dayDateTime(due)}.` : 'Tugas ditambahkan.');
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  proc: { borderRadius: radius.xl, padding: 24, alignItems: 'center' },
  bar: { alignSelf: 'stretch', height: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 16, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 6, backgroundColor: '#FFFFFF' },
  cta: { borderRadius: radius.xl, padding: 22, alignItems: 'center' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 14 },
  card: { borderRadius: radius.lg, padding: 18 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderRadius: 12 },
  segWrap: { borderRadius: radius.md },
  seg: { borderRadius: radius.md, padding: 14 },
  segHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  segTime: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  spk: { borderRadius: radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  spkPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  spkBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  draft: { borderRadius: radius.lg, padding: 16 },
  draftBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  srcRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  src: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
});
