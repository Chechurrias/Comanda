import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppUpdatePrompt } from '../components/app-update-prompt';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#020617' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(waiter)" />
      </Stack>
      <AppUpdatePrompt />
    </>
  );
}