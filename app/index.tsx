// Beranda — versi 0.1: kerangka tampilan. Perekam aktif di versi 0.2.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { PressableScale } from '../src/ui/PressableScale';
import { radius, space, type, useColors } from '../src/ui/theme';

export default function Home() {
  const c = useColors();
  const glow = useRef(new Animated.Value(0)).current;

  // Cahaya lembut yang "bernapas" di belakang tombol rekam.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const version = Constants.expoConfig?.version ?? '';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.hello, { color: c.textMuted }]}>Assalamu'alaikum,</Text>
        <Text style={[styles.title, { color: c.text }]}>Manager Urwah</Text>
      </View>

      {/* Kondisi kosong */}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.surfaceBorder }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Belum ada rekaman</Text>
        <Text style={[styles.cardBody, { color: c.textMuted }]}>
          Rekam rapat atau kajian, nanti transkrip, ringkasan, pembicara, dan tugasnya muncul di sini.
        </Text>
      </View>

      <View style={styles.recordArea}>
        <View style={styles.recordWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { backgroundColor: c.accentGlow, opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
        <PressableScale
          disabled
          accessibilityLabel="Mulai merekam (hadir di versi 0.2)"
          style={[styles.recordBtn, { backgroundColor: c.accent }]}
        >
          <View style={[styles.recordDot, { backgroundColor: c.onAccent }]} />
        </PressableScale>
        </View>
        <Text style={[styles.caption, { color: c.textMuted }]}>Perekam hadir di versi 0.2</Text>
      </View>

      <Text style={[styles.version, { color: c.textMuted }]}>versi {version}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg },
  header: { marginTop: space.xl, marginBottom: space.lg },
  hello: { fontSize: type.body },
  title: { fontSize: type.hero, fontWeight: '800', letterSpacing: -1 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg },
  cardTitle: { fontSize: type.title, fontWeight: '700', marginBottom: space.sm },
  cardBody: { fontSize: type.body, lineHeight: 23 },
  recordArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  recordWrap: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 170, height: 170, borderRadius: radius.pill },
  recordBtn: { width: 96, height: 96, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 30, height: 30, borderRadius: radius.pill },
  caption: { marginTop: space.lg, fontSize: type.caption },
  version: { textAlign: 'center', fontSize: type.caption, marginBottom: space.md },
});
