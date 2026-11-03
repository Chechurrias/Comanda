import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../core/api/supabase';
import { deviceStorage } from '../../core/storage';

type PendingActivation = { id: string; code: string };

export default function CloudDeviceActivationScreen() {
  const router = useRouter();
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activationError, setActivationError] = useState('');

  useEffect(() => {
    let active = true;
    const restorePendingRequest = async () => {
      const [id, code] = await Promise.all([
        deviceStorage.get('pending_activation_id'),
        deviceStorage.get('pending_activation_code'),
      ]);
      if (active && id && code) setPendingActivation({ id, code });
    };

    void restorePendingRequest();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingActivation) return;
    let cancelled = false;
    const checkActivation = async () => {
      const { data, error } = await supabase.rpc('get_device_activation', {
        p_device_id: pendingActivation.id,
      });
      if (cancelled) return;
      if (error) {
        setActivationError(error.message);
        return;
      }

      const activation = Array.isArray(data) ? data[0] : data;
      if (activation?.trust_status === 'expired') {
        await Promise.all([
          deviceStorage.remove('pending_activation_id'),
          deviceStorage.remove('pending_activation_code'),
        ]);
        if (!cancelled) {
          setPendingActivation(null);
          setActivationError('El código venció. Solicita uno nuevo.');
        }
        return;
      }
      if (activation?.trust_status !== 'trusted' || !activation.tenant_id) return;

      await Promise.all([
        deviceStorage.set('device_enrolled', 'true'),
        deviceStorage.set('device_token', pendingActivation.id),
        deviceStorage.set('tenant_id', activation.tenant_id),
        deviceStorage.set('restaurant_name', activation.restaurant_name || 'Restaurante'),
        deviceStorage.set('last_license_check', new Date().toISOString()),
        deviceStorage.remove('is_server'),
        deviceStorage.remove('server_ip'),
        deviceStorage.remove('pairing_secret'),
        deviceStorage.remove('pending_activation_id'),
        deviceStorage.remove('pending_activation_code'),
      ]);
      if (!cancelled) router.replace('/(auth)/pin-login');
    };

    void checkActivation();
    const timer = setInterval(() => void checkActivation(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingActivation, router]);

  const requestActivation = async () => {
    setIsProcessing(true);
    setActivationError('');
    try {
      const id = Crypto.randomUUID();
      const randomBytes = await Crypto.getRandomBytesAsync(4);
      const randomNumber = ((randomBytes[0] << 24) | (randomBytes[1] << 16) | (randomBytes[2] << 8) | randomBytes[3]) >>> 0;
      const code = String(100000 + (randomNumber % 900000));
      const { error } = await supabase.rpc('request_device_activation', {
        p_device_id: id,
        p_pairing_code: code,
        p_device_name: Platform.OS === 'android' ? 'Android' : 'iOS',
        p_hardware_id: `${Platform.OS}-${id}`,
      });
      if (error) throw error;

      await Promise.all([
        deviceStorage.set('pending_activation_id', id),
        deviceStorage.set('pending_activation_code', code),
      ]);
      setPendingActivation({ id, code });
    } catch (error: any) {
      setActivationError(error.message || 'No se pudo solicitar la activación.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>C</Text>
        <Text style={styles.title}>Activación cloud del dispositivo</Text>
        {pendingActivation ? (
          <>
            <Text style={styles.subtitle}>Comparte este código con el administrador de la plataforma para autorizar el dispositivo:</Text>
            <Text style={styles.code}>{pendingActivation.code}</Text>
            <ActivityIndicator color="#818cf8" />
            <Text style={styles.subtitle}>La activación se confirmará automáticamente.</Text>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Registra este dispositivo en la nube para habilitar el acceso al restaurante.</Text>
            <TouchableOpacity style={styles.button} onPress={() => void requestActivation()} disabled={isProcessing}>
              <Text style={styles.buttonText}>{isProcessing ? 'Solicitando…' : 'Solicitar activación'}</Text>
            </TouchableOpacity>
          </>
        )}
        {activationError ? <Text style={styles.error}>{activationError}</Text> : null}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center', gap: 16 },
  logo: { color: '#ffffff', backgroundColor: '#4f46e5', overflow: 'hidden', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 8, fontSize: 24, fontWeight: 'bold' },
  title: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  code: { color: '#a5b4fc', fontSize: 36, fontWeight: 'bold', letterSpacing: 8 },
  button: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  error: { color: '#fca5a5', textAlign: 'center', fontSize: 12 },
  backButton: { padding: 10 },
  backText: { color: '#94a3b8', fontSize: 13 },
});
