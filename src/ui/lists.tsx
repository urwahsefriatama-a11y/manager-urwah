// Baris tugas & alarm yang dipakai di Beranda dan layar Tugas.
import { useRef } from 'react';
import { Alert, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { T } from './T';
import { Toggle } from './bits';
import { color, radius } from './theme';
import type { Task } from '../data/tasks';
import type { Alarm } from '../data/alarms';
import { hhmm, pad } from '../lib/time';
import { success } from '../lib/haptics';

export function ProgressRing({ done, total, size = 76 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={7} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#FFFFFF"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(c * frac).toFixed(1)} ${c.toFixed(1)}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <T pixel size={22} maxFontSizeMultiplier={1}>
          {`${done}/${total}`}
        </T>
      </View>
    </View>
  );
}

export function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const done = task.status === 'done';
  const fade = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;

  const toggle = () => {
    if (!done) success();
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }),
    ]).start();
    onToggle();
  };

  const remove = () =>
    Alert.alert('Hapus tugas?', task.title, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () =>
          Animated.timing(fade, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(onDelete),
      },
    ]);

  const scale = fade.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  return (
    <Animated.View style={[styles.row, { opacity: fade, transform: [{ scale }] }]}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={`Selesai: ${task.title}`}
        accessibilityState={{ checked: done }}
        onPress={toggle}
        style={styles.checkHit}
      >
        <Animated.View style={[styles.check, done ? styles.checkOn : styles.checkOff, { transform: [{ scale: pop }] }]}>
          {done ? <Icon name="check" size={14} color={color.ink} strokeWidth={3.2} /> : null}
        </Animated.View>
      </PressableScale>
      <T
        size={15}
        weight="semibold"
        numberOfLines={2}
        style={[styles.flex, done ? { color: color.faint, textDecorationLine: 'line-through' } : null]}
      >
        {task.title}
      </T>
      {task.due_at ? (
        <T pixel size={14} muted maxFontSizeMultiplier={1.1}>
          {hhmm(task.due_at)}
        </T>
      ) : null}
      <PressableScale accessibilityLabel={`Hapus ${task.title}`} onPress={remove} style={styles.iconBtn}>
        <Icon name="trash" size={16} color={color.faint} />
      </PressableScale>
    </Animated.View>
  );
}

export function AlarmRow({ alarm, onToggle, onDelete }: { alarm: Alarm; onToggle: (on: boolean) => void; onDelete: () => void }) {
  const on = !!alarm.enabled;
  const remove = () =>
    Alert.alert('Hapus alarm?', `${pad(alarm.hour)}:${pad(alarm.minute)} · ${alarm.label}`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: onDelete },
    ]);
  return (
    <View style={styles.row}>
      <PressableScale accessibilityLabel={`Alarm ${pad(alarm.hour)}:${pad(alarm.minute)}, tahan untuk hapus`} onLongPress={remove} onPress={() => onToggle(!on)} style={[styles.flex, styles.alarmText, { opacity: on ? 1 : 0.45 }]}>
        <T pixel size={30} maxFontSizeMultiplier={1}>
          {`${pad(alarm.hour)}:${pad(alarm.minute)}`}
        </T>
        <View style={styles.flex}>
          <T size={14} weight="bold" numberOfLines={1}>
            {alarm.label}
          </T>
          <T size={12} muted>
            {alarm.repeat === 'daily' ? 'Setiap hari' : 'Sekali'}
          </T>
        </View>
      </PressableScale>
      <Toggle on={on} onChange={onToggle} label={`Alarm ${pad(alarm.hour)}:${pad(alarm.minute)}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  flex: { flex: 1 },
  checkHit: { padding: 2 },
  check: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 2, borderColor: 'rgba(255,240,230,0.5)' },
  checkOn: { backgroundColor: '#FFFFFF' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  alarmText: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
