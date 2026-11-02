import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="tables" options={{ title: 'Mapa de Mesas y Comandas' }} />
      <Stack.Screen name="menu" options={{ title: 'Platos y Menú' }} />
      <Stack.Screen name="staff" options={{ title: 'Gestión de Meseros' }} />
      <Stack.Screen name="terminals" options={{ title: 'Terminales y PIN Maestro' }} />
    </Stack>
  );
}
