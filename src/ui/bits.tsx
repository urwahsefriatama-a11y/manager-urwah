// Komponen kecil yang dipakai bersama.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { T } from './T';
import { color, radius } from './theme';
import { getSetting } from '../data/settings';

export function reduceMotion() {
  return getSetting('reduce_motion') === '1';
}

/** Isi muncul naik pelan (bertahap dengan `delay`). */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** Tombol bulat kaca berisi ikon. */
export function RoundBtn({ icon, label, onPress, size = 44, solid }: { icon: IconName; label: string; onPress: () => void; size?: number; solid?: boolean }) {
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.round,
        { width: size, height: size, backgroundColor: solid ? '#FFFFFF' : 'rgba(255,255,255,0.16)' },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} color={solid ? color.ink : '#FFFFFF'} strokeWidth={2.2} />
    </PressableScale>
  );
}

/** Kepala layar: tombol kembali + judul. */
export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <RoundBtn icon="back" label="Kembali" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <T size={17} weight="bold" style={styles.headerTitle} numberOfLines={1}>
        {title}
      </T>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/** Sakelar nyala/mati dengan pegas. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const x = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: on ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
  }, [on, x]);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(!on)}
      style={[styles.sw, { backgroundColor: on ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.16)' }]}
    >
      <Animated.View style={[styles.knob, { backgroundColor: on ? '#3A1A0C' : '#FFFFFF', transform: [{ translateX: tx }] }]} />
    </PressableScale>
  );
}

/** Label kecil berhuruf kapital. */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <T size={11.5} weight="heavy" muted style={{ letterSpacing: 1.2 }}>
        {children}
      </T>
    </View>
  );
}

/** Kapsul pilihan (aktif = putih). */
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? '#FFFFFF' : 'rgba(255,255,255,0.12)' }]}
    >
      <T size={13} weight="bold" style={{ color: on ? color.ink : '#FFFFFF' }}>
        {label}
      </T>
    </PressableScale>
  );
}

/** Tombol utama putih. */
export function PrimaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} disabled={disabled} style={styles.primary}>
      <T size={16} weight="heavy" style={{ color: color.ink }}>
        {label}
      </T>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  round: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerTitle: { flex: 1 },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  sw: { width: 50, height: 30, borderRadius: radius.pill, padding: 4, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: radius.pill },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  primary: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
