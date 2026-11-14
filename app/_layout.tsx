import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
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

let booted = false;
let bootError: string | null = null;
try {
  initDb();
  booted = true;
} catch (e) {
  bootError = e instanceof Error ? e.message : String(e);
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
      </ToastProvider>
    </SafeAreaProvider>
  );
}
