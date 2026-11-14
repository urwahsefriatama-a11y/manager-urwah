// Fitur yang sudah dirancang tapi belum dibuat: ditandai jelas, tidak pura-pura berjalan.
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { type IconName } from '../src/ui/Icon';
import { FadeIn, Header, IconTile, PrimaryBtn } from '../src/ui/bits';
import { radius } from '../src/ui/theme';

const INFO: Record<string, { title: string; icon: IconName; version: string; points: string[] }> = {
  adzan: {
    title: 'Adzan & mode senyap',
    icon: 'shalat',
    version: '0.4',
    points: ['Suara adzan penuh di waktu shalat (pilih muadzin)', 'HP otomatis senyap selama shalat, lalu kembali normal', 'Saat ini: notifikasi pengingat setiap waktu shalat sudah aktif'],
  },
  backup: {
    title: 'Cadangan Google Drive',
    icon: 'file',
    version: '0.4',
    points: ['Opsional: masuk Google hanya bila Anda mau', 'Cadangkan database & rekaman ke Drive Anda sendiri', 'Pulihkan di HP baru'],
  },
  live: {
    title: 'Live Update',
    icon: 'bell',
    version: '0.4',
    points: ['Hitung mundur pengingat & rekaman di bilah status (Android 16)', 'Saat ini: alarm layar penuh & notifikasi pengingat sudah aktif'],
  },
};

export default function Segera() {
  const { fitur } = useLocalSearchParams<{ fitur?: string }>();
  const info = INFO[fitur ?? ''] ?? INFO.adzan;
  return (
    <Screen bg="soon">
      <Header title={info.title} />
      <FadeIn>
        <Glass style={styles.card}>
          <IconTile icon={info.icon} size={70} iconSize={34} />
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
  badge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginTop: 7 },
});
