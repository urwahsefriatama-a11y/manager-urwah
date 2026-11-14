import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDb } from '../src/data/db';
import { syncOnceAlarms } from '../src/data/alarms';
import { setupNotifications } from '../src/lib/notify';
import { refreshLocation, schedulePrayerReminders } from '../src/lib/prayer';
import { rescheduleNudge } from '../src/lib/nudge';
import { updateWidget } from '../src/lib/widget';
import { ToastProvider } from '../src/ui/Toast';
import { T } from '../src/ui/T';
import { Island } from '../src/ui/Island';
import { tickIsland } from '../src/lib/islandAuto';
import { startWake, stopWake, wakeEnabled } from '../src/lib/voice';
import { currentPlace } from '../src/lib/prayer';
import { native } from '../modules/urwah-native/src';

function openVoice() {
  router.navigate({ pathname: '/asisten', params: { mode: 'voice', t: String(Date.now()) } });
}

let booted = false;
let bootError: string | null = null;
try {
  initDb();
  booted = true;
} catch (e) {
  bootError = e instanceof Error ? e.message : String(e);
}

/** "Halo asisten": mendengar hanya saat app terbuka & bukan di layar asisten/rekam. */
function WakeWord() {
  const path = usePathname();
  useEffect(() => {
    const busy = path.startsWith('/asisten') || path.startsWith('/rekam') || path.startsWith('/alarm');
    const run = () => {
      if (!busy && wakeEnabled() && AppState.currentState === 'active') startWake(openVoice);
      else stopWake();
    };
    run();
    const sub = AppState.addEventListener('change', run);
    return () => {
      sub.remove();
      stopWake();
    };
  }, [path]);
  return null;
}

export default function RootLayout() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!booted) return;
    // Pekerjaan latar saat app dibuka; kegagalan tidak menghentikan app.
    (async () => {
      try {
        await setupNotifications();
        await syncOnceAlarms();
        await refreshLocation();
        await schedulePrayerReminders();
        await rescheduleNudge();
        updateWidget();
      } catch {
        // Diabaikan: app tetap bisa dipakai.
      }
      setTick((n) => n + 1);
    })();
  }, []);

  // Pulau otomatis (pengingat & shalat terdekat).
  useEffect(() => {
    if (!booted) return;
    tickIsland();
    const t = setInterval(tickIsland, 30000);
    return () => clearInterval(t);
  }, []);

  // Dibuka dari tombol asisten HP (tekan lama tombol samping) → langsung mode bicara.
  useEffect(() => {
    if (!booted) return;
    if (native.launchedByAssist()) setTimeout(openVoice, 400);
    const sub = native.onAssist(() => openVoice());
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active' && native.launchedByAssist()) openVoice();
    });
    return () => {
      sub.remove();
      app.remove();
    };
  }, []);

  // Ketuk notifikasi: masjid → Google Maps, chat WA → layar chat.
  useEffect(() => {
    if (!booted) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as Record<string, string> | undefined;
      const title = r.notification.request.content.title ?? '';
      if (data?.url === 'masjid') {
        const p = currentPlace();
        Linking.openURL(`https://www.google.com/maps/search/masjid/@${p.lat},${p.lon},16z`);
      } else if (title.startsWith('Kirim WhatsApp')) router.navigate('/chat');
      else if (title === 'Asisten') router.navigate('/asisten');
    });
    return () => sub.remove();
  }, []);

  if (!booted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0505', justifyContent: 'center', padding: 24 }}>
        <T size={18} weight="bold">Database tidak bisa dibuka</T>
        <T muted style={{ marginTop: 8 }}>{bootError}</T>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 260,
            contentStyle: { backgroundColor: '#0A0505' },
          }}
        >
          <Stack.Screen name="alarm" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
        <Island />
        <WakeWord />
      </ToastProvider>
    </SafeAreaProvider>
  );
}
