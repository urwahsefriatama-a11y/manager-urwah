// Pesan singkat di bawah layar: muncul memantul, hilang memudar.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './T';
import { color, radius } from './theme';

const Ctx = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const inset = useSafeAreaInsets();
  const [msg, setMsg] = useState('');
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(m);
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(v, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setMsg(''));
      }, 2600);
    },
    [v],
  );

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: inset.bottom + 96 }]}>
          <Animated.View style={[styles.toast, { opacity: v, transform: [{ translateY }] }]}>
            <T size={14} weight="bold" style={{ color: color.ink, textAlign: 'center' }}>
              {msg}
            </T>
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  toast: { maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 13 },
});
