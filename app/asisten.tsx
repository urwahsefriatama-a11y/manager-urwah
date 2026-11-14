// Asisten AI: tanya apa saja, lampirkan PDF/Markdown/foto, atau bicara.
// Permintaan "ingatkan…" muncul sebagai kartu yang Anda setujui dulu sebelum dipasang.
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../src/ui/T';
import { Glass, GlassBlur } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { Markdown } from '../src/ui/Markdown';
import { PressableScale } from '../src/ui/PressableScale';
import { FadeIn, Header, IconTile } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { backgrounds, color, font, MAX_CONTENT_WIDTH, radius } from '../src/ui/theme';
import { addChat, clearChat, listChat, setActionState, type Attachment, type ChatMsg } from '../src/data/extra';
import { addTask } from '../src/data/tasks';
import { askAssistant, type AssistantAction } from '../src/lib/ai';
import { hasKey, inlinePart, mimeOf, type Part, type Turn } from '../src/lib/gemini';
import { ensurePermission } from '../src/lib/notify';
import { dayDateTime, duration, greetingWord, isoWib } from '../src/lib/time';
import { getSetting } from '../src/data/settings';
import { success } from '../src/lib/haptics';

const SUGGEST = ['Bantu susun rencana pekan ini', 'Ingatkan saya rapat yayasan besok jam 9', 'Analisa masalah: penjualan kopi turun', 'Ringkas dokumen yang saya lampirkan'];

/** Lampiran → bagian pesan Gemini. Teks (MD/TXT) dikirim sebagai teks, sisanya base64. */
async function toParts(atts: Attachment[]): Promise<Part[]> {
  const out: Part[] = [];
  for (const a of atts) {
    try {
      if (a.mime.startsWith('text/')) out.push({ text: `Isi file "${a.name}":\n${(await new File(a.uri).text()).slice(0, 60000)}` });
      else out.push(await inlinePart(a.uri, a.mime));
    } catch {
      out.push({ text: `(Lampiran "${a.name}" tidak bisa dibaca lagi.)` });
    }
  }
  return out;
}

function Bubble({ m, onAction }: { m: ChatMsg; onAction: (i: number, act: AssistantAction, ok: boolean) => void }) {
  const mine = m.role === 'user';
  const acts = m.actions as (AssistantAction & { state?: string })[];
  return (
    <FadeIn style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : null]}>
      {mine ? (
        <View style={styles.mine}>
          {m.attachments.map((a) => (
            <View key={a.uri} style={styles.attChip}>
              <Icon name={a.mime.startsWith('audio') ? 'mic' : 'attach'} size={13} color={color.ink} />
              <T size={12} weight="bold" style={{ color: color.ink }} numberOfLines={1}>
                {a.name}
              </T>
            </View>
          ))}
          {m.text ? (
            <T size={15} style={{ color: color.ink, lineHeight: 21 }}>
              {m.text}
            </T>
          ) : null}
        </View>
      ) : (
        <Glass style={styles.theirs}>
          <Markdown text={m.text} size={15} />
          {acts.map((a, i) => (
            <View key={i} style={styles.action}>
              <IconTile icon={a.type === 'reminder' ? 'bell' : 'task'} size={38} />
              <View style={{ flex: 1 }}>
                <T size={14} weight="bold" numberOfLines={2}>
                  {a.title}
                </T>
                <T size={12} muted>
                  {a.type === 'reminder' && a.at_iso ? dayDateTime(Date.parse(a.at_iso)) : 'Tugas tanpa jam'}
                </T>
              </View>
              {a.state ? (
                <T size={12} weight="bold" style={{ color: a.state === 'done' ? color.ok : color.faint }}>
                  {a.state === 'done' ? 'Terpasang' : 'Diabaikan'}
                </T>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PressableScale accessibilityLabel="Abaikan" onPress={() => onAction(i, a, false)} style={styles.actNo}>
                    <Icon name="close" size={16} />
                  </PressableScale>
                  <PressableScale accessibilityLabel="Pasang" onPress={() => onAction(i, a, true)} style={styles.actYes}>
                    <Icon name="check" size={16} color={color.ink} strokeWidth={2.6} />
                  </PressableScale>
                </View>
              )}
            </View>
          ))}
        </Glass>
      )}
    </FadeIn>
  );
}

/** Tiga titik bernapas saat asisten berpikir. */
function Thinking() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Glass style={[styles.theirs, { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', paddingVertical: 16 }]}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: v.interpolate({ inputRange: [0, 0.33 * i + 0.01, 0.33 * i + 0.33, 1], outputRange: [0.3, 0.3, 1, 0.3], extrapolate: 'clamp' }),
            },
          ]}
        />
      ))}
    </Glass>
  );
}

export default function Asisten() {
  const inset = useSafeAreaInsets();
  const toast = useToast();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(false);
  // AAC (ADTS) agar langsung dikenali Gemini.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    extension: '.aac',
    numberOfChannels: 1,
    bitRate: 64000,
    android: { outputFormat: 'aac_adts', audioEncoder: 'aac' },
    isMeteringEnabled: true,
  });
  const recState = useAudioRecorderState(recorder, 120);
  const pulse = useRef(new Animated.Value(0)).current;

  const reload = useCallback(() => setMsgs(listChat()), []);
  useFocusEffect(reload);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
  }, [msgs.length, busy]);

  useEffect(() => {
    const m = recState.metering ?? -60;
    const lvl = Math.max(0, Math.min(1, (m + 55) / 50));
    Animated.timing(pulse, { toValue: voice ? lvl : 0, duration: 110, useNativeDriver: true }).start();
  }, [recState.metering, voice, pulse]);

  const send = async (override?: string, extra: Attachment[] = []) => {
    const q = (override ?? text).trim();
    const files = [...atts, ...extra];
    if ((!q && files.length === 0) || busy) return;
    if (!(await hasKey())) {
      Alert.alert('Kunci Gemini belum diisi', 'Isi kunci Gemini di Pengaturan → Asisten AI terlebih dulu.');
      return;
    }
    addChat('user', q, files);
    setText('');
    setAtts([]);
    reload();
    setBusy(true);
    try {
      // Kirim 16 pesan terakhir; lampiran hanya dari 6 pesan terakhir agar hemat kuota.
      const recent = listChat().slice(-16);
      const turns: Turn[] = [];
      for (let i = 0; i < recent.length; i++) {
        const m = recent[i];
        const parts: Part[] = [];
        if (m.role === 'user' && m.attachments.length && i >= recent.length - 6) parts.push(...(await toParts(m.attachments)));
        parts.push({ text: m.text || (m.attachments.some((a) => a.mime.startsWith('audio')) ? 'Dengarkan pesan suara saya lalu tanggapi.' : 'Lihat lampiran.') });
        const prev = turns[turns.length - 1];
        if (prev && prev.role === m.role) prev.parts.push(...parts);
        else turns.push({ role: m.role, parts });
      }
      while (turns.length && turns[0].role === 'model') turns.shift(); // Gemini: giliran pertama harus pengguna
      const res = await askAssistant(turns, isoWib());
      addChat('model', res.reply || 'Maaf, saya belum bisa menjawab itu.', [], res.actions);
    } catch (e) {
      addChat('model', `⚠️ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      reload();
    }
  };

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/markdown', 'text/plain', 'text/x-markdown', 'image/*', 'application/octet-stream'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (r.canceled) return;
    const add = r.assets.map((a) => {
      let mime = a.mimeType && a.mimeType !== 'application/octet-stream' ? a.mimeType : mimeOf(a.name, 'text/plain');
      if (mime === 'text/x-markdown' || mime === 'text/markdown') mime = 'text/markdown';
      return { name: a.name, mime, uri: a.uri };
    });
    const bad = add.find((a) => !(a.mime === 'application/pdf' || a.mime.startsWith('text/') || a.mime.startsWith('image/')));
    if (bad) toast(`${bad.name}: hanya PDF, Markdown, teks, atau gambar.`);
    setAtts((x) => [...x, ...add.filter((a) => a !== bad)].slice(0, 5));
  };

  const startVoice = async () => {
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) {
      toast('Izin mikrofon belum diberikan.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setVoice(true);
  };

  const stopVoice = async (sendIt: boolean) => {
    await recorder.stop();
    setVoice(false);
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    if (!sendIt || !uri) return;
    success();
    send(text, [{ name: `Suara ${duration(Math.round(recState.durationMillis / 1000))}`, mime: mimeOf(uri, 'audio/aac'), uri }]);
  };

  const onAction = async (msg: ChatMsg, i: number, a: AssistantAction, ok: boolean) => {
    if (ok) {
      if (a.type === 'reminder') {
        const at = Date.parse(a.at_iso);
        if (!Number.isFinite(at) || at < Date.now()) {
          toast('Waktunya sudah lewat atau tidak jelas. Tambahkan lewat Tugas.');
          return;
        }
        await ensurePermission();
        await addTask(a.title, at);
        toast(`Pengingat dipasang: ${dayDateTime(at)}.`);
      } else {
        await addTask(a.title, null);
        toast('Tugas ditambahkan.');
      }
      success();
    }
    setActionState(msg.id, i, ok ? 'done' : 'skip');
    reload();
  };

  const g = backgrounds.soon;
  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={g.colors} locations={g.locations} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.head, { paddingTop: inset.top + 14 }]}>
          <View style={styles.inner}>
            <Header
              title="Asisten"
              right={
                msgs.length ? (
                  <PressableScale
                    accessibilityLabel="Mulai percakapan baru"
                    onPress={() =>
                      Alert.alert('Percakapan baru?', 'Riwayat percakapan ini dihapus.', [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Hapus', style: 'destructive', onPress: () => { clearChat(); reload(); } },
                      ])
                    }
                    style={styles.newBtn}
                  >
                    <Icon name="refresh" size={18} />
                  </PressableScale>
                ) : null
              }
            />
          </View>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            {msgs.length === 0 ? (
              <FadeIn style={{ marginTop: 20 }}>
                <IconTile icon="spark" size={64} />
                <T size={26} weight="heavy" style={{ marginTop: 16 }}>
                  {`${greetingWord()}, ${getSetting('name') || 'Urwah'}.`}
                </T>
                <T size={15} muted style={{ marginTop: 6, marginBottom: 20 }}>
                  Ceritakan masalah, minta diingatkan, atau lampirkan PDF/Markdown untuk dianalisa.
                </T>
                <View style={{ gap: 10 }}>
                  {SUGGEST.map((s, i) => (
                    <FadeIn key={s} delay={80 + i * 60}>
                      <PressableScale accessibilityLabel={s} onPress={() => (s.startsWith('Ringkas') ? pick() : send(s))} style={styles.sugWrap}>
                        <Glass style={styles.sug}>
                          <T size={14.5} weight="semibold" style={{ flex: 1 }}>
                            {s}
                          </T>
                          <Icon name="chev" size={18} color={color.muted} />
                        </Glass>
                      </PressableScale>
                    </FadeIn>
                  ))}
                </View>
              </FadeIn>
            ) : (
              <View style={{ gap: 12 }}>
                {msgs.map((m) => (
                  <Bubble key={m.id} m={m} onAction={(i, a, ok) => onAction(m, i, a, ok)} />
                ))}
                {busy ? <Thinking /> : null}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.foot, { paddingBottom: inset.bottom + 10 }]}>
          <View style={styles.inner}>
            {atts.length ? (
              <View style={styles.attRow}>
                {atts.map((a) => (
                  <PressableScale key={a.uri} accessibilityLabel={`Lepas ${a.name}`} onPress={() => setAtts((x) => x.filter((y) => y !== a))} style={styles.attPill}>
                    <Icon name="attach" size={13} />
                    <T size={12} weight="bold" numberOfLines={1} style={{ maxWidth: 140 }}>
                      {a.name}
                    </T>
                    <Icon name="close" size={12} />
                  </PressableScale>
                ))}
              </View>
            ) : null}
            {voice ? (
              <GlassBlur style={styles.composer}>
                <PressableScale accessibilityLabel="Batal" onPress={() => stopVoice(false)} style={styles.cBtn}>
                  <Icon name="close" size={20} />
                </PressableScale>
                <View style={styles.voiceMid}>
                  <Animated.View style={[styles.voiceRing, { transform: [{ scale: ring }] }]} />
                  <View style={styles.voiceDot} />
                  <T pixel size={18} style={{ marginLeft: 14 }} maxFontSizeMultiplier={1}>
                    {duration(Math.round(recState.durationMillis / 1000))}
                  </T>
                  <T size={13} muted style={{ marginLeft: 10 }}>
                    Mendengarkan…
                  </T>
                </View>
                <PressableScale accessibilityLabel="Kirim suara" onPress={() => stopVoice(true)} style={styles.sendBtn}>
                  <Icon name="send" size={19} color={color.ink} strokeWidth={2.3} />
                </PressableScale>
              </GlassBlur>
            ) : (
              <GlassBlur style={styles.composer}>
                <PressableScale accessibilityLabel="Lampirkan PDF, Markdown, atau gambar" onPress={pick} style={styles.cBtn}>
                  <Icon name="attach" size={20} />
                </PressableScale>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Tanya asisten…"
                  placeholderTextColor={color.faint}
                  style={styles.input}
                  multiline
                  maxFontSizeMultiplier={1.3}
                />
                {text.trim() || atts.length ? (
                  <PressableScale accessibilityLabel="Kirim" onPress={() => send()} disabled={busy} style={styles.sendBtn}>
                    {busy ? <ActivityIndicator color={color.ink} /> : <Icon name="send" size={19} color={color.ink} strokeWidth={2.3} />}
                  </PressableScale>
                ) : (
                  <PressableScale accessibilityLabel="Bicara" onPress={startVoice} disabled={busy} style={styles.sendBtn}>
                    <Icon name="mic" size={20} color={color.ink} strokeWidth={2.3} />
                  </PressableScale>
                )}
              </GlassBlur>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0505' },
  head: { paddingHorizontal: 20, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, alignItems: 'center' },
  newBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  sugWrap: { borderRadius: radius.lg },
  sug: { borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  mine: { maxWidth: '86%', backgroundColor: '#FFFFFF', borderRadius: 22, borderBottomRightRadius: 8, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  theirs: { maxWidth: '94%', borderRadius: 22, borderBottomLeftRadius: 8, padding: 14 },
  attChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(26,10,4,0.08)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  actNo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  actYes: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  foot: { paddingHorizontal: 14, paddingTop: 6, alignItems: 'center' },
  attRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  attPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  composer: { borderRadius: 30, minHeight: 60, flexDirection: 'row', alignItems: 'flex-end', padding: 7, gap: 6 },
  cBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, color: '#FFFFFF', fontFamily: font.semibold, fontSize: 16, maxHeight: 130, paddingVertical: 12, paddingHorizontal: 4 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  voiceMid: { flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  voiceRing: { position: 'absolute', left: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,120,90,0.35)' },
  voiceDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 6, backgroundColor: '#FF8A6E' },
});
