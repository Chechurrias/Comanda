import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deviceStorage } from '../../core/storage';

export default function SuspendedScreen() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  const isOfflineExpired = reason === 'offline_expired';

  const handleRetry = () => {
    // Vuelve a index.tsx para revalidar con Supabase
    router.replace('/');
  };

  const handleUnpair = () => {
    Alert.alert(
      'Desvincular Dispositivo',
      '¿Deseas desvincular este teléfono del restaurante actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            await deviceStorage.remove('device_enrolled');
            await deviceStorage.remove('device_token');
            router.replace('/(auth)/pair-device');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⛔</Text>
        </View>

        <Text style={styles.title}>
          {isOfflineExpired ? 'Verificación Requerida' : 'Acceso Suspendido'}
        </Text>

        <Text style={styles.description}>
          {isOfflineExpired
            ? 'Este dispositivo ha operado sin conexión a Internet por más de 8  días. Por seguridad, conecta la red para revalidar la licencia.'
            : 'El servicio para este establecimiento o dispositivo se encuentra inactivo. Comunícate con el administrador del sistema para reactivar tu cuenta.'}
        </Text>

        <View style={styles.buttonBox}>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>🔄 Reintentar Conexión</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.unpairBtn} onPress={handleUnpair}>
            <Text style={styles.unpairBtnText}>Desvincular este dispositivo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e11d4830',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e11d4815',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e11d4840',
  },
  iconText: {
    fontSize: 34,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonBox: {
    width: '100%',
    gap: 12,
  },
  retryBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  unpairBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  unpairBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
});