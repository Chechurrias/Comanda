import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../../core/api/supabase';
import { localDbService } from '../../core/database';
import { deviceStorage } from '../../core/storage';

export default function TerminalsScreen() {
  const [localIp, setLocalIp] = useState('192.168.1.X:8080');
  const [devicesCount, setDevicesCount] = useState(1);
  const [maxDevices, setMaxDevices] = useState(3);
  const [planName, setPlanName] = useState('Plan Pro');
  const [expiresAt, setExpiresAt] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (Platform.OS !== 'web') {
        const ip = await Network.getIpAddressAsync();
        if (ip) setLocalIp(`${ip}:8080`);
      }

      const tenantId = await deviceStorage.get('tenant_id');
      const deviceId = await deviceStorage.get('device_token');
      if (tenantId && tenantId !== 'local' && deviceId) {
        const { data, error } = await supabase.rpc('get_mobile_license_summary', {
          p_tenant_id: tenantId,
          p_device_id: deviceId,
        });
        if (error) throw error;
        const summary = Array.isArray(data) ? data[0] : data;
        if (summary) {
          setPlanName(summary.plan_name || summary.plan_code || 'Plan');
          setMaxDevices(summary.max_devices ?? 1);
          setExpiresAt(summary.expires_at?.split('T')[0] || '');
          setDevicesCount(summary.devices_count ?? 0);
        }
      }
    };

    loadData();
  }, []);

  const handleUpdatePin = () => {
    if (newPin.length !== 4) {
      Alert.alert('PIN Inválido', 'El PIN debe tener 4 dígitos exactos.');
      return;
    }

    localDbService.updateAdminPin(newPin);
    setIsModalOpen(false);
    setNewPin('');
    Alert.alert('PIN Actualizado', `Tu nuevo PIN de Gerencia es: ${newPin}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* Tarjeta Servidor Local */}
      <View style={styles.cardHighlight}>
        <Text style={styles.cardHighlightTitle}>📡 Punto de Enlace WiFi (Caja)</Text>
        <Text style={styles.cardHighlightSub}>
          Esta terminal actúa como servidor central. Los meseros deben conectarse a esta dirección IP en el WiFi del restaurante:
        </Text>
        <View style={styles.ipBadge}>
          <Text style={styles.ipText}>{localIp}</Text>
        </View>
      </View>

      {/* Tarjeta Cupo de Terminales */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SUPERVISIÓN DE TERMINALES</Text>
        <Text style={styles.planName}>{planName}</Text>
        <Text style={styles.planSub}>Vencimiento de Licencia: {expiresAt}</Text>

        <View style={styles.metricRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{devicesCount} / {maxDevices}</Text>
            <Text style={styles.metricLbl}>Terminales en uso</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>{maxDevices - devicesCount}</Text>
            <Text style={styles.metricLbl}>Cupos disponibles</Text>
          </View>
        </View>
      </View>

      {/* Tarjeta Seguridad PIN Maestro */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>SEGURIDAD DE ACCESO</Text>
        <Text style={styles.cardSub}>
          El PIN maestro te permite acceder a este panel de administración y anular pedidos.
        </Text>

        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => setIsModalOpen(true)}
        >
          <Text style={styles.actionBtnText}>🔒 Cambiar PIN Maestro de Gerencia</Text>
        </TouchableOpacity>
      </View>

      {/* Modal PIN */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nuevo PIN Maestro</Text>
            <Text style={styles.modalSub}>Ingresa 4 dígitos numéricos:</Text>

            <TextInput
              style={styles.pinInput}
              placeholder="••••"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              maxLength={4}
              value={newPin}
              onChangeText={setNewPin}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleUpdatePin}>
                <Text style={styles.btnConfirmText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, backgroundColor: '#020617' },
  cardHighlight: { backgroundColor: '#1e1b4b', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#4338ca' },
  cardHighlightTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cardHighlightSub: { color: '#cbd5e1', fontSize: 12, marginTop: 4, lineHeight: 18 },
  ipBadge: { backgroundColor: '#020617', padding: 12, borderRadius: 10, marginTop: 12, alignItems: 'center', borderWidth: 1, borderColor: '#312e81' },
  ipText: { color: '#38bdf8', fontSize: 17, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  card: { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1e293b' },
  cardTitle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  planName: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  planSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  metricBox: { flex: 1, backgroundColor: '#020617', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b' },
  metricVal: { color: '#818cf8', fontSize: 18, fontWeight: 'bold' },
  metricLbl: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
  cardSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, marginBottom: 14 },
  actionBtn: { backgroundColor: '#1e1b4b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4338ca' },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  modalBg: { flex: 1, backgroundColor: '#00000095', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  modalSub: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 12 },
  pinInput: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingVertical: 12, color: '#ffffff', fontSize: 26, textAlign: 'center', letterSpacing: 10, marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10 },
  btnCancelText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  btnConfirm: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#4f46e5', borderRadius: 10 },
  btnConfirmText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});
