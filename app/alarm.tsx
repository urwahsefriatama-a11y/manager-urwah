// Layar alarm berbunyi (dibuka oleh alarm native, juga saat HP terkunci).
// Geser untuk mematikan, atau tunda 5/10/15 menit.
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { Icon } from '../src/ui/Icon';
import { PressableScale } from '../src/ui/PressableScale';
import { color, radius } from '../src/ui/theme';
import { native } from '../modules/urwah-native/src';
import { markFired } from '../src/data/alarms';
import { hhmm, longDate } from '../src/lib/time';
import { heavy, success } from '../src/lib/haptics';

const TRACK = 330;
const KNOB = 96;

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function AlarmRing() {
  const { id = '', title = 'Alarm', body = '' } = useLocalSearchParams<{ id?: string; title?: string; body?: string }>();
  const [now, setNow] = useState(Date.now());
  const x = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    // Tombol kembali tidak mematikan alarm secara tidak sengaja.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    native.showOverLock(true);
    return () => {
      native.showOverLock(false);
      clearInterval(t);
      loop.stop();
      sub.remove();
    };
  }, [breathe]);

  const dismiss = () => {
    native.stopRinging(id);
    if (id) markFired(id.replace(/#snooze$/, ''));
    success();
    leave();
  };

  const snooze = (m: number) => {
    native.snooze(id, m);
    heavy();
    leave();
  };

  const max = TRACK - KNOB - 16;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => heavy(),
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(max, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (g.dx > max * 0.8) {
          Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: true }).start(dismiss);
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 10 }).start();
        }
      },
    }),
  ).current;

  const hint = x.interpolate({ inputRange: [0, max * 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const glow = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const [hh, mm] = hhmm(now).split(':');

  return (
    <Screen bg="alarm" fixed>
      <View style={styles.top}>
        <T size={26} weight="heavy">
          Alarm
        </T>
        <T size={13} muted>
          {longDate(now)}
        </T>
      </View>
      <View style={styles.wrap}>
        <Glass strong style={styles.dial}>
          <View style={styles.dotW} />
          <Animated.View style={[styles.dotA, { opacity: glow }]} />
          <T pixel size={96} maxFontSizeMultiplier={1} style={{ lineHeight: 92 }}>
            {hh}
          </T>
          <T pixel size={96} maxFontSizeMultiplier={1} style={{ lineHeight: 92, marginTop: 8 }}>
            {mm}
          </T>
        </Glass>
        <T size={16} weight="bold" style={{ marginTop: 22, textAlign: 'center' }} numberOfLines={2}>
          {body || title}
        </T>
        <Glass style={styles.track}>
          <Animated.View style={[styles.hint, { opacity: hint }]} pointerEvents="none">
            <Icon name="chev" size={22} color="rgba(255,255,255,0.35)" strokeWidth={2.4} />
            <Icon name="chev" size={22} color="rgba(255,255,255,0.55)" strokeWidth={2.4} />
            <Icon name="chev" size={22} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
          </Animated.View>
          <Animated.View {...pan.panHandlers} style={[styles.knob, { transform: [{ translateX: x }] }]}>
            <T size={16} weight="heavy">
              Matikan
            </T>
          </Animated.View>
        </Glass>
      </View>
      <Svg width="100%" height={70} viewBox="0 0 346 70" preserveAspectRatio="none">
        <Path d="M10 60 Q173 -10 336 60" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2} strokeDasharray="1 7" strokeLinecap="round" />
        <Circle cx={173} cy={25} r={4} fill={color.accent} />
      </Svg>
      <View style={styles.snoozeRow}>
        {[5, 10, 15].map((m) => (
          <PressableScale key={m} accessibilityLabel={`Tunda ${m} menit`} onPress={() => snooze(m)} style={styles.snooze}>
            <T size={14} weight="heavy">{`Tunda ${m} mnt`}</T>
          </PressableScale>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dial: { width: 300, height: 300, borderRadius: 150, alignItems: 'center', justifyContent: 'center' },
  dotW: { position: 'absolute', left: '22%', top: '20%', width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  dotA: { position: 'absolute', right: 6, top: '50%', marginTop: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: color.accent },
  track: { width: TRACK, height: KNOB + 16, borderRadius: 999, marginTop: 14, justifyContent: 'center', padding: 8 },
  hint: { position: 'absolute', right: 30, flexDirection: 'row', gap: 0 },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#E8652A', alignItems: 'center', justifyContent: 'center', shadowColor: '#C8410A', shadowOpacity: 0.5, shadowRadius: 14, elevation: 8 },
  snoozeRow: { flexDirection: 'row', gap: 10 },
  snooze: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
});
