import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../core/api/supabase';
import { authSession } from '../../core/auth-session';
import { deviceStorage } from '../../core/storage';

const RESTAURANT_WAITER_IMAGE = require('../../../assets/images/Mesero profile.jpg');

export default function WaiterLoginScreen() {
  const router = useRouter();

  // 1. Identificador del Restaurante
  const [restaurantId, setRestaurantId] = useState('');
  // 2. Nombre del Mesero
  const [waiterName, setWaiterName] = useState('');
  // 3. PIN de 4 dígitos
  const [pin, setPin] = useState('');

  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const loadDefaults = async () => {
      const savedTenant = await deviceStorage.get('tenant_slug');
      const savedWaiter = await deviceStorage.get('last_waiter_name');
      if (savedTenant) setRestaurantId(savedTenant);
      if (savedWaiter) setWaiterName(savedWaiter);
    };
    loadDefaults();
  }, []);

  const handlePressNumber = (num: string) => {
    if (isVerifying) return;
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        executeWaiterLogin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isVerifying) return;
    setPin('');
  };

  // TRIPLE VALIDACIÓN EN SUPABASE
  const executeWaiterLogin = async (enteredPin: string) => {
    if (!restaurantId.trim()) {
      Alert.alert('Dato requerido', 'Ingresa el Identificador de tu Restaurante (ej: demo).');
      setPin('');
      return;
    }

    if (!waiterName.trim()) {
      Alert.alert('Dato requerido', 'Ingresa tu Nombre de mesero registrado.');
      setPin('');
      return;
    }

    setIsVerifying(true);
    try {
      const cleanSlug = restaurantId.trim().toLowerCase();
      const cleanName = waiterName.trim();

      // Llamar a la función RPC en Supabase
      const { data, error } = await supabase.rpc('login_waiter', {
        p_restaurant_identifier: cleanSlug,
        p_waiter_name: cleanName,
        p_pin: enteredPin.trim()
      });

      if (error) throw error;

      if (!data || !data.success) {
        if (Platform.OS !== 'web') Vibration.vibrate(250);
        Alert.alert('Acceso Denegado', data?.error || 'Credenciales inválidas.');
        setPin('');
        return;
      }

      // 1. Guardar preferencias
      await deviceStorage.set('tenant_slug', cleanSlug);
      await deviceStorage.set('last_waiter_name', cleanName);

      // 2. Guardar sesión completa en authSession
      await authSession.saveUser({
        tenant_id: data.tenant_id,
        restaurant_name: data.restaurant_name,
        staff_id: data.staff_id,
        full_name: data.full_name,
        role: data.role || 'waiter_basic'
      });

      // 3. Redirigir a las mesas de la sala
      router.replace('/(waiter)/tables');

    } catch (err: any) {
      Alert.alert('Error de Conexión', err.message || 'Verifica tu conexión a internet.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Barra Superior */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.badgeTop}>Mesero</Text>
      </View>

      {/* Contenido Principal */}
      <View style={styles.header}>
        <View style={styles.imageContainer}>
          <Image
            source={RESTAURANT_WAITER_IMAGE}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.title}>Turno de Mesero</Text>
        <Text style={styles.subtitle}>Valida tus 3 credenciales asignadas</Text>

        <View style={styles.inputsBox}>
          {/* Campo 1 */}
          <View>
            <Text style={styles.inputLabel}>1. Identificador del Restaurante *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: demo"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              value={restaurantId}
              onChangeText={setRestaurantId}
              editable={!isVerifying}
            />
          </View>

          {/* Campo 2 */}
          <View>
            <Text style={styles.inputLabel}>2. Nombre del Mesero *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Carlos Mesero"
              placeholderTextColor="#64748b"
              autoCapitalize="words"
              value={waiterName}
              onChangeText={setWaiterName}
              editable={!isVerifying}
            />
          </View>
        </View>

        {/* 4 Puntos del PIN */}
        <Text style={[styles.inputLabel, { marginTop: 10 }]}>3. PIN de turno (4 dígitos) *</Text>
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3].map(index => (
            <View
              key={index}
              style={[styles.dot, pin.length > index && styles.dotFilled]}
            />
          ))}
        </View>

        {isVerifying && (
          <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 6 }} />
        )}
      </View>

      {/* Teclado Numérico */}
      <View style={styles.keypadWrapper}>
        <View style={styles.keypadRow}>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('1')} activeOpacity={0.6}>
            <Text style={styles.keyText}>1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('2')} activeOpacity={0.6}>
            <Text style={styles.keyText}>2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('3')} activeOpacity={0.6}>
            <Text style={styles.keyText}>3</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.keypadRow}>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('4')} activeOpacity={0.6}>
            <Text style={styles.keyText}>4</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('5')} activeOpacity={0.6}>
            <Text style={styles.keyText}>5</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('6')} activeOpacity={0.6}>
            <Text style={styles.keyText}>6</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.keypadRow}>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('7')} activeOpacity={0.6}>
            <Text style={styles.keyText}>7</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('8')} activeOpacity={0.6}>
            <Text style={styles.keyText}>8</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('9')} activeOpacity={0.6}>
            <Text style={styles.keyText}>9</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.keypadRow}>
          <TouchableOpacity style={styles.keySpecial} onPress={handleClear} activeOpacity={0.6}>
            <Text style={styles.keySpecialText}>Borrar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.key} onPress={() => handlePressNumber('0')} activeOpacity={0.6}>
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.keySpecial} onPress={handleDelete} activeOpacity={0.6}>
            <Text style={styles.keyText}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', justifyContent: 'space-between', paddingVertical: 10 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#1e293b' },
  backBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  badgeTop: { color: '#34d399', fontSize: 12, fontWeight: 'bold', backgroundColor: '#064e3b', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },

  header: { alignItems: 'center', paddingHorizontal: 24 },
  imageContainer: { width: 180, height: 180, borderRadius: 25, overflow: 'hidden', marginBottom: 4 },
  heroImage: { width: '100%', height: '100%' },
  title: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  inputsBox: { width: '100%', marginTop: 8, gap: 6 },
  inputLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, color: '#ffffff', fontSize: 13, fontWeight: '600' },

  dotsContainer: { flexDirection: 'row', gap: 14, marginTop: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#334155', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#10b981', borderColor: '#34d399' },

  keypadWrapper: { width: '100%', maxWidth: 320, alignSelf: 'center', paddingBottom: 10, gap: 8 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  key: { width: 78, height: 52, borderRadius: 16, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  keySpecial: { width: 78, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  keyText: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  keySpecialText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
});