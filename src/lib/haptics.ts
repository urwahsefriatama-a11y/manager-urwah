// Getar halus saat disentuh. Bisa dimatikan di Pengaturan.
import * as Haptics from 'expo-haptics';
import { getSetting } from '../data/settings';

export function tap() {
  if (getSetting('haptic') === '0') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function success() {
  if (getSetting('haptic') === '0') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
