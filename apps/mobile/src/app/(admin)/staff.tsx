import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authSession } from '../../core/auth-session';
import { cloudDbService } from '../../core/cloud-db';

export default function StaffManagementScreen() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [restaurantSlug, setRestaurantSlug] = useState('...');

  // Modal Crear Mesero
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetPin, setResetPin] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResettingPin, setIsResettingPin] = useState(false);

  const loadStaff = useCallback(async (tenantId: string) => {
    try {
      setIsLoading(true);
      const list = await cloudDbService.getStaff(tenantId);
      setStaffList(list);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar el personal.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial (Sin duplicaciones)
  useEffect(() => {
    const init = async () => {
      const user = await authSession.getUser();
      if (!user || user.role !== 'restaurant_admin') {
        Alert.alert('Acceso Denegado', 'Solo el Administrador puede gestionar el personal.');
        router.replace('/(auth)/pin-login');
        return;
      }
      setSessionUser(user);
      if (user.tenant_slug) setRestaurantSlug(user.tenant_slug);
      loadStaff(user.tenant_id);
    };
    init();
  }, [loadStaff, router]);

  const generateRandomPin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setPinCode(random);
  };

  const openResetPin = (staff: any) => {
    setResetTarget(staff);
    setResetPin('');
    setIsResetModalOpen(true);
  };

  const handleResetPin = async () => {
    if (!sessionUser?.tenant_id || !resetTarget) return;
    if (!/^\d{4}$/.test(resetPin)) {
      Alert.alert('PIN Inválido', 'El PIN debe ser exactamente de 4 dígitos numéricos.');
      return;
    }

    setIsResettingPin(true);
    try {
      await cloudDbService.resetWaiterPin(sessionUser.tenant_id, resetTarget.id, resetPin);
      setIsResetModalOpen(false);
      Alert.alert(
        'PIN Restablecido',
        `Nuevo PIN de ${resetTarget.full_name}: ${resetPin}\nCompártelo con el mesero. No se podrá volver a consultar.`
      );
      setResetPin('');
      setResetTarget(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo restablecer el PIN.');
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleCreateWaiter = async () => {
    if (!sessionUser?.tenant_id) {
      Alert.alert('Sesión no disponible', 'Vuelve a iniciar sesión para administrar los meseros.');
      return;
    }

    if (!fullName.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre del mesero.');
      return;
    }
    if (!/^\d{4}$/.test(pinCode.trim())) {
      Alert.alert('PIN Inválido', 'El PIN debe ser exactamente de 4 dígitos numéricos.');
      return;
    }

    setIsSaving(true);
    try {
      await cloudDbService.createWaiter(sessionUser.tenant_id, fullName, pinCode);
      Alert.alert(
        'Mesero Creado',
        `Mesero: ${fullName.trim()}\nPIN: ${pinCode}\nCódigo de Sala: ${restaurantSlug}\n\nEl mesero usará estos 3 datos para iniciar turno.`
      );
      setFullName('');
      setPinCode('');
      setIsAddModalOpen(false);
      loadStaff(sessionUser.tenant_id);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (staff: any) => {
    const nextStatus = !staff.is_active;
    try {
      await cloudDbService.toggleStaffStatus(staff.id, nextStatus);
      setStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, is_active: nextStatus } : s));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar el estado del mesero.');
    }
  };

  const handleDeleteStaff = (staff: any) => {
    Alert.alert(
      'Eliminar Mesero',
      `¿Deseas eliminar a ${staff.full_name}? Se recomienda solo pausar su turno si es temporal.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cloudDbService.deleteStaff(staff.id);
              loadStaff(sessionUser.tenant_id);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar el mesero.');
            }
          },
        },
      ]
    );
  };

  const activeWaiters = staffList.filter(s => s.role === 'waiter_basic' && s.is_active);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Meseros</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* BANNER DESTACADO: CÓDIGO DEL RESTAURANTE PARA LOS MESEROS */}
      <View style={styles.slugBanner}>
        <View style={styles.slugBannerTop}>
          <Text style={styles.slugBannerLabel}>CÓDIGO DE SALA PARA TUS MESEROS:</Text>
          <View style={styles.slugBadge}>
            <Text style={styles.slugBadgeText}>{restaurantSlug}</Text>
          </View>
        </View>
        <Text style={styles.slugHelpText}>
          Tus meseros deben ingresar este código en su pantalla de inicio junto con su nombre y PIN.
        </Text>
      </View>

      {/* Barra Informativa con Botón Nuevo Mesero */}
      <View style={styles.infoBar}>
        <View>
          <Text style={styles.infoTitle}>Personal en Turno:</Text>
          <Text style={styles.infoSub}>
            <Text style={{ color: '#10b981', fontWeight: 'bold' }}>{activeWaiters.length}</Text> meseros activos en sala
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => {
            generateRandomPin();
            setIsAddModalOpen(true);
          }}
        >
          <Text style={styles.addBtnText}>+ Nuevo Mesero</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Meseros */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={staffList.filter(s => s.role === 'waiter_basic')}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay meseros registrados. Registra al primero con el botón superior.</Text>
          }
          renderItem={({ item }) => {
            return (
              <View style={[styles.card, !item.is_active && styles.cardInactive]}>
                <View style={styles.cardInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.nameText, !item.is_active && { color: '#64748b' }]}>{item.full_name}</Text>
                    <View style={[styles.statusBadge, item.is_active ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.statusBadgeText, item.is_active ? styles.badgeActiveText : styles.badgeInactiveText]}>
                        {item.is_active ? 'Activo' : 'Pausado'}
                      </Text>
                    </View>
                  </View>

                </View>

                {/* Acciones */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.resetPinBtn} onPress={() => openResetPin(item)}>
                    <Text style={styles.resetPinBtnText}>PIN</Text>
                  </TouchableOpacity>
                  <Switch
                    value={item.is_active}
                    onValueChange={() => void handleToggleActive(item)}
                    trackColor={{ false: '#334155', true: '#065f46' }}
                    thumbColor={item.is_active ? '#10b981' : '#94a3b8'}
                    accessibilityLabel={`${item.is_active ? 'Pausar' : 'Activar'} a ${item.full_name}`}
                  />

                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStaff(item)}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* MODAL CREAR MESERO */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Crear Nuevo Mesero</Text>
            <Text style={styles.modalSub}>
              Asigna el nombre y PIN. El mesero requerirá ambos datos para ingresar al sistema.
            </Text>

            <Text style={styles.inputLabel}>Nombre del Mesero *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Camilo Torres"
              placeholderTextColor="#64748b"
              value={fullName}
              onChangeText={setFullName}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.inputLabel}>PIN de 4 dígitos *</Text>
              <TouchableOpacity onPress={generateRandomPin}>
                <Text style={styles.randomPinLink}>🎲 Generar automático</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.pinInput]}
              keyboardType="numeric"
              maxLength={4}
              value={pinCode}
              onChangeText={setPinCode}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setIsAddModalOpen(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={() => void handleCreateWaiter()} disabled={isSaving}>
                <Text style={styles.btnConfirmText}>{isSaving ? 'Guardando...' : 'Crear Mesero'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isResetModalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Restablecer PIN</Text>
            <Text style={styles.modalSub}>
              Asigna un PIN nuevo para {resetTarget?.full_name}. El PIN anterior no se puede recuperar.
            </Text>
            <Text style={styles.inputLabel}>Nuevo PIN de 4 dígitos *</Text>
            <TextInput
              style={[styles.input, styles.pinInput]}
              keyboardType="numeric"
              maxLength={4}
              value={resetPin}
              onChangeText={setResetPin}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => {
                  setIsResetModalOpen(false);
                  setResetPin('');
                  setResetTarget(null);
                }}
                disabled={isResettingPin}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={() => void handleResetPin()}
                disabled={isResettingPin}
              >
                <Text style={styles.btnConfirmText}>{isResettingPin ? 'Guardando...' : 'Restablecer PIN'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#1e293b', borderRadius: 8 },
  backButtonText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  slugBanner: {
    backgroundColor: '#0f172a',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  slugBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  slugBannerLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  slugBadge: { backgroundColor: '#1e1b4b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#4f46e5' },
  slugBadgeText: { color: '#38bdf8', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  slugHelpText: { color: '#64748b', fontSize: 11, lineHeight: 15 },

  infoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#090d16', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  infoTitle: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  infoSub: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  addBtn: { backgroundColor: '#4f46e5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  addBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 10 },
  emptyText: { color: '#64748b', textAlign: 'center', marginVertical: 40, fontSize: 13 },
  card: { backgroundColor: '#0f172a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInactive: { opacity: 0.55 },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeActive: { backgroundColor: '#064e3b' },
  badgeInactive: { backgroundColor: '#334155' },
  statusBadgeText: { fontSize: 9, fontWeight: 'bold' },
  badgeActiveText: { color: '#34d399' },
  badgeInactiveText: { color: '#94a3b8' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetPinBtn: { paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#1e1b4b', borderRadius: 6 },
  resetPinBtnText: { color: '#a5b4fc', fontSize: 11, fontWeight: 'bold' },
  deleteBtn: { padding: 6 },

  modalBg: { flex: 1, backgroundColor: '#00000095', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  modalSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  inputLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  randomPinLink: { color: '#818cf8', fontSize: 11, fontWeight: 'bold' },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#ffffff', fontSize: 14, marginBottom: 12 },
  pinInput: { fontSize: 22, fontWeight: 'bold', letterSpacing: 8, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 10 },
  btnCancelText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  btnConfirm: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#4f46e5', borderRadius: 10 },
  btnConfirmText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});