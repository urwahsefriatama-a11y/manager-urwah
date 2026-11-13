import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '../src/ui/theme';

export default function RootLayout() {
  const c = useColors();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          contentStyle: { backgroundColor: c.bg },
        }}
      />
    </>
  );
}
