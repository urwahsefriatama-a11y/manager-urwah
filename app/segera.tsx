// Fitur yang sudah dirancang tapi belum dibuat: ditandai jelas, tidak pura-pura berjalan.
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon, type IconName } from '../src/ui/Icon';
import { FadeIn, Header, PrimaryBtn } from '../src/ui/bits';
import { radius } from '../src/ui/theme';

const INFO: Record<string, { title: string; icon: IconName; version: string; points: string[] }> = {
  asisten: {
    title: 'Asisten AI',
    icon: 'ask',
    version: '0.3',
    points: [
      'Tanya apa saja: analisa masalah, saran, brainstorm, jawaban terstruktur',
      'Bisa membaca PDF & Markdown yang Anda lampirkan',
      'Minta diingatkan apa pun → langsung jadi alarm/pengingat',
      'Mode suara: bicara, asisten mendengarkan',
    ],
  },
  chat: {
    title: 'Chat WA terjadwal',
    icon: 'chat',
    version: '0.4',
    points: ['Pengingat kirim chat ke beberapa orang', 'Template pesan buatan sendiri dengan {nama}, {tanggal}, {waktu}', 'Membuka WhatsApp dengan pesan siap kirim (Anda yang menekan kirim)'],
  },
  pindai: {
    title: 'Pindai dokumen',
    icon: 'scan',
    version: '0.4',
    points: ['Kamera mendeteksi tepi dokumen', 'Salin teks dari foto', 'Ekspor PDF / PNG'],
  },
  catatan: {
    title: 'Catatan + analisa',
    icon: 'note',
    version: '0.4',
    points: ['Catatan cepat', 'Dianalisa AI: poin penting, risiko, tugas'],
  },
};

export default function Segera() {
  const { fitur } = useLocalSearchParams<{ fitur?: string }>();
  const info = INFO[fitur ?? ''] ?? INFO.asisten;
  return (
    <Screen bg="soon">
      <Header title={info.title} />
      <FadeIn>
        <Glass style={styles.card}>
          <View style={styles.icon}>
            <Icon name={info.icon} size={34} />
          </View>
          <T size={22} weight="heavy" style={{ marginTop: 14, textAlign: 'center' }}>
            {info.title}
          </T>
          <View style={styles.badge}>
            <T size={12} weight="heavy" style={{ color: '#1A0A04' }}>
              {`Hadir di versi ${info.version}`}
            </T>
          </View>
          <View style={{ marginTop: 16, alignSelf: 'stretch', gap: 10 }}>
            {info.points.map((p) => (
              <View key={p} style={styles.point}>
                <View style={styles.bullet} />
                <T size={14} muted style={{ flex: 1, lineHeight: 20 }}>
                  {p}
                </T>
              </View>
            ))}
          </View>
          <T size={12} muted style={{ marginTop: 16, textAlign: 'center', lineHeight: 18 }}>
            Desainnya sudah disetujui. Fitur ini sengaja belum aktif agar tidak ada tombol yang pura-pura berfungsi.
          </T>
        </Glass>
        <View style={{ marginTop: 16 }}>
          <PrimaryBtn label="Kembali ke beranda" onPress={() => router.replace('/')} />
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 22, alignItems: 'center' },
  icon: { width: 70, height: 70, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  badge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginTop: 7 },
});
