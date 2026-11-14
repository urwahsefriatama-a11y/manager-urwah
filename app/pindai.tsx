// Pindai dokumen: foto → teks (Gemini) → salin / simpan jadi catatan / ekspor PDF / bagikan foto.
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { FadeIn, Field, GhostBtn, Header, PrimaryBtn } from '../src/ui/bits';
import { useToast } from '../src/ui/Toast';
import { color, radius } from '../src/ui/theme';
import { readTextFromImage } from '../src/lib/ai';
import { hasAnyKey } from '../src/lib/ai';
import { success } from '../src/lib/haptics';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function Pindai() {
  const toast = useToast();
  const cam = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const shoot = async () => {
    if (!cam.current || !ready) return;
    const p = await cam.current.takePictureAsync({ quality: 0.7, base64: true });
    setPhoto({ uri: p.uri, base64: p.base64 });
    setText('');
  };

  const read = async () => {
    if (!photo?.base64) return;
    if (!(await hasAnyKey())) {
      Alert.alert('Kunci AI belum diisi', 'Isi kunci Claude (atau Gemini) di Pengaturan → Asisten & AI.');
      return;
    }
    setBusy(true);
    try {
      setText((await readTextFromImage({ inlineData: { mimeType: 'image/jpeg', data: photo.base64 } })).trim());
      success();
    } catch (e) {
      Alert.alert('Gagal membaca teks', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pdf = async () => {
    if (!photo) return;
    const img = photo.base64 ? `<img src="data:image/jpeg;base64,${photo.base64}" style="width:100%;margin-bottom:24px"/>` : '';
    const body = text ? `<pre style="white-space:pre-wrap;font-family:sans-serif;font-size:13px">${esc(text)}</pre>` : '';
    const { uri } = await Print.printToFileAsync({ html: `<html><body style="margin:28px">${img}${body}</body></html>` });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Bagikan PDF' });
  };

  if (!perm) return <Screen bg="scan"><Header title="Pindai" icon="scan" /></Screen>;

  if (!perm.granted) {
    return (
      <Screen bg="scan">
        <Header title="Pindai" icon="scan" />
        <Glass strong style={styles.card}>
          <Icon name="camera" size={34} />
          <T size={16} weight="bold" style={{ marginTop: 10, textAlign: 'center' }}>
            Izinkan kamera untuk memotret dokumen
          </T>
          <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
            <PrimaryBtn label="Izinkan kamera" onPress={requestPerm} />
          </View>
        </Glass>
      </Screen>
    );
  }

  return (
    <Screen bg="scan">
      <Header title="Pindai" icon="scan" />
      {!photo ? (
        <FadeIn>
          <View style={styles.camWrap}>
            <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
            {/* bingkai bantu: letakkan dokumen di dalam sudut-sudut ini */}
            <View pointerEvents="none" style={styles.frame}>
              {[styles.tl, styles.tr, styles.bl, styles.br].map((c, i) => (
                <View key={i} style={[styles.corner, c]} />
              ))}
            </View>
          </View>
          <T size={13} muted style={{ textAlign: 'center', marginTop: 12 }}>
            Letakkan dokumen di dalam bingkai, cahaya cukup, lalu tekan tombol.
          </T>
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <PressableScale accessibilityLabel="Ambil foto" onPress={shoot} disabled={!ready} style={styles.shutter}>
              <View style={styles.shutterIn} />
            </PressableScale>
          </View>
        </FadeIn>
      ) : (
        <FadeIn style={{ gap: 12 }}>
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
          {text ? (
            <Field value={text} onChangeText={setText} multiline style={{ minHeight: 180 }} />
          ) : (
            <PrimaryBtn label={busy ? 'Membaca teks…' : 'Salin teks dari foto (AI)'} onPress={read} disabled={busy} />
          )}
          {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
          {text ? (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <GhostBtn
                  label="Salin"
                  icon="copy"
                  onPress={async () => {
                    await Clipboard.setStringAsync(text);
                    toast('Teks disalin.');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <GhostBtn label="Jadi catatan" icon="note" onPress={() => router.navigate({ pathname: '/catatan', params: { isi: text } })} />
              </View>
            </View>
          ) : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <GhostBtn label="PDF" icon="file" onPress={pdf} />
            </View>
            <View style={{ flex: 1 }}>
              <GhostBtn label="Bagikan foto" icon="share" onPress={() => Sharing.shareAsync(photo.uri, { mimeType: 'image/jpeg' })} />
            </View>
          </View>
          <GhostBtn label="Foto ulang" icon="camera" onPress={() => { setPhoto(null); setReady(false); }} />
        </FadeIn>
      )}
    </Screen>
  );
}

const C = 26;
const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 24, alignItems: 'center' },
  camWrap: { aspectRatio: 3 / 4, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#000' },
  frame: { position: 'absolute', top: '8%', left: '8%', right: '8%', bottom: '8%' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#FFFFFF' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.xl, backgroundColor: color.glass },
  row: { flexDirection: 'row', gap: 10 },
});
