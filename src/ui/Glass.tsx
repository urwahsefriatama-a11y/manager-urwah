// Kaca cair ala prototipe: lapisan warna tembus, tepi bercahaya (terang kiri-atas, redup kanan-bawah),
// garis kilau di atas, cahaya dalam dari atas, pantulan tipis di bawah, dan bayangan tepi lensa.
// Kartu yang digulir tidak memakai blur sungguhan (agar 120 Hz tetap mulus);
// blur sungguhan dipakai di lapisan mengambang (kolom asisten) lewat <GlassBlur>.
import { createContext, useContext, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { radius } from './theme';

type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean; dark?: boolean };

export function GlassLayers({ r, strong, dark }: { r: number; strong?: boolean; dark?: boolean }) {
  const top = dark ? 0.1 : strong ? 0.26 : 0.18;
  return (
    <>
      {/* isi kaca: terang di kiri-atas, lebih bening di tengah, sedikit memantul di kanan-bawah */}
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(255,255,255,${top})`, `rgba(255,255,255,${top * 0.32})`, `rgba(255,255,255,${top * 0.55})`]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
      />
      {/* cahaya dalam dari atas (kesan cembung) */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        style={[styles.innerTop, { borderTopLeftRadius: r, borderTopRightRadius: r }]}
      />
      {/* bayangan tepi lensa */}
      <View pointerEvents="none" style={[styles.lens, { borderRadius: Math.max(r - 1, 0) }]} />
      {/* garis kilau atas */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.spec, { left: r * 0.6, right: r * 0.6 }]}
      />
      {/* pantulan bawah */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bottom, { left: r, right: r }]}
      />
    </>
  );
}

export function Glass({ children, style, strong, dark }: Props) {
  const r = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? radius.lg;
  return (
    <View style={[styles.box, { borderRadius: r, backgroundColor: dark ? 'rgba(22,8,4,0.40)' : 'rgba(255,255,255,0.05)' }, style]}>
      <GlassLayers r={r} strong={strong} dark={dark} />
      {children}
    </View>
  );
}

/** Ruang layar yang bisa di-blur oleh lapisan mengambang. Diisi oleh <Screen>. */
export const BlurTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

/** Kaca dengan blur sungguhan (untuk lapisan yang mengambang di atas isi yang digulir). */
export function GlassBlur({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const target = useContext(BlurTargetContext);
  const r = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? radius.pill;
  return (
    <View style={[styles.box, { borderRadius: r }, style]}>
      {target ? (
        <BlurView
          blurTarget={target}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={40}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30,12,6,0.72)' }]} />
      )}
      <GlassLayers r={r} strong />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.42)',
    borderLeftColor: 'rgba(255,255,255,0.30)',
    borderRightColor: 'rgba(255,255,255,0.12)',
    borderBottomColor: 'rgba(255,255,255,0.20)',
  },
  innerTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  lens: { position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)' },
  spec: { position: 'absolute', top: 0, height: 1.2 },
  bottom: { position: 'absolute', bottom: 0, height: 1 },
});
