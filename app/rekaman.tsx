// Daftar rekaman + putar ulang per potongan. Buka detail untuk transkrip, pembicara, ringkasan & tugas AI.
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { FadeIn, Header, PrimaryBtn } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import { chunksOf, deleteRecording, listRecordings, type Chunk, type Recording } from '../src/data/recordings';
import { duration, shortDateTime } from '../src/lib/time';

function Player({ chunk, onClose }: { chunk: Chunk; onClose: () => void }) {
  const player = useAudioPlayer({ uri: chunk.file_uri });
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    player.play();
    setPlaying(true);
    const id = setInterval(() => {
      setPos(player.currentTime ?? 0);
      setPlaying(!!player.playing);
    }, 500);
    return () => clearInterval(id);
  }, [player]);

  const total = player.duration && player.duration > 0 ? player.duration : chunk.duration_sec;
  return (
    <View style={styles.player}>
      <PressableScale
        accessibilityLabel={playing ? 'Jeda' : 'Putar'}
        onPress={() => {
          if (player.playing) player.pause();
          else player.play();
          setPlaying(!player.playing);
        }}
        style={styles.playBtn}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color={color.ink} strokeWidth={2.6} />
      </PressableScale>
      <View style={{ flex: 1 }}>
        <T size={13} weight="bold">{`Potongan ${chunk.idx + 1}`}</T>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${total ? Math.min(100, (pos / total) * 100) : 0}%` }]} />
        </View>
      </View>
      <T pixel size={14} maxFontSizeMultiplier={1}>
        {`${duration(pos)} / ${duration(total)}`}
      </T>
      <PressableScale accessibilityLabel="Tutup pemutar" onPress={onClose} style={styles.closeBtn}>
        <Icon name="close" size={16} strokeWidth={2.4} />
      </PressableScale>
    </View>
  );
}

export default function Rekaman() {
  const toast = useToast();
  const [items, setItems] = useState<Recording[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [playing, setPlaying] = useState<Chunk | null>(null);

  const reload = useCallback(() => setItems(listRecordings()), []);
  useFocusEffect(reload);

  const expand = (r: Recording) => {
    if (open === r.id) {
      setOpen(null);
      setPlaying(null);
      return;
    }
    setOpen(r.id);
    setPlaying(null);
    setChunks(chunksOf(r.id));
  };

  const remove = (r: Recording) =>
    Alert.alert('Hapus rekaman?', `${r.title}\nFile audio ikut terhapus dari HP.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setPlaying(null);
          deleteRecording(r.id);
          setOpen(null);
          reload();
          toast('Rekaman dihapus.');
        },
      },
    ]);

  return (
    <Screen bg="recordings">
      <Header title="Rekaman" icon="file" />
      {items.length === 0 ? (
        <FadeIn>
          <Glass style={styles.empty}>
            <Icon name="file" size={34} />
            <T size={18} weight="heavy" style={{ marginTop: 12 }}>
              Belum ada rekaman
            </T>
            <T size={14} muted style={{ marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              Rekam rapat atau kajian, lalu jadikan transkrip, pembicara, ringkasan, dan tugas dengan AI.
            </T>
            <View style={{ width: '100%', marginTop: 18 }}>
              <PrimaryBtn label="Mulai rekam" onPress={() => router.navigate('/rekam')} />
            </View>
          </Glass>
        </FadeIn>
      ) : (
        items.map((r, i) => (
          <FadeIn key={r.id} delay={i * 50}>
            <Glass style={styles.card}>
              <PressableScale accessibilityLabel={`${r.title}, ${duration(r.duration_sec)}`} onPress={() => expand(r)} style={styles.cardHead}>
                <View style={styles.badge}>
                  <Icon name="file" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="bold" numberOfLines={1}>
                    {r.title}
                  </T>
                  <T size={12} muted style={{ marginTop: 2 }}>
                    {`${shortDateTime(r.started_at)} · ${r.chunk_count} potongan · ${r.mark_count} tanda`}
                  </T>
                </View>
                <T pixel size={16} maxFontSizeMultiplier={1}>
                  {duration(r.duration_sec)}
                </T>
              </PressableScale>
              {r.status === 'error' ? (
                <T size={12} style={{ color: color.danger, marginTop: 8 }}>
                  Rekaman terputus (app ditutup paksa saat merekam).
                </T>
              ) : null}
              {open === r.id ? (
                <View style={{ marginTop: 10 }}>
                  {chunks.length === 0 ? (
                    <T size={13} muted>
                      Tidak ada file audio tersimpan.
                    </T>
                  ) : (
                    chunks.map((c) => (
                      <PressableScale key={c.id} accessibilityLabel={`Putar potongan ${c.idx + 1}`} onPress={() => setPlaying(c)} style={styles.chunk}>
                        <Icon name="play" size={14} />
                        <T size={13} weight="semibold" style={{ flex: 1 }}>{`Potongan ${c.idx + 1}`}</T>
                        <T pixel size={13} muted maxFontSizeMultiplier={1}>
                          {duration(c.duration_sec)}
                        </T>
                      </PressableScale>
                    ))
                  )}
                  {playing ? <Player key={playing.id} chunk={playing} onClose={() => setPlaying(null)} /> : null}
                  <View style={styles.actions}>
                    <PressableScale accessibilityLabel="Buka transkrip dan ringkasan" onPress={() => router.navigate({ pathname: '/detail', params: { id: r.id } })} style={styles.soon}>
                      <Icon name="spark" size={14} color={color.ink} />
                      <T size={13} weight="heavy" style={{ color: color.ink }}>
                        {r.status === 'ready' ? 'Transkrip & ringkasan' : 'Buka'}
                      </T>
                    </PressableScale>
                    <PressableScale accessibilityLabel="Hapus rekaman" onPress={() => remove(r)} style={styles.del}>
                      <Icon name="trash" size={16} color={color.danger} />
                    </PressableScale>
                  </View>
                </View>
              ) : null}
            </Glass>
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', padding: 22 },
  card: { padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  chunk: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.3)' },
  playBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 6, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  del: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(242,163,154,0.14)', alignItems: 'center', justifyContent: 'center' },
});
