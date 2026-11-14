// Pengingat lewat notifikasi lokal (tidak butuh internet atau layanan Google).
// Catatan Android 12+: agar tepat waktu, app memakai izin alarm tepat (lihat app.json).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const CHANNEL = 'pengingat';
export const CHANNEL_PRAYER = 'shalat';

let ready = false;

export async function setupNotifications() {
  if (ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Pengingat & alarm',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_PRAYER, {
      name: 'Waktu shalat',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
}

/** Minta izin notifikasi (Android 13+ wajib). Hasil: true bila diizinkan. */
export async function ensurePermission(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

export async function scheduleAt(title: string, body: string, atMs: number, channelId = CHANNEL, data?: Record<string, string>): Promise<string | null> {
  if (atMs <= Date.now() + 1000) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, ...(data ? { data } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atMs, channelId },
    });
  } catch {
    return null;
  }
}

/** Berulang setiap hari pada jam:menit waktu HP. */
export async function scheduleDaily(title: string, body: string, hour: number, minute: number): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
    });
  } catch {
    return null;
  }
}

export async function cancel(id: string | null | undefined) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Sudah terkirim atau tidak ada: aman diabaikan.
  }
}

/** Id notifikasi yang masih menunggu. null bila gagal dibaca. */
export async function pendingIds(): Promise<Set<string> | null> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return new Set(all.map((n) => n.identifier));
  } catch {
    return null;
  }
}

/** Batalkan banyak id sekaligus (dipisah koma). */
export async function cancelMany(ids: string | null | undefined) {
  if (!ids) return;
  await Promise.all(ids.split(',').filter(Boolean).map((id) => cancel(id)));
}
