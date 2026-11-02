import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../core/api/supabase';
import { sendLocalCommand } from '../../core/local-sync';
import { deviceStorage } from '../../core/storage';

export default function PairDeviceScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [setupMode, setSetupMode] = useState<'choose' | 'waiter'>('choose');
  const [showManualPairing, setShowManualPairing] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActivation, setPendingActivation] = useState<{ id: string; code: string } | null>(null);

  useEffect(() => {
    const restorePendingRequest = async () => {
      const id = await deviceStorage.get('pending_activation_id');
      const code = await deviceStorage.get('pending_activation_code');
      if (id && code) setPendingActivation({ id, code });
    };
    void restorePendingRequest();
  }, []);

  useEffect(() => {
    if (!pendingActivation) return;
    let cancelled = false;
    const checkActivation = async () => {
      const { data, error } = await supabase.rpc('get_device_activation', { p_device_id: pendingActivation.id });
      if (error || cancelled) return;
      const activation = Array.isArray(data) ? data[0] : data;
      if (activation?.trust_status === 'expired') {
        await deviceStorage.remove('pending_activation_id');
        await deviceStorage.remove('pending_activation_code');
        if (!cancelled) {
          setPendingActivation(null);
          Alert.alert('Codigo vencido', 'Solicita un nuevo codigo para activar la caja.');
        }
        return;
      }
      if (activation?.trust_status !== 'trusted' || !activation.tenant_id) return;

      await deviceStorage.set('device_enrolled', 'true');
      await deviceStorage.set('is_server', 'true');
      await deviceStorage.set('device_token', pendingActivation.id);
      await deviceStorage.set('pairing_secret', Crypto.randomUUID());
      await deviceStorage.set('tenant_id', activation.tenant_id);
      await deviceStorage.set('restaurant_name', activation.restaurant_name || 'Restaurante');
      await deviceStorage.set('last_license_check', new Date().toISOString());
      await deviceStorage.remove('pending_activation_id');
      await deviceStorage.remove('pending_activation_code');
      if (!cancelled) router.replace('/(auth)/pin-login');
    };
    void checkActivation();
    const timer = setInterval(() => void checkActivation(), 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pendingActivation, router]);

  const requestRestaurantActivation = async () => {
    setIsProcessing(true);
    try {
      const id = Crypto.randomUUID();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { error } = await supabase.rpc('request_device_activation', {
        p_device_id: id,
        p_pairing_code: code,
        p_device_name: Platform.OS === 'android' ? 'Caja Android' : 'Caja Principal',
        p_hardware_id: `${Platform.OS}-${id}`,
      });
      if (error) throw error;
      await deviceStorage.set('pending_activation_id', id);
      await deviceStorage.set('pending_activation_code', code);
      setPendingActivation({ id, code });
    } catch (error: any) {
      Alert.alert('No se pudo solicitar la activacion', error.message || 'Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveLocalPairing = async (config: { server_ip: string; pairing_secret: string; restaurant_name: string; tenant_id: string }) => {
    setIsProcessing(true);
    try {
      await sendLocalCommand(config.server_ip, config.pairing_secret, 'snapshot');
      await deviceStorage.set('device_enrolled', 'true');
      await deviceStorage.set('is_server', 'false');
      await deviceStorage.set('device_token', Crypto.randomUUID());
      await deviceStorage.set('server_ip', config.server_ip);
      await deviceStorage.set('pairing_secret', config.pairing_secret);
      await deviceStorage.set('restaurant_name', config.restaurant_name);
      await deviceStorage.set('tenant_id', config.tenant_id || 'local');
      await deviceStorage.set('last_license_check', new Date().toISOString());
      Alert.alert('Telefono vinculado', `Conexion local verificada con ${config.restaurant_name}.`);
      router.replace('/(auth)/pin-login');
    } catch (error: any) {
      Alert.alert('No se pudo conectar con la caja', error.message || 'Revisa que ambos telefonos esten en la misma WiFi.');
    } finally {
      setIsProcessing(false);
      setIsScanning(false);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isProcessing) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.mode !== 'local-pairing' || !parsed.server_ip || !parsed.pairing_secret) {
        throw new Error('Codigo QR local no valido.');
      }
      await saveLocalPairing({
        server_ip: parsed.server_ip,
        pairing_secret: parsed.pairing_secret,
        restaurant_name: parsed.restaurant_name || 'Restaurante',
        tenant_id: parsed.tenant_id || 'local',
      });
    } catch (error: any) {
      Alert.alert('Error de vinculacion', error.message || 'No se pudo leer el codigo QR.');
      setIsScanning(false);
    }
  };

  const handleManualPair = async () => {
    const server_ip = manualAddress.trim();
    const pairing_secret = manualSecret.trim();
    if (!server_ip || !pairing_secret) {
      Alert.alert('Faltan datos', 'Ingresa la dirección de la caja y su clave de emparejamiento.');
      return;
    }
    await saveLocalPairing({ server_ip, pairing_secret, restaurant_name: 'Restaurante local', tenant_id: 'local' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
      <View style={styles.header}>
        <View style={styles.logoBadge}><Text style={styles.logoText}>C</Text></View>
        <Text style={styles.title}>Configura este teléfono</Text>
       </View>

      {pendingActivation ? (
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Activa la caja principal</Text>
          <Text style={styles.subtitle}>Ingresa este código en la consola web de activaciones:</Text>
          <Text style={styles.pairingCode}>{pendingActivation.code}</Text>
          <Text style={styles.subtitle}>Al completar la activación, este teléfono quedará configurado como la caja principal del restaurante.</Text>
        </View>
      ) : isScanning ? (
        <View style={styles.cameraBox}>
          {permission?.granted ? (
            <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned} />
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>Se necesita permiso para usar la camara.</Text>
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}><Text style={styles.permBtnText}>Conceder permiso</Text></TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setIsScanning(false)}><Text style={styles.cancelScanText}>Cancelar</Text></TouchableOpacity>
        </View>
      ) : setupMode === 'waiter' ? (
        <View style={styles.actionsContainer}>
          <TouchableOpacity onPress={() => { setSetupMode('choose'); setShowManualPairing(false); }}>
            <Text style={styles.backLink}>‹ Volver a opciones</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Conectar teléfono de mesero</Text>
          <Text style={styles.subtitle}>En la caja principal, abre Personal y Meseros y escanea su código QR desde este teléfono.</Text>
          <TouchableOpacity style={styles.scanButton} activeOpacity={0.8} onPress={() => setIsScanning(true)}>
            <Text style={styles.scanIcon}>QR</Text><Text style={styles.scanButtonText}>Escanear QR de la caja</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowManualPairing(value => !value)}>
            <Text style={styles.manualLink}>{showManualPairing ? 'Ocultar conexión manual' : '¿No puedes escanear el QR? Conexión manual'}</Text>
          </TouchableOpacity>
          {showManualPairing && (
            <View style={styles.manualBox}>
              <Text style={styles.manualHelp}>Usa la dirección y la clave que aparecen en la pantalla de emparejamiento de la caja. Ambos teléfonos deben estar en la misma red Wi-Fi.</Text>
              <TextInput
                style={styles.input}
                placeholder="Dirección de la caja (ej. 192.168.1.10:8080)"
                placeholderTextColor="#64748b"
                value={manualAddress}
                onChangeText={setManualAddress}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextInput
                style={styles.input}
                placeholder="Clave de emparejamiento"
                placeholderTextColor="#64748b"
                value={manualSecret}
                onChangeText={setManualSecret}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity style={styles.manualBtn} onPress={() => void handleManualPair()} disabled={isProcessing}>
                <Text style={styles.manualBtnText}>{isProcessing ? 'Conectando…' : 'Conectar con la caja'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>¿Cómo usarás este teléfono?</Text>
          <Text style={styles.subtitle}>La caja principal se activa una sola vez desde la consola web. Los teléfonos de meseros se conectan a esa caja por la red local.</Text>
          <TouchableOpacity style={styles.adminButton} activeOpacity={0.8} onPress={() => void requestRestaurantActivation()} disabled={isProcessing}>
            <Text style={styles.scanButtonText}>{isProcessing ? 'Solicitando…' : 'Configurar caja principal'}</Text>
            <Text style={styles.optionDescription}>Solicita un código y complétalo en la consola web.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.waiterButton} activeOpacity={0.8} onPress={() => setSetupMode('waiter')}>
            <Text style={styles.scanButtonText}>Conectar teléfono de mesero</Text>
            <Text style={styles.optionDescription}>Escanea el QR que muestra la caja principal.</Text>
          </TouchableOpacity>
        </View>
      )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', gap: 20, padding: 20, paddingTop: 16, paddingBottom: 28 },
  header: { alignItems: 'center', marginTop: 0 },
  logoBadge: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  logoText: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  title: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  actionsContainer: { gap: 12, marginVertical: 0 },
  sectionTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', textAlign: 'center' },
  optionDescription: { color: '#a5b4fc', fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 17 },
  adminButton: { backgroundColor: '#1e1b4b', borderWidth: 1.5, borderColor: '#6366f1', padding: 16, borderRadius: 16, alignItems: 'center' },
  waiterButton: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', padding: 16, borderRadius: 16, alignItems: 'center' },
  backLink: { color: '#a5b4fc', fontSize: 13, marginBottom: 4 },
  manualLink: { color: '#94a3b8', fontSize: 12, textAlign: 'center', textDecorationLine: 'underline' },
  manualBox: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  manualHelp: { color: '#94a3b8', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  scanButton: { backgroundColor: '#1e1b4b', borderWidth: 1.5, borderColor: '#6366f1', padding: 20, borderRadius: 16, alignItems: 'center', gap: 6 },
  scanIcon: { fontSize: 32 },
  scanButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e293b' },
  dividerText: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 14, textAlign: 'center' },
  manualBtn: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12, alignItems: 'center' },
  manualBtnText: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold' },

  cameraBox: { height: 320, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000000', justifyContent: 'flex-end', padding: 16 },
  permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionText: { color: '#ffffff', textAlign: 'center', marginBottom: 12 },
  permBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  permBtnText: { color: '#ffffff', fontWeight: 'bold' },
  cancelScanBtn: { backgroundColor: '#0f172a95', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelScanText: { color: '#ffffff', fontWeight: 'bold' },

  pairingCode: { color: '#ffffff', fontSize: 34, fontWeight: 'bold', textAlign: 'center', letterSpacing: 8 },
});
