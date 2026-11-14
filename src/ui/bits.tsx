// Komponen kecil yang dipakai bersama.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { T } from './T';
import { color, font, radius } from './theme';
import { Glass } from './Glass';
import { getSetting } from '../data/settings';
import { MenuSheet } from './MenuSheet';

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
      style={[styles.round, { width: size, height: size }]}
    >
      {solid ? (
        <View style={[styles.roundIn, { backgroundColor: '#FFFFFF' }]}>
          <Icon name={icon} size={Math.round(size * 0.45)} color={color.ink} strokeWidth={2.2} />
        </View>
      ) : (
        <Glass style={[styles.roundIn, { borderRadius: size / 2 }]}>
          <Icon name={icon} size={Math.round(size * 0.45)} color="#FFFFFF" strokeWidth={2.2} />
        </Glass>
      )}
    </PressableScale>
  );
}

/** Kepala layar: tombol kembali + judul. */
/**
 * Judul layar ala prototipe: ikon kaca + judul besar + panah ▾ yang membuka menu.
 * Kembali: gestur/tombol kembali Android, atau tombol bulat kecil di kanan.
 */
export function Header({ title, icon = 'home', right, back = true }: { title: string; icon?: IconName; right?: ReactNode; back?: boolean }) {
  const [menu, setMenu] = useState(false);
  return (
    <View style={styles.header}>
      <PressableScale accessibilityLabel={`${title}, buka menu`} onPress={() => setMenu(true)} style={styles.headerBtn} depth={0.96}>
        <IconTile icon={icon} size={44} iconSize={22} />
        <T size={24} weight="heavy" style={styles.headerTitle} numberOfLines={1}>
          {title}
        </T>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chev" size={18} color="rgba(255,255,255,0.7)" strokeWidth={2.4} />
        </View>
      </PressableScale>
      <View style={styles.headerRight}>
        {right}
        {back ? <RoundBtn icon="back" label="Kembali" size={40} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
      </View>
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
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

/** Kolom isian kaca. */
export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={color.faint}
      maxFontSizeMultiplier={1.3}
      {...props}
      style={[styles.field, props.multiline ? styles.fieldMulti : null, props.style]}
    />
  );
}

/** Tombol kedua (kaca) dengan ikon opsional. */
export function GhostBtn({ label, icon, onPress, disabled }: { label: string; icon?: IconName; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} disabled={disabled} style={styles.ghost}>
      <Glass style={styles.ghostIn}>
        {icon ? <Icon name={icon} size={18} strokeWidth={2.2} /> : null}
        <T size={14} weight="bold">
          {label}
        </T>
      </Glass>
    </PressableScale>
  );
}

/** Ikon di dalam kotak kaca, selalu tepat di tengah. */
export function IconTile({ icon, size = 46, iconSize, tint }: { icon: IconName; size?: number; iconSize?: number; tint?: string }) {
  return (
    <Glass style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.48)} color={tint ?? '#FFFFFF'} strokeWidth={2.1} />
    </Glass>
  );
}

/** Kosong: pesan ramah saat daftar belum ada isinya. */
export function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} size={56} />
      <T muted size={14} style={{ textAlign: 'center', marginTop: 12 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontFamily: font.semibold,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.30)',
    borderLeftColor: 'rgba(255,255,255,0.20)',
    borderRightColor: 'rgba(255,255,255,0.10)',
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  fieldMulti: { minHeight: 120, textAlignVertical: 'top' },
  ghost: { borderRadius: radius.pill },
  ghostIn: { height: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  round: { borderRadius: radius.pill },
  roundIn: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  headerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, minWidth: 0 },
  headerTitle: { flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
