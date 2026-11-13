// Kartu kaca: tembus pandang tipis, garis cahaya di tepi atas, bayangan lembut.
// Tidak memakai blur sungguhan agar tetap ringan & mulus saat digulir di HP.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, radius } from './theme';

type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean; dark?: boolean };

export function Glass({ children, style, strong, dark }: Props) {
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: dark ? 'rgba(20,8,4,0.42)' : strong ? color.glassStrong : color.glass },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rim}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: color.glassBorder,
    overflow: 'hidden',
  },
  rim: { position: 'absolute', top: 0, left: 18, right: 18, height: 1 },
});
