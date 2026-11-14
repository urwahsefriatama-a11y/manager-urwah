// Getar saat disentuh. Bisa dimatikan di Pengaturan.
import * as Haptics from 'expo-haptics';
import { getSetting } from '../data/settings';

const on = () => getSetting('haptic') !== '0';

/** Ketukan tegas saat jari menekan tombol (dipakai PressableScale). */
export function press() {
  if (!on()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function tap() {
  if (!on()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function heavy() {
  if (!on()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function success() {
  if (!on()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
