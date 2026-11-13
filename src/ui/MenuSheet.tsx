// Menu panel penuh dari tombol kanan atas: membesar dari tombol, menciut kembali saat ditutup.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { T } from './T';
import { color, MAX_CONTENT_WIDTH, radius } from './theme';

const ITEMS: { label: string; icon: IconName; href: Href }[] = [
  { label: 'Beranda', icon: 'home', href: '/' },
  { label: 'Rekam', icon: 'rec', href: '/rekam' },
  { label: 'Rekaman', icon: 'file', href: '/rekaman' },
  { label: 'Tugas', icon: 'task', href: '/tugas' },
  { label: 'Shalat', icon: 'shalat', href: '/shalat' },
  { label: 'Asisten', icon: 'ask', href: '/segera?fitur=asisten' },
  { label: 'Chat WA', icon: 'chat', href: '/segera?fitur=chat' },
  { label: 'Pindai', icon: 'scan', href: '/segera?fitur=pindai' },
  { label: 'Catatan', icon: 'note', href: '/segera?fitur=catatan' },
  { label: 'Pengaturan', icon: 'set', href: '/pengaturan' },
];

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inset = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
    }
  }, [open, v]);

  const close = (after?: () => void) => {
    Animated.timing(v, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      onClose();
      after?.();
    });
  };

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-110, 0] });

  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: v }]}>
        <Pressable accessibilityLabel="Tutup menu" style={StyleSheet.absoluteFill} onPress={() => close()} />
      </Animated.View>
      <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: inset.top + 6 }]}>
        <Animated.View style={[styles.panel, { opacity: v, transform: [{ translateX }, { translateY }, { scale }] }]}>
          <View style={styles.top}>
            <T size={12} weight="heavy" muted style={{ letterSpacing: 1.2 }}>
              MENU
            </T>
            <PressableScale accessibilityLabel="Tutup menu" onPress={() => close()} style={styles.close}>
              <Icon name="close" size={20} color={color.ink} strokeWidth={2.6} />
            </PressableScale>
          </View>
          <View style={styles.grid}>
            {ITEMS.map((it) => (
              <PressableScale
                key={it.label}
                accessibilityLabel={it.label}
                onPress={() => close(() => router.navigate(it.href))}
                style={styles.tile}
              >
                <View style={styles.tileIcon}>
                  <Icon name={it.icon} size={24} />
                </View>
                <T size={11} weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.1}>
                  {it.label}
                </T>
              </PressableScale>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  panel: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: color.sheet,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, marginBottom: 8 },
  close: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '20%', alignItems: 'center', gap: 7, paddingVertical: 8 },
  tileIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
