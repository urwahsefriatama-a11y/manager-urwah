// Pulau notifikasi ala prototipe: kapsul hitam di dekat lubang kamera yang berubah wujud
// (tersembunyi → kapsul → terbuka) dengan pegas, isi muncul bertahap.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './T';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { island, type IslandState, type IslandType } from '../lib/island';
import { getSetting } from '../data/settings';

const COLORS: Record<IslandType, string> = {
  rec: '#E8857F',
  proc: '#CFE3B0',
  next: '#FFB27E',
  shalat: '#C6CBF5',
  nudge: '#FFB27E',
  done: '#CFE3B0',
  chat: '#A9D8B8',
};
const ICONS: Record<IslandType, IconName> = {
  rec: 'rec',
  proc: 'spark',
  next: 'bell',
  shalat: 'shalat',
  nudge: 'chat',
  done: 'check',
  chat: 'chat',
};
const PILL = { w: 230, h: 38 };
const SPRING = { useNativeDriver: false, speed: 11, bounciness: 7 } as const;

export function Island() {
  const inset = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [s, setS] = useState<IslandState>(island.get());
  const W = useRef(new Animated.Value(120)).current;
  const H = useRef(new Animated.Value(36)).current;
  const R = useRef(new Animated.Value(18)).current;
  const vis = useRef(new Animated.Value(0)).current;
  const pillO = useRef(new Animated.Value(0)).current;
  const bigO = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => island.subscribe(setS), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const openW = Math.min(366, width - 24);
  useEffect(() => {
    const m = s.mode;
    const w = m === 'open' ? openW : m === 'pill' ? PILL.w : 120;
    const h = m === 'open' ? 200 : m === 'pill' ? PILL.h : 36;
    const r = m === 'open' ? 46 : 19;
    Animated.parallel([
      Animated.spring(W, { toValue: w, ...SPRING }),
      Animated.spring(H, { toValue: h, ...SPRING }),
      Animated.spring(R, { toValue: r, ...SPRING }),
      Animated.timing(vis, { toValue: m === 'hidden' ? 0 : 1, duration: m === 'hidden' ? 260 : 320, useNativeDriver: false }),
      // isi hilang cepat sebelum bentuk berubah, lalu muncul setelah bentuk mengembang
      Animated.sequence([
        Animated.timing(pillO, { toValue: 0, duration: 120, useNativeDriver: false }),
        Animated.delay(m === 'pill' ? 160 : 0),
        Animated.timing(pillO, { toValue: m === 'pill' ? 1 : 0, duration: 220, useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.timing(bigO, { toValue: 0, duration: 120, useNativeDriver: false }),
        Animated.delay(m === 'open' ? 220 : 0),
        Animated.timing(bigO, { toValue: m === 'open' ? 1 : 0, duration: 300, useNativeDriver: false }),
      ]),
    ]).start();
  }, [s.mode, openW, W, H, R, vis, pillO, bigO]);

  const d = s.data;
  if (!d) return null;
  const c = COLORS[d.type];
  const pos = getSetting('island_pos') || 'center';
  const align = pos === 'left' ? 'flex-start' : pos === 'right' ? 'flex-end' : 'center';
  const scale = vis.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View pointerEvents="box-none" style={[styles.row, { top: Math.max(inset.top - 30, 6), alignItems: align }]}>
      <Animated.View
        pointerEvents={s.mode === 'hidden' ? 'none' : 'auto'}
        style={[styles.island, { width: W, height: H, borderRadius: R, opacity: vis, transform: [{ scale }] }]}
      >
        {/* kapsul */}
        <Animated.View pointerEvents={s.mode === 'pill' ? 'auto' : 'none'} style={[styles.layer, { opacity: pillO }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${d.pill}, buka pulau`} onPress={() => island.setMode('open')} style={styles.pill}>
            <View style={styles.pillLeft}>
              <Animated.View style={[styles.icSm, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }]}>
                <Icon name={ICONS[d.type]} size={14} color={c} strokeWidth={2.3} />
              </Animated.View>
              <T size={13} weight="heavy" numberOfLines={1} style={{ maxWidth: 120 }}>
                {d.pill}
              </T>
            </View>
            <T pixel size={16} style={{ color: c }} maxFontSizeMultiplier={1}>
              {d.right}
            </T>
          </Pressable>
        </Animated.View>
        {/* terbuka */}
        <Animated.View pointerEvents={s.mode === 'open' ? 'auto' : 'none'} style={[styles.layer, styles.big, { opacity: bigO }]}>
          <View style={styles.bigHead}>
            <View style={styles.icLg}>
              <Icon name={ICONS[d.type]} size={22} color={c} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={12} style={{ color: 'rgba(255,255,255,0.6)' }} numberOfLines={1}>
                {d.kicker}
              </T>
              <T size={16} weight="heavy" numberOfLines={1} style={{ marginTop: 2 }}>
                {d.title}
              </T>
            </View>
            <T pixel size={28} style={{ color: c }} maxFontSizeMultiplier={1}>
              {d.right}
            </T>
          </View>
          {d.pct >= 0 ? (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, d.pct))}%`, backgroundColor: c }]} />
            </View>
          ) : (
            <View style={{ height: 18 }} />
          )}
          <T size={12} numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
            {d.sub}
          </T>
          <View style={{ flex: 1 }} />
          <View style={styles.btns}>
            {d.a ? (
              <PressableScale accessibilityLabel={d.a.label} onPress={d.a.run} style={styles.b}>
                <T size={13} weight="bold">
                  {d.a.label}
                </T>
              </PressableScale>
            ) : null}
            <PressableScale accessibilityLabel="Kecilkan" onPress={() => island.setMode('pill')} style={styles.b}>
              <T size={13} weight="bold">
                Kecilkan
              </T>
            </PressableScale>
            {d.b ? (
              <PressableScale accessibilityLabel={d.b.label} onPress={d.b.run} style={[styles.b, styles.bPri]}>
                <T size={13} weight="bold" style={{ color: '#000' }}>
                  {d.b.label}
                </T>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 100 },
  island: {
    backgroundColor: '#000',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 24,
  },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6, paddingRight: 12 },
  pillLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icSm: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  big: { padding: 20, paddingTop: 22 },
  bigHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icLg: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 18, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 4 },
  btns: { flexDirection: 'row', gap: 8 },
  b: { flex: 1, height: 42, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  bPri: { backgroundColor: '#FFFFFF' },
});
