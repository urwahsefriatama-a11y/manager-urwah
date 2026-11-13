// Tombol yang turun cepat saat ditekan lalu memantul kembali saat dilepas.
// Gaya (lebar %, flex) dipasang langsung pada elemen yang ditekan agar tata letak tidak pecah.
import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { tap } from '../lib/haptics';

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
  children,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => Animated.timing(scale, { toValue: 0.94, duration: 90, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start();

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={() => {
        tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, { transform: [{ scale }] }, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
