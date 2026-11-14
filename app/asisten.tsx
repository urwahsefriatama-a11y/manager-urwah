// Asisten: tiga tampilan seperti prototipe — mulai, bicara (suara langsung), dan obrolan.
// Otak: Claude (bila kuncinya diisi) dengan akses data app, kalender, kontak, dan Google Drive.
// Semua perubahan (pengingat, tugas, alarm, acara, catatan, chat WA) muncul sebagai kartu yang disetujui dulu.
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, KeyboardAvoidingView, Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { Markdown } from '../src/ui/Markdown';
import { Orb } from '../src/ui/Orb';
import { Backdrop } from '../src/ui/Backdrop';
import { PressableScale } from '../src/ui/PressableScale';
import { FadeIn, IconTile } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, font, MAX_CONTENT_WIDTH } from '../src/ui/theme';
import { addChat, clearChat, listChat, normalizePhone, saveNote, setActionState, type Attachment, type ChatMsg } from '../src/data/extra';
import { addTask } from '../src/data/tasks';
import { addAlarm } from '../src/data/alarms';
import { askAssistant, brainName, hasAnyKey, type AssistantAction } from '../src/lib/ai';
import { inlinePart, mimeOf, type Part, type Turn } from '../src/lib/gemini';
import { createCalendarEvent } from '../src/lib/calendar';
import { ensurePermission } from '../src/lib/notify';
import { dayDateTime, greetingWord, hourOfDay, isoWib } from '../src/lib/time';
import { getSetting } from '../src/data/settings';
import { success } from '../src/lib/haptics';
import { hush, listen, release, say, speakOn, speechReady, stopListen, stopWake } from '../src/lib/voice';
import type { SpeechEvent } from '../modules/urwah-native/src';

const SUGGEST = ['Apa saja agenda saya hari ini?', 'Ingatkan saya rapat yayasan besok jam 9', 'Analisa masalah: penjualan kopi turun', 'Ringkas dokumen yang saya lampirkan'];
const STEP_LABEL: Record<string, string> = {
  list_tasks: 'Membaca daftar tugas',
  list_alarms: 'Membaca alarm',
  prayer_times: 'Mengecek jadwal shalat',
  list_notes: 'Membaca catatan',
  search_recordings: 'Mencari di rekaman',
  list_wa_templates: 'Membaca template WA',
  calendar_events: 'Membuka kalender',
  search_contacts: 'Mencari kontak',
  drive_search: 'Mencari di Google Drive',
  drive_read: 'Membaca file Drive',
  propose: 'Menyiapkan aksi',
};

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

function kindOf(mime: string) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'IMG';
  return 'MD';
}

function ActionCard({ a, onAnswer }: { a: AssistantAction & { state?: string }; onAnswer: (ok: boolean) => void }) {
  const icon = a.type === 'reminder' ? 'bell' : a.type === 'alarm' ? 'alarm' : a.type === 'event' ? 'calendar' : a.type === 'note' ? 'note' : a.type === 'whatsapp' ? 'chat' : 'task';
  const when = a.at_iso && Number.isFinite(Date.parse(a.at_iso)) ? dayDateTime(Date.parse(a.at_iso)) : '';
  const kind = { reminder: 'Pengingat', task: 'Tugas', alarm: 'Alarm', event: 'Acara kalender', note: 'Catatan', whatsapp: 'Chat WhatsApp' }[a.type] ?? 'Aksi';
  return (
    <Glass style={styles.actCard}>
      <T size={12} weight="heavy" style={{ color: color.accentSoft, letterSpacing: 1 }}>
        AKSI YANG DISIAPKAN · {kind.toUpperCase()}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <IconTile icon={icon} size={40} />
        <View style={{ flex: 1 }}>
          <T size={16} weight="heavy" numberOfLines={2}>
            {a.title}
          </T>
          <T size={13} muted numberOfLines={3}>
            {[when, a.contact_name, a.body].filter(Boolean).join(' · ') || 'Tanpa waktu'}
          </T>
        </View>
      </View>
      {a.state ? (
        <T size={14} weight="bold" style={{ marginTop: 12, color: a.state === 'done' ? color.ok : color.faint }}>
          {a.state === 'done' ? 'Terpasang.' : 'Diabaikan.'}
        </T>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <PressableScale accessibilityLabel="Abaikan" onPress={() => onAnswer(false)} style={styles.actNo}>
            <Icon name="close" size={18} />
          </PressableScale>
          <PressableScale accessibilityLabel="Setujui" onPress={() => onAnswer(true)} style={styles.actYes}>
            <T size={15} weight="heavy" style={{ color: color.ink }}>
              Setujui
            </T>
          </PressableScale>
        </View>
      )}
    </Glass>
  );
}

function Bubble({ m, onAction }: { m: ChatMsg; onAction: (i: number, a: AssistantAction, ok: boolean) => void }) {
  if (m.role === 'user') {
    return (
      <FadeIn style={{ alignItems: 'flex-end' }}>
        <View style={styles.me}>
          {m.attachments.map((a) => (
            <View key={a.uri} style={styles.meAtt}>
              <Icon name={a.mime.startsWith('audio') ? 'mic' : 'attach'} size={13} color={color.ink} />
              <T size={12} weight="bold" style={{ color: color.ink }} numberOfLines={1}>
                {a.name}
              </T>
            </View>
          ))}
          {m.text ? (
            <T size={15} style={{ color: color.ink, lineHeight: 22 }}>
              {m.text}
            </T>
          ) : null}
        </View>
      </FadeIn>
    );
  }
  const acts = m.actions as (AssistantAction & { state?: string })[];
  return (
    <FadeIn style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Orb size={26} kind="sun" glow={false} style={{ marginTop: 4 }} />
      <View style={{ flex: 1, gap: 10 }}>
        <View style={styles.ai}>
          <Markdown text={m.text} size={15} />
        </View>
        {acts.map((a, i) => (
          <ActionCard key={i} a={a} onAnswer={(ok) => onAction(i, a, ok)} />
        ))}
      </View>
    </FadeIn>
  );
}

function Thinking({ steps }: { steps: string[] }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Orb size={26} kind="sun" glow={false} style={{ marginTop: 4 }} />
      <View style={[styles.ai, { flex: 1 }]}>
        {steps.slice(-4).map((s, i, arr) => (
          <T key={`${s}${i}`} size={13} weight="bold" style={{ marginBottom: 6, color: i === arr.length - 1 ? '#FFB56B' : 'rgba(255,255,255,0.5)' }}>
            {s}
          </T>
        ))}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: steps.length ? 2 : 0 }}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: v.interpolate({ inputRange: [0, 0.33 * i + 0.01, 0.33 * i + 0.33, 1], outputRange: [0.3, 0.3, 1, 0.3], extrapolate: 'clamp' }) }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function Asisten() {
  const params = useLocalSearchParams<{ mode?: string; q?: string }>();
  const inset = useSafeAreaInsets();
  const toast = useToast();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [view, setView] = useState<'start' | 'voice' | 'chat'>('start');
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [brain, setBrain] = useState('');
  // suara
  const [vText, setVText] = useState('');
  const [vState, setVState] = useState('Mendengarkan…');
  const [listening, setListening] = useState(false);
  const level = useRef(new Animated.Value(0)).current;
  const voiceActive = useRef(false);
  const proxyRef = useRef<(e: SpeechEvent) => void>(() => {});

  const reload = useCallback(() => setMsgs(listChat()), []);
  useFocusEffect(
    useCallback(() => {
      reload();
      brainName().then(setBrain);
      stopWake();
    }, [reload]),
  );

  useEffect(() => {
    if (view === 'chat') setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
  }, [msgs.length, busy, steps.length, view]);

  const send = useCallback(
    async (override?: string, opts: { voice?: boolean } = {}) => {
      const q = (override ?? text).trim();
      const files = atts;
      if ((!q && files.length === 0) || busy) return;
      if (!(await hasAnyKey())) {
        Alert.alert('Kunci AI belum diisi', 'Isi kunci Claude (atau Gemini) di Pengaturan → Asisten & AI.');
        return;
      }
      addChat('user', q, files);
      setText('');
      setAtts([]);
      reload();
      if (!opts.voice) setView('chat');
      setBusy(true);
      setSteps([]);
      try {
        const recent = listChat().slice(-20);
        const turns: Turn[] = [];
        for (let i = 0; i < recent.length; i++) {
          const m = recent[i];
          const parts: Part[] = [];
          if (m.role === 'user' && m.attachments.length && i >= recent.length - 6) parts.push(...(await toParts(m.attachments)));
          parts.push({ text: m.text || 'Lihat lampiran.' });
          const prev = turns[turns.length - 1];
          if (prev && prev.role === m.role) prev.parts.push(...parts);
          else turns.push({ role: m.role, parts });
        }
        while (turns.length && turns[0].role === 'model') turns.shift();
        const res = await askAssistant(turns, isoWib(), (s) => setSteps((x) => [...x, STEP_LABEL[s] ?? (s === 'web_search' ? 'Mencari di internet' : s)]), !!opts.voice);
        addChat('model', res.reply || 'Maaf, saya belum bisa menjawab itu.', [], res.actions);
        if (opts.voice) return res.reply;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addChat('model', `⚠️ ${msg}`);
        if (opts.voice) return msg;
      } finally {
        setBusy(false);
        reload();
      }
      return '';
    },
    [text, atts, busy, reload],
  );

  // ---------- Mode suara: dengar → kirim → bacakan → dengar lagi ----------
  const onSpeech = useCallback(
    async (e: SpeechEvent) => {
      if (e.type === 'level') {
        Animated.timing(level, { toValue: Math.max(0, Math.min(1, (e.value + 2) / 12)), duration: 90, useNativeDriver: true }).start();
      } else if (e.type === 'partial') setVText(e.text);
      else if (e.type === 'ready') {
        setListening(true);
        setVState('Mendengarkan…');
      } else if (e.type === 'final' || e.type === 'error') {
        setListening(false);
        level.setValue(0);
        const said = e.type === 'final' ? e.text.trim() : '';
        if (!voiceActive.current) return;
        if (!said) {
          setVState(e.type === 'error' && e.value !== 7 ? 'Tidak terdengar jelas. Ketuk bola untuk bicara.' : 'Ketuk bola untuk bicara.');
          return;
        }
        setVText(said);
        setVState('Berpikir…');
        const reply = await send(said, { voice: true });
        if (!voiceActive.current) return;
        if (reply && speakOn()) {
          setVState('Menjawab…');
          setVText(reply.replace(/[#*_`>]/g, '').slice(0, 280));
          say(reply, () => {
            if (voiceActive.current) {
              setVText('');
              listen(proxyRef.current);
            }
          });
        } else {
          setVText(reply ? reply.replace(/[#*_`>]/g, '').slice(0, 280) : '');
          setVState('Ketuk bola untuk bicara lagi.');
        }
      }
    },
    [level, send],
  );
  const onSpeechRef = useRef(onSpeech);
  onSpeechRef.current = onSpeech;
  const speechProxy = useCallback((e: SpeechEvent) => onSpeechRef.current(e), []);
  proxyRef.current = speechProxy;

  const openVoice = useCallback(() => {
    if (!speechReady()) {
      toast('Pengenal suara Google tidak tersedia di HP ini.');
      return;
    }
    stopWake();
    hush();
    voiceActive.current = true;
    setView('voice');
    setVText('');
    setVState('Bersiap…');
    listen(speechProxy);
  }, [speechProxy, toast]);

  const closeVoice = useCallback(() => {
    voiceActive.current = false;
    hush();
    release(speechProxy);
    setListening(false);
    setView(listChat().length ? 'chat' : 'start');
  }, [speechProxy]);

  useEffect(() => () => {
    voiceActive.current = false;
    hush();
    release(speechProxy);
  }, [speechProxy]);

  // Dibuka dari "Halo asisten" / tombol asisten HP / kolom tanya beranda
  const handled = useRef('');
  useEffect(() => {
    const key = `${params.mode ?? ''}|${params.q ?? ''}`;
    if (handled.current === key) return;
    handled.current = key;
    if (params.mode === 'voice') setTimeout(openVoice, 250);
    else if (params.q) send(params.q);
    else if (listChat().length) setView('chat');
  }, [params.mode, params.q, openVoice, send]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view === 'voice') {
        closeVoice();
        return true;
      }
      if (view === 'chat') {
        setView('start');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [view, closeVoice]);

  const pick = async () => {
    if (getSetting('allow_files') === '0') {
      toast('Akses file dimatikan di Pengaturan.');
      return;
    }
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/markdown', 'text/plain', 'text/x-markdown', 'image/*', 'application/octet-stream'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (r.canceled) return;
    const add = r.assets.map((a) => {
      let mime = a.mimeType && a.mimeType !== 'application/octet-stream' ? a.mimeType : mimeOf(a.name, 'text/plain');
      if (mime === 'text/x-markdown') mime = 'text/markdown';
      return { name: a.name, mime, uri: a.uri };
    });
    const ok = add.filter((a) => a.mime === 'application/pdf' || a.mime.startsWith('text/') || a.mime.startsWith('image/'));
    if (ok.length < add.length) toast('Hanya PDF, Markdown, teks, atau gambar.');
    setAtts((x) => [...x, ...ok].slice(0, 5));
  };

  const onAction = async (msg: ChatMsg, i: number, a: AssistantAction, ok: boolean) => {
    if (ok) {
      try {
        const at = a.at_iso ? Date.parse(a.at_iso) : NaN;
        if (a.type === 'reminder' || a.type === 'event' || a.type === 'alarm') {
          if (!Number.isFinite(at) || at < Date.now()) {
            toast('Waktunya sudah lewat atau tidak jelas.');
            return;
          }
        }
        if (a.type === 'reminder') {
          await ensurePermission();
          await addTask(a.title, at);
          toast(`Pengingat dipasang: ${dayDateTime(at)}.`);
        } else if (a.type === 'task') {
          await addTask(a.title, null);
          toast('Tugas ditambahkan.');
        } else if (a.type === 'alarm') {
          const h = hourOfDay(at);
          await addAlarm(Math.floor(h), Math.round((h % 1) * 60) % 60, a.title, 'once');
          toast(`Alarm dipasang: ${dayDateTime(at)}.`);
        } else if (a.type === 'event') {
          const id = await createCalendarEvent(a.title, at);
          toast(id ? 'Acara dibuat di kalender.' : 'Kalender tidak bisa diakses.');
        } else if (a.type === 'note') {
          saveNote(null, a.title, a.body || a.title);
          toast('Catatan disimpan.');
        } else if (a.type === 'whatsapp') {
          if (a.phone) await Linking.openURL(`https://wa.me/${normalizePhone(a.phone)}?text=${encodeURIComponent(a.body || a.title)}`);
          else router.navigate('/chat');
        }
        success();
      } catch (e) {
        Alert.alert('Gagal menjalankan', e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setActionState(msg.id, i, ok ? 'done' : 'skip');
    reload();
  };

  const orbScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const name = getSetting('name') || 'Urwah';

  const composer = (
    <View style={styles.composerCard}>
      {atts.length ? (
        <View style={{ gap: 6, marginBottom: 10 }}>
          {atts.map((a) => (
            <View key={a.uri} style={styles.docChip}>
              <View style={styles.docK}>
                <T pixel size={11} style={{ color: color.ink }} maxFontSizeMultiplier={1}>
                  {kindOf(a.mime)}
                </T>
              </View>
              <T size={13} weight="bold" numberOfLines={1} style={{ flex: 1 }}>
                {a.name}
              </T>
              <PressableScale accessibilityLabel={`Lepas ${a.name}`} onPress={() => setAtts((x) => x.filter((y) => y !== a))} style={styles.docX}>
                <Icon name="close" size={12} />
              </PressableScale>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Tanya atau ceritakan masalahnya…"
        placeholderTextColor={color.faint}
        style={styles.input}
        multiline
        maxFontSizeMultiplier={1.3}
      />
      <View style={styles.cRow}>
        <PressableScale accessibilityLabel="Lampirkan" onPress={pick} style={styles.pillBtn}>
          <Icon name="attach" size={18} />
        </PressableScale>
        {brain ? (
          <View style={styles.brain}>
            <T size={12.5} weight="bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {brain}
            </T>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <PressableScale accessibilityLabel="Kirim" onPress={() => send()} disabled={busy || (!text.trim() && !atts.length)} style={styles.sendBtn}>
          {busy ? <ActivityIndicator color={color.ink} /> : <Icon name="send" size={18} color={color.ink} strokeWidth={2.4} />}
        </PressableScale>
        <PressableScale accessibilityLabel="Bicara" onPress={openVoice} style={styles.micWrap}>
          <Orb size={48} kind="sun" glow={false} />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.center}>
              <Icon name="mic" size={20} strokeWidth={2.2} />
            </View>
          </View>
        </PressableScale>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Backdrop name="ask" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {view === 'start' ? (
          <View style={[styles.page, { paddingTop: inset.top + 14, paddingBottom: inset.bottom + 14 }]}>
            <View style={styles.inner}>
              <View style={styles.topRow}>
                <T size={14} style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>
                  {`${greetingWord()},\n`}
                  <T size={16} weight="heavy">
                    {name}
                  </T>
                </T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {msgs.length ? (
                    <PressableScale accessibilityLabel="Riwayat percakapan" onPress={() => setView('chat')} style={styles.pillBtn}>
                      <Icon name="chat" size={18} />
                    </PressableScale>
                  ) : null}
                  <PressableScale accessibilityLabel="Tutup asisten" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.pillBtn}>
                    <Icon name="close" size={18} />
                  </PressableScale>
                </View>
              </View>
              <FadeIn delay={60}>
                <T size={38} weight="bold" style={styles.h1}>
                  {'Apa yang kita\nkerjakan hari ini?'}
                </T>
              </FadeIn>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20, marginTop: 24, flexGrow: 0 }}>
                {SUGGEST.map((s, i) => (
                  <FadeIn key={s} delay={120 + i * 60}>
                    <PressableScale accessibilityLabel={s} onPress={() => (s.startsWith('Ringkas') ? pick() : send(s))} style={styles.sugWrap}>
                      <Glass style={styles.sug}>
                        <Icon name="spark" size={18} color="#FFB56B" />
                        <T size={14} weight="bold" style={{ lineHeight: 19 }}>
                          {s}
                        </T>
                      </Glass>
                    </PressableScale>
                  </FadeIn>
                ))}
              </ScrollView>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.inner}>{composer}</View>
          </View>
        ) : null}

        {view === 'voice' ? (
          <View style={[styles.page, { paddingTop: inset.top + 14, paddingBottom: inset.bottom + 24, alignItems: 'center' }]}>
            <PressableScale accessibilityLabel="Tutup" onPress={closeVoice} style={styles.closePill}>
              <Icon name="close" size={14} />
              <T size={13} weight="bold">
                Tutup
              </T>
            </PressableScale>
            <View style={styles.voiceOrb}>
              {listening ? <Animated.View style={[styles.ring, { transform: [{ scale: orbScale }], opacity: level.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }) }]} /> : null}
              <PressableScale accessibilityLabel={listening ? 'Selesai bicara' : 'Mulai bicara'} onPress={() => (listening ? stopListen() : (hush(), listen(speechProxy)))} style={{ borderRadius: 100 }} depth={0.95}>
                <Animated.View style={{ transform: [{ scale: orbScale }] }}>
                  <Orb size={200} kind="sun" />
                </Animated.View>
              </PressableScale>
            </View>
            <T size={12} style={{ color: 'rgba(255,255,255,0.55)', marginTop: 34 }}>
              {vState}
            </T>
            <T size={23} weight="bold" style={styles.vText}>
              {vText || (listening ? 'Silakan bicara…' : '')}
            </T>
            <View style={{ flex: 1 }} />
            <View style={styles.voiceRow}>
              <PressableScale accessibilityLabel="Lihat obrolan" onPress={() => { closeVoice(); setView('chat'); }} style={styles.pillBig}>
                <Icon name="chat" size={20} />
              </PressableScale>
              <PressableScale accessibilityLabel="Bicara" onPress={() => (listening ? stopListen() : (hush(), listen(speechProxy)))} style={styles.micRing}>
                <Orb size={74} kind="sun" glow={false} />
                <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                  <Icon name={listening ? 'pause' : 'mic'} size={26} strokeWidth={2.2} />
                </View>
              </PressableScale>
              <PressableScale accessibilityLabel="Hentikan suara" onPress={() => { hush(); setVState('Ketuk bola untuk bicara.'); }} style={styles.pillBig}>
                <Icon name="stop" size={18} />
              </PressableScale>
            </View>
          </View>
        ) : null}

        {view === 'chat' ? (
          <>
            <View style={[styles.chatTop, { paddingTop: inset.top + 10 }]}>
              <PressableScale accessibilityLabel="Tutup obrolan" onPress={() => setView('start')} style={styles.closePill}>
                <Icon name="close" size={14} />
                <T size={13} weight="bold">
                  Tutup obrolan
                </T>
              </PressableScale>
              <PressableScale
                accessibilityLabel="Percakapan baru"
                onPress={() =>
                  Alert.alert('Percakapan baru?', 'Riwayat percakapan ini dihapus.', [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Hapus', style: 'destructive', onPress: () => { clearChat(); reload(); setView('start'); } },
                  ])
                }
                style={styles.pillBtn}
              >
                <Icon name="refresh" size={18} />
              </PressableScale>
            </View>
            <ScrollView ref={scroll} contentContainerStyle={styles.chatScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={[styles.inner, { gap: 14 }]}>
                {msgs.map((m) => (
                  <Bubble key={m.id} m={m} onAction={(i, a, ok) => onAction(m, i, a, ok)} />
                ))}
                {busy ? <Thinking steps={steps} /> : null}
              </View>
            </ScrollView>
            <View style={[styles.chatFoot, { paddingBottom: inset.bottom + 10 }]}>
              <View style={styles.inner}>
                {atts.length ? (
                  <View style={{ gap: 6, marginBottom: 8 }}>
                    {atts.map((a) => (
                      <View key={a.uri} style={styles.docChip}>
                        <View style={styles.docK}>
                          <T pixel size={11} style={{ color: color.ink }} maxFontSizeMultiplier={1}>
                            {kindOf(a.mime)}
                          </T>
                        </View>
                        <T size={13} weight="bold" numberOfLines={1} style={{ flex: 1 }}>
                          {a.name}
                        </T>
                        <PressableScale accessibilityLabel={`Lepas ${a.name}`} onPress={() => setAtts((x) => x.filter((y) => y !== a))} style={styles.docX}>
                          <Icon name="close" size={12} />
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.capsule}>
                  <PressableScale accessibilityLabel="Lampirkan" onPress={pick} style={styles.capBtn}>
                    <Icon name="attach" size={19} color="rgba(255,255,255,0.8)" />
                  </PressableScale>
                  <TextInput value={text} onChangeText={setText} placeholder="Tanya asisten…" placeholderTextColor={color.faint} style={styles.capInput} multiline maxFontSizeMultiplier={1.3} />
                  <PressableScale accessibilityLabel="Bicara" onPress={openVoice} style={styles.capBtn}>
                    <Icon name="mic" size={19} />
                  </PressableScale>
                  <PressableScale accessibilityLabel="Kirim" onPress={() => send()} disabled={busy} style={styles.sendBtn}>
                    {busy ? <ActivityIndicator color={color.ink} /> : <Icon name="send" size={18} color={color.ink} strokeWidth={2.4} />}
                  </PressableScale>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0505' },
  page: { flex: 1, paddingHorizontal: 20 },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { marginTop: 56, lineHeight: 42, letterSpacing: -0.6 },
  sugWrap: { borderRadius: 22 },
  sug: { width: 150, height: 120, borderRadius: 22, padding: 14, justifyContent: 'space-between' },
  pillBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  composerCard: { padding: 16, borderRadius: 30, backgroundColor: 'rgba(28,8,4,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { color: '#FFFFFF', fontFamily: font.semibold, fontSize: 16, minHeight: 56, maxHeight: 140, paddingVertical: 4, paddingHorizontal: 2, textAlignVertical: 'top' },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  brain: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  micWrap: { width: 48, height: 48, borderRadius: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  voiceOrb: { width: 220, height: 220, marginTop: 56, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: 'rgba(255,160,90,0.6)' },
  vText: { textAlign: 'center', marginTop: 18, lineHeight: 31, minHeight: 124, paddingHorizontal: 6 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  pillBig: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  micRing: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  chatScroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  chatFoot: { paddingHorizontal: 14, paddingTop: 8, backgroundColor: 'rgba(12,7,9,0.6)' },
  me: { maxWidth: '82%', backgroundColor: color.accent, borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  meAtt: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(26,10,4,0.1)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  ai: { backgroundColor: 'rgba(20,8,6,0.72)', borderRadius: 22, borderTopLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 14 },
  actCard: { borderRadius: 24, padding: 16 },
  actNo: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  actYes: { flex: 1, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  docChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  docK: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  docX: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  capsule: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 6, paddingLeft: 8, borderRadius: 30, backgroundColor: 'rgba(28,10,8,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  capBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  capInput: { flex: 1, color: '#FFFFFF', fontFamily: font.semibold, fontSize: 15, maxHeight: 120, paddingVertical: 11 },
});
