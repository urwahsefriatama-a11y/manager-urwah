// Kerangka layar: latar gradasi, jarak aman (lubang kamera & bilah navigasi), isi rata tengah di layar lebar.
import { useRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { BlurTargetContext } from './Glass';
import { backgrounds, MAX_CONTENT_WIDTH, type BgName } from './theme';

type Props = {
  bg: BgName;
  children: ReactNode;
  /** Isi tidak digulir (mis. layar rekam). */
  fixed?: boolean;
  /** Ruang ekstra di bawah (untuk kolom yang menempel di bawah). */
  bottomSpace?: number;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ bg, children, fixed, bottomSpace = 24, footer, contentStyle }: Props) {
  const inset = useSafeAreaInsets();
  const g = backgrounds[bg];
  const pad = { paddingTop: inset.top + 14, paddingBottom: inset.bottom + bottomSpace };
  const target = useRef<ComponentRef<typeof View> | null>(null);
  return (
    <BlurTargetContext.Provider value={target}>
    <View style={styles.root}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={g.colors} locations={g.locations} style={StyleSheet.absoluteFill} />
      {fixed ? (
        <View style={[styles.fixed, pad]}>
          <View style={[styles.inner, styles.grow, contentStyle]}>{children}</View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, pad]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.inner, contentStyle]}>{children}</View>
        </ScrollView>
      )}
      </BlurTargetView>
      {footer ? <View style={[styles.footer, { paddingBottom: inset.bottom + 12 }]}>{footer}</View> : null}
    </View>
    </BlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0505' },
  scroll: { paddingHorizontal: 20, alignItems: 'center' },
  fixed: { flex: 1, paddingHorizontal: 20, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  grow: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, alignItems: 'center' },
});
