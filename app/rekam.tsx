// Rekam: siap → hitung mundur 3-2-1 → merekam (tetap jalan saat layar mati) → simpan.
// File disimpan per potongan 30 menit agar aman untuk rekaman panjang (sampai 3 jam atau lebih).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Icon } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { Chip, PrimaryBtn, RoundBtn, reduceMotion } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import { addChunk, addMark, createRecording, finishRecording } from '../src/data/recordings';
import { duration, shortDateTime } from '../src/lib/time';
import { success, tap } from '../src/lib/haptics';
import { ensurePermission } from '../src/lib/notify';

const CHUNK_MS = 30 * 60 * 1000;
const TEMPLATES = ['Rapat', 'Kajian', 'Wawancara', 'Umum'];
const BARS = 48;

type Phase = 'ready' | 'count' | 'live' | 'saving';

export default function Rekam() {
  const toast = useToast();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document', isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 180);
  const [phase, setPhase] = useState<Phase>('ready');
  const [template, setTemplate] = useState('Rapat');
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [marks, setMarks] = useState(0);
  const recId = useRef<string | null>(null);
  const chunkIdx = useRef(0);
  const doneMs = useRef(0); // durasi potongan yang sudah selesai
  const rotating = useRef(false);

  const pop = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  const elapsedMs = doneMs.current + (state.durationMillis ?? 0);
  const meter = (state as unknown as { metering?: number }).metering;
  const level = phase === 'live' && !paused ? (typeof meter === 'number' ? Math.min(1, Math.max(0, (meter + 55) / 55)) : 0.35) : 0;

  // Bola bernapas pelan saat siap; saat merekam ikut suara.
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const startRecording = useCallback(async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, allowsBackgroundRecording: true });
      recId.current = createRecording(`${template} · ${shortDateTime(Date.now())}`, template);
      chunkIdx.current = 0;
      doneMs.current = 0;
      await recorder.prepareToRecordAsync();
      recorder.record();
      success();
      setPhase('live');
    } catch (e) {
      setPhase('ready');
      Alert.alert('Tidak bisa mulai merekam', e instanceof Error ? e.message : String(e));
    }
  }, [recorder, template]);

  // Hitung mundur 3-2-1.
  useEffect(() => {
    if (phase !== 'count') return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
    if (count === 0) {
      startRecording();
      return;
    }
    const id = setTimeout(() => {
      tap();
      setCount((c) => c - 1);
    }, 800);
    return () => clearTimeout(id);
  }, [phase, count, pop, startRecording]);

  const begin = async () => {
    const mic = await requestRecordingPermissionsAsync();
    if (!mic.granted) {
      Alert.alert('Izin mikrofon dibutuhkan', 'Buka Pengaturan HP → Aplikasi → Manager Urwah → Izin → Mikrofon.');
      return;
    }
    // Notifikasi dipakai untuk menampilkan status "sedang merekam" saat layar mati.
    await ensurePermission();
    setCount(3);
    setPhase('count');
  };

  // Ganti potongan tiap 30 menit.
  useEffect(() => {
    if (phase !== 'live' || paused || rotating.current) return;
    if ((state.durationMillis ?? 0) < CHUNK_MS) return;
    rotating.current = true;
    (async () => {
      try {
        const len = state.durationMillis ?? CHUNK_MS;
        await recorder.stop();
        if (recorder.uri && recId.current) addChunk(recId.current, chunkIdx.current, recorder.uri, len / 1000);
        doneMs.current += len;
        chunkIdx.current += 1;
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (e) {
        Alert.alert('Masalah saat menyimpan potongan', e instanceof Error ? e.message : String(e));
      } finally {
        rotating.current = false;
      }
    })();
  }, [phase, paused, state.durationMillis, recorder]);

  const stop = useCallback(async () => {
    if (phase !== 'live' || !recId.current) return;
    setPhase('saving');
    try {
      const len = state.durationMillis ?? 0;
      await recorder.stop();
      if (recorder.uri) addChunk(recId.current, chunkIdx.current, recorder.uri, len / 1000);
      finishRecording(recId.current, (doneMs.current + len) / 1000);
      success();
      toast('Rekaman disimpan.');
      router.replace('/rekaman');
    } catch (e) {
      setPhase('live');
      Alert.alert('Gagal menyimpan', e instanceof Error ? e.message : String(e));
    }
  }, [phase, recorder, state.durationMillis, toast]);

  const togglePause = () => {
    if (paused) {
      recorder.record();
      setPaused(false);
    } else {
      recorder.pause();
      setPaused(true);
    }
  };

  const mark = () => {
    if (!recId.current) return;
    addMark(recId.current, elapsedMs);
    setMarks((m) => m + 1);
    toast('Momen ditandai.');
  };

  // Tombol kembali HP saat merekam: tanya dulu, jangan sampai rekaman hilang.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'live') {
        Alert.alert('Sedang merekam', 'Hentikan dan simpan rekaman?', [
          { text: 'Lanjut merekam', style: 'cancel' },
          { text: 'Simpan', onPress: stop },
        ]);
        return true;
      }
      return phase === 'saving';
    });
    return () => sub.remove();
  }, [phase, stop]);

  const close = () => {
    if (phase === 'live') {
      Alert.alert('Sedang merekam', 'Hentikan dan simpan rekaman?', [
        { text: 'Lanjut merekam', style: 'cancel' },
        { text: 'Simpan', onPress: stop },
      ]);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const live = phase === 'live';
  const status = phase === 'live' ? (paused ? 'DIJEDA' : 'MEREKAM') : phase === 'count' ? 'BERSIAP' : phase === 'saving' ? 'MENYIMPAN' : 'SIAP';

  return (
    <Screen bg="rec" fixed>
      <View style={styles.top}>
        <RoundBtn icon="close" label="Tutup" onPress={close} />
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: live && !paused ? '#FF8A80' : 'rgba(255,255,255,0.5)' }]} />
          <T size={12} weight="heavy" style={{ letterSpacing: 1.4 }}>
            {status}
          </T>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {phase === 'ready' ? (
        <View style={styles.chips}>
          {TEMPLATES.map((t) => (
            <Chip key={t} label={t} on={template === t} onPress={() => setTemplate(t)} />
          ))}
        </View>
      ) : null}

      <View style={styles.stage}>
        {live ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {Array.from({ length: BARS }).map((_, i) => {
              const wave = Math.abs(Math.sin(i * 0.9 + elapsedMs / 260));
              const h = 6 + Math.round((paused ? 0.15 : level) * 30 * (0.35 + 0.65 * wave));
              return (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    {
                      height: h,
                      opacity: 0.35 + 0.6 * (paused ? 0.2 : level),
                      transform: [{ rotate: `${(360 / BARS) * i}deg` }, { translateY: -128 - h / 2 }],
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
        <Animated.View style={[styles.sphere, { transform: [{ scale: live ? 1 + level * 0.06 : breathScale }] }]}>
          <View style={styles.sphereHi} />
        </Animated.View>
        <View style={styles.center} pointerEvents="none">
          {phase === 'ready' ? <Icon name="mic" size={44} strokeWidth={1.8} /> : null}
          {phase === 'count' && count > 0 ? (
            <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [2, 1] }) }] }}>
              <T pixel size={110} maxFontSizeMultiplier={1}>
                {String(count)}
              </T>
            </Animated.View>
          ) : null}
          {live || phase === 'saving' ? (
            <T pixel size={44} maxFontSizeMultiplier={1}>
              {duration(elapsedMs / 1000)}
            </T>
          ) : null}
        </View>
      </View>

      {phase === 'ready' ? (
        <View style={styles.info}>
          <T size={20} weight="heavy">
            Siap merekam
          </T>
          <T size={14} muted style={styles.infoText}>
            Letakkan HP di tengah meja. Rekaman tetap jalan saat layar mati, dan disimpan per 30 menit agar aman.
          </T>
        </View>
      ) : null}
      {live ? (
        <T size={14} muted style={{ textAlign: 'center' }}>
          {`Potongan ${chunkIdx.current + 1} · ditandai ${marks}`}
        </T>
      ) : null}

      <View style={{ flex: 1 }} />

      {phase === 'ready' ? <PrimaryBtn label="Mulai rekam" onPress={begin} /> : null}
      {live || phase === 'saving' ? (
        <View style={styles.controls}>
          <RoundBtn icon={paused ? 'play' : 'pause'} label={paused ? 'Lanjutkan' : 'Jeda'} onPress={togglePause} size={58} />
          <PressableScale accessibilityLabel="Selesai dan simpan" onPress={stop} disabled={phase === 'saving'} style={styles.stopRing}>
            <View style={styles.stopBtn}>
              <Icon name="stop" size={26} color={color.ink} />
            </View>
          </PressableScale>
          <RoundBtn icon="flag" label="Tandai momen" onPress={mark} size={58} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
  stage: { height: 300, marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: '50%', top: '50%', width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: '#FFD3C9' },
  sphere: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E8604E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  sphereHi: { position: 'absolute', left: 30, top: 22, width: 90, height: 70, borderRadius: 45, backgroundColor: 'rgba(255,220,205,0.35)' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  info: { alignItems: 'center', marginTop: 18 },
  infoText: { textAlign: 'center', marginTop: 8, lineHeight: 21 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  stopRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  stopBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
