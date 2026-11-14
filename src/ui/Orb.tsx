// Bola cahaya ala prototipe: "sun" (asisten, jingga) dan "ember" (rekam, merah bara).
// Gradasi radial + sorot putih + pusaran cahaya yang berputar pelan.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Circle, Ellipse, Stop } from 'react-native-svg';
import { reduceMotion } from './bits';

const PAL = {
  sun: ['#FFFFFF', '#FFD7B0', '#FFB27E', '#C8601E', '#2A0D02'],
  ember: ['#FFC4B0', '#FF6A55', '#D9604F', '#7A0A1E', '#1C0306'],
};

export function Orb({ size, kind = 'sun', style, glow = true }: { size: number; kind?: 'sun' | 'ember'; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: kind === 'sun' ? 14000 : 16000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin, kind]);
  const c = PAL[kind];
  const id = `${kind}${size}`;
  const r = size / 2;
  return (
    <View style={[{ width: size, height: size }, style]}>
      {glow ? <View style={[styles.glow, { width: size * 1.5, height: size * 1.5, borderRadius: size, left: -size * 0.25, top: -size * 0.25, backgroundColor: kind === 'sun' ? 'rgba(255,140,60,0.18)' : 'rgba(224,36,63,0.2)' }]} /> : null}
      <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden' }}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`b${id}`} cx="36%" cy="32%" r="75%">
              <Stop offset="0" stopColor={c[0]} />
              <Stop offset="0.18" stopColor={c[1]} />
              <Stop offset="0.42" stopColor={c[2]} />
              <Stop offset="0.72" stopColor={c[3]} />
              <Stop offset="1" stopColor={c[4]} />
            </RadialGradient>
            <RadialGradient id={`h${id}`} cx="50%" cy="40%" r="60%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.6} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={r} cy={r} r={r} fill={`url(#b${id})`} />
        </Svg>
        {/* pusaran cahaya */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.45" stopColor="#FFE6CC" stopOpacity={0.28} />
                <Stop offset="0.55" stopColor="#5A1404" stopOpacity={0.22} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Circle cx={r} cy={r} r={r} fill={`url(#s${id})`} />
          </Svg>
        </Animated.View>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Ellipse cx={r * 0.78} cy={r * 0.56} rx={r * 0.46} ry={r * 0.24} fill={`url(#h${id})`} transform={`rotate(-18 ${r * 0.78} ${r * 0.56})`} />
          <Circle cx={r} cy={r} r={r - 0.75} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ glow: { position: 'absolute' } });
