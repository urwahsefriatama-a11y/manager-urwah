// Layar alarm berbunyi (dibuka oleh alarm native, juga saat HP terkunci).
// Geser untuk mematikan, atau tunda 5/10/15 menit.
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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

const TRACK = 300;
const KNOB = 64;

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

  const max = TRACK - KNOB - 8;
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

  const ring = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringO = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.15] });
  const hint = x.interpolate({ inputRange: [0, max * 0.5], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Screen bg="rec" fixed>
      <View style={styles.wrap}>
        <T size={14} weight="bold" muted>
          {longDate(now)}
        </T>
        <T pixel size={96} style={{ marginTop: 4 }} maxFontSizeMultiplier={1}>
          {hhmm(now)}
        </T>
        <View style={styles.bellBox}>
          <Animated.View style={[styles.bellRing, { opacity: ringO, transform: [{ scale: ring }] }]} />
          <Glass strong style={styles.bell}>
            <Icon name="alarm" size={44} strokeWidth={2} />
          </Glass>
        </View>
        <T size={24} weight="heavy" style={{ textAlign: 'center' }} numberOfLines={2}>
          {title}
        </T>
        {body ? (
          <T size={15} muted style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={3}>
            {body}
          </T>
        ) : null}

        <View style={styles.snoozeRow}>
          {[5, 10, 15].map((m) => (
            <PressableScale key={m} accessibilityLabel={`Tunda ${m} menit`} onPress={() => snooze(m)} style={styles.snoozeWrap}>
              <Glass style={styles.snooze}>
                <T pixel size={22} maxFontSizeMultiplier={1}>
                  {String(m)}
                </T>
                <T size={11} weight="bold" muted>
                  mnt
                </T>
              </Glass>
            </PressableScale>
          ))}
        </View>

        <Glass style={styles.track}>
          <Animated.View style={[styles.hint, { opacity: hint }]} pointerEvents="none">
            <T size={15} weight="bold" muted>
              Geser untuk mematikan
            </T>
          </Animated.View>
          <Animated.View {...pan.panHandlers} style={[styles.knob, { transform: [{ translateX: x }] }]}>
            <Icon name="chev" size={26} color={color.ink} strokeWidth={2.8} />
          </Animated.View>
        </Glass>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bellBox: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginVertical: 26 },
  bellRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#FFFFFF' },
  bell: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  snoozeRow: { flexDirection: 'row', gap: 12, marginTop: 34 },
  snoozeWrap: { borderRadius: radius.lg },
  snooze: { width: 78, height: 70, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  track: { width: TRACK, height: KNOB + 8, borderRadius: radius.pill, marginTop: 30, justifyContent: 'center', padding: 4 },
  hint: { position: 'absolute', left: KNOB + 8, right: 0, alignItems: 'center' },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
