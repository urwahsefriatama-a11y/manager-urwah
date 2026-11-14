// Tombol dengan umpan balik tegas: begitu jari menyentuh → getar + mengecil cepat + kilau putih,
// saat dilepas → memantul kembali dengan pegas.
import { useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { press } from '../lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityState?: { checked?: boolean; selected?: boolean; disabled?: boolean };
  accessibilityRole?: 'button' | 'switch' | 'checkbox' | 'tab';
  hitSlop?: number;
  /** Seberapa kecil saat ditekan (bawaan 0.92). */
  depth?: number;
  children: ReactNode;
};

export function PressableScale({
  onPress,
  onLongPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityState,
  accessibilityRole = 'button',
  hitSlop = 6,
  depth = 0.92,
  children,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const r = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? 18;

  const pressIn = () => {
    press();
    Animated.parallel([
      Animated.timing(scale, { toValue: depth, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 70, useNativeDriver: true }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 14 }),
      Animated.timing(glow, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, { transform: [{ scale }] }, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { borderRadius: r, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) }]}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
});
