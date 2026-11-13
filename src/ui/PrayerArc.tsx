// Lintasan matahari & lima waktu shalat (vektor). Matahari berada di posisi jam sekarang.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgLinear, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import type { Prayer } from '../lib/prayer';
import { hhmm, hourOfDay } from '../lib/time';
import { font } from './theme';
import { reduceMotion } from './bits';

const VB_W = 350;
const VB_H = 236;
const ARC = 'M20 206 Q175 -54 330 206';

function point(u: number) {
  const q = 1 - u;
  return { x: q * q * 20 + 2 * q * u * 175 + u * u * 330, y: q * q * 206 + 2 * q * u * -54 + u * u * 206 };
}

// Panjang busur (dihitung sekali) untuk garis "sudah dilalui".
const ARC_LEN = (() => {
  let len = 0;
  let prev = point(0);
  for (let i = 1; i <= 80; i++) {
    const p = point(i / 80);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
})();

type Props = { prayers: Prayer[]; now: number; nextKey: string };

export function PrayerArc({ prayers, now, nextKey }: Props) {
  const [w, setW] = useState(0);
  const draw = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion()) return;
    Animated.timing(draw, { toValue: 1, duration: 1400, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [draw, pulse]);

  const first = prayers[0]?.at ?? now;
  const last = prayers[prayers.length - 1]?.at ?? now + 1;
  const a = hourOfDay(first);
  const b = hourOfDay(last);
  const u = Math.min(1, Math.max(0, (hourOfDay(now) - a) / Math.max(0.1, b - a)));
  const sun = point(u);
  const k = w / VB_W;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0.25] });

  return (
    <View onLayout={onLayout} style={{ width: '100%', height: w ? (w * VB_H) / VB_W : 200 }}>
      {w > 0 ? (
        <Animated.View style={{ opacity: draw }}>
          <Svg width={w} height={(w * VB_H) / VB_W} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Defs>
              <SvgLinear id="arcG" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFE3C4" stopOpacity="0.3" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="1" stopColor="#E9D2FF" stopOpacity="0.4" />
              </SvgLinear>
              <SvgLinear id="hor" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </SvgLinear>
              <RadialGradient id="sunG" cx="40%" cy="35%" r="70%">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.45" stopColor="#FFF1DE" />
                <Stop offset="1" stopColor="#FFC48E" />
              </RadialGradient>
            </Defs>
            <Path d="M0 206.5 H350" stroke="url(#hor)" strokeWidth={1} />
            <Path d={ARC} stroke="rgba(255,255,255,0.28)" strokeWidth={1.3} strokeDasharray="1 6" strokeLinecap="round" fill="none" />
            <Path
              d={ARC}
              stroke="url(#arcG)"
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${(ARC_LEN * u).toFixed(1)} ${ARC_LEN.toFixed(1)}`}
            />
            {prayers.map((p) => {
              const uu = Math.min(1, Math.max(0, (hourOfDay(p.at) - a) / Math.max(0.1, b - a)));
              const pt = point(uu);
              const past = p.at < now;
              const isNext = p.key === nextKey;
              const up = pt.y < 130;
              return (
                <G key={p.key}>
                  {isNext ? <Circle cx={pt.x} cy={pt.y} r={11} stroke="#FFE3C4" strokeWidth={1.2} fill="none" /> : null}
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isNext ? 7 : 5}
                    fill={past ? '#FFFFFF' : isNext ? '#FFD7AE' : 'rgba(30,10,4,0.6)'}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={1.4}
                  />
                  <SvgText
                    x={pt.x}
                    y={pt.y + (up ? -30 : 26)}
                    fill={isNext ? '#FFE3C4' : '#FFFFFF'}
                    fontSize={11}
                    fontFamily={isNext ? font.heavy : font.semibold}
                    textAnchor="middle"
                  >
                    {p.name}
                  </SvgText>
                  <SvgText
                    x={pt.x}
                    y={pt.y + (up ? -16 : 40)}
                    fill="rgba(255,255,255,0.78)"
                    fontSize={11}
                    fontFamily={font.pixel}
                    textAnchor="middle"
                  >
                    {hhmm(p.at)}
                  </SvgText>
                </G>
              );
            })}
            <Circle cx={sun.x} cy={sun.y} r={12} fill="url(#sunG)" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.8} />
          </Svg>
          {/* Cahaya matahari yang bernapas (animasi di sisi native, ringan). */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                left: sun.x * k - 26,
                top: sun.y * k - 26,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,231,204,0.28)' },
});
