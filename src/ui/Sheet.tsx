// Lembar dari bawah: naik dengan pegas, turun halus saat ditutup (tidak hilang tiba-tiba).
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, MAX_CONTENT_WIDTH, radius } from './theme';
import { T } from './T';
import { GlassLayers } from './Glass';

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode };

export function Sheet({ open, onClose, title, children }: Props) {
  const inset = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
    }
  }, [open, v]);

  const close = () =>
    Animated.timing(v, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onClose());

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: v }]}>
        <Pressable accessibilityLabel="Tutup" style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.wrap} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { paddingBottom: inset.bottom + 16, transform: [{ translateY }] }]}>
          <GlassLayers r={radius.xl} dark />
          <View style={styles.grab} />
          <T size={17} weight="heavy" style={{ marginBottom: 14 }}>
            {title}
          </T>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  wrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 10 },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: color.sheet,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingTop: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 },
});
