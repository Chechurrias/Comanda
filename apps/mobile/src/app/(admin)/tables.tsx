import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../core/api/supabase';
import { authSession } from '../../core/auth-session';
import { cloudDbService } from '../../core/cloud-db';

const ZONES = ['Todas', 'Salón Principal', 'Terraza', 'Bar / Barra', 'Zona VIP'];
const PAYMENT_METHODS = ['Efectivo', 'Tarjeta Débito/Crédito', 'Nequi / Transferencia'];

export default function AdminTablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState('Todas');
  const [activeMenu, setActiveMenu] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sesión Admin
  const [sessionUser, setSessionUser] = useState<any | null>(null);

  // Mesa seleccionada y comanda activa
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  // Modales
  const [modalMode, setModalMode] = useState<'order' | 'checkout' | null>(null);
  const [cart, setCart] = useState<{ [id: string]: { name: string; price: number; quantity: number } }>({});
  const [selectedPayment, setSelectedPayment] = useState('Efectivo');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = useCallback(async (tenantId: string) => {
    try {
      setIsLoading(true);
      const [tablesData, menuData] = await Promise.all([
        cloudDbService.getTables(tenantId),
        cloudDbService.getAvailableMenu(tenantId),
      ]);
      setTables(tablesData);
      setActiveMenu(menuData);
    } catch (err: any) {
      Alert.alert('Error cargando sala', err.message || 'Verifica tu conexión a internet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: any = null;

    const setup = async () => {
      const user = await authSession.getUser();
      if (!user || !user.tenant_id) {
        router.replace('/(auth)/pin-login');
        return;
      }
      setSessionUser(user);
      await loadData(user.tenant_id);

      // Suscripción Realtime por WebSockets
      channel = supabase
        .channel(`realtime-admin-tables-${user.tenant_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'restaurant_tables',
            filter: `tenant_id=eq.${user.tenant_id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setTables((prev) => [...prev, payload.new]);
            } else if (payload.eventType === 'UPDATE') {
              setTables((prev) =>
                prev.map((t) => (t.id === payload.new.id ? payload.new : t))
              );
              setSelectedTable((prev: any) =>
                prev && prev.id === payload.new.id ? payload.new : prev
              );
            } else if (payload.eventType === 'DELETE') {
              setTables((prev) => prev.filter((t) => t.id === payload.old.id));
            }
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadData, router]);

  // Consecutivo automático de mesas
  const getNextTableNumber = () => {
    if (!tables || tables.length === 0) return 1;
    const numbers = tables
      .map((t) => {
        const match = String(t.identifier || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  };

  const nextTableNumber = getNextTableNumber();

  // Crear mesa en la nube
  const handleCreateTable = async () => {
    if (!sessionUser?.tenant_id) return;
    try {
      const assignedZone = selectedZone === 'Todas' ? 'Salón Principal' : selectedZone;
      await cloudDbService.addTable(sessionUser.tenant_id, `Mesa ${nextTableNumber}`, assignedZone);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo crear la mesa.');
    }
  };

  // Eliminar mesa de la nube
  const handleDeleteTable = (table: any) => {
    if (table.status !== 'available') {
      Alert.alert('Mesa en uso', 'Solo puedes eliminar mesas que estén en estado Libre.');
      return;
    }

    Alert.alert(
      'Eliminar Mesa',
      `¿Deseas eliminar ${table.identifier} de la sala?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cloudDbService.deleteTable(table.id);
            } catch (err: any) {
              Alert.alert('Error', 'No se pudo eliminar la mesa.');
            }
          },
        },
      ]
    );
  };

  // Tocar una mesa
  const handleSelectTable = async (table: any) => {
    setSelectedTable(table);
    setCart({});

    try {
      if (!sessionUser?.tenant_id) return;
      const order = await cloudDbService.getActiveOrder(sessionUser.tenant_id, table.id);
      setActiveOrder(order);

      if (table.status === 'available') {
        setModalMode('order');
      } else {
        setModalMode('checkout');
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo consultar el pedido.');
    }
  };

  // Canasta
  const addToCart = (product: any) => {
    setCart((prev) => {
      const current = prev[product.id]?.quantity || 0;
      return {
        ...prev,
        [product.id]: {
          name: product.name,
          price: Number(product.price),
          quantity: current + 1,
        },
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const current = prev[productId]?.quantity || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity: current - 1,
        },
      };
    });
  };

  // Cargar comanda
  const handleSendOrder = async () => {
    if (!selectedTable?.id || !sessionUser) return;
    const cartEntries = Object.values(cart);
    if (cartEntries.length === 0) return;

    setIsProcessing(true);
    try {
      const itemsList = cartEntries.map((item) => ({
        id: Object.keys(cart).find((k) => cart[k] === item) || item.name,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      await cloudDbService.sendOrder(
        sessionUser.tenant_id,
        selectedTable.id,
        sessionUser.staff_id,
        sessionUser.full_name,
        activeOrder?.id || null,
        itemsList
      );

      setModalMode(null);
      setCart({});
      Alert.alert('Comanda cargada', `Pedido registrado en ${selectedTable.identifier}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar la comanda.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Pedir cuenta
  const handleRequestBill = async () => {
    if (!selectedTable?.id) return;
    try {
      await cloudDbService.requestTableBill(selectedTable.id);
      setModalMode(null);
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo pedir la cuenta.');
    }
  };

  // Cobrar y Liberar Mesa (Actualiza en la nube y la mesa vuelve a verde en todos los celulares)
  const handlePayAndRelease = async () => {
    if (!activeOrder?.id || !selectedTable?.id) return;

    setIsProcessing(true);
    try {
      await cloudDbService.payAndReleaseTable(activeOrder.id, selectedTable.id, selectedPayment);
      Alert.alert(
        'Pago Confirmado',
        `Cuenta de $${Number(activeOrder.total).toLocaleString()} COP cobrada con ${selectedPayment}.\n\n¡${selectedTable.identifier} liberada!`
      );
      setModalMode(null);
    } catch (err: any) {
      Alert.alert('Error al cobrar', err.message || 'No se pudo procesar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Ordenamiento numérico natural
  const filteredTables = selectedZone === 'Todas' ? tables : tables.filter((t) => t.zone === selectedZone);
  const sortedTables = [...filteredTables].sort((a, b) => {
    const numA = parseInt(String(a.identifier || '').match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(String(b.identifier || '').match(/\d+/)?.[0] || '0', 10);
    if (numA !== numB) return numA - numB;
    return String(a.identifier).localeCompare(String(b.identifier), undefined, { numeric: true });
  });

  const cartItemsArray = Object.values(cart);
  const cartTotal = cartItemsArray.reduce((acc, i) => acc + i.price * i.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Botón superior transparente para crear mesa */}
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.addTableTransparentBtn} activeOpacity={0.6} onPress={handleCreateTable}>
          <Text style={styles.addTableTransparentText}>+ Crear Mesa {nextTableNumber}</Text>
        </TouchableOpacity>
      </View>

      {/* Selector de Zonas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneScroll}>
        {ZONES.map((z) => (
          <TouchableOpacity
            key={z}
            style={[styles.zoneChip, selectedZone === z && styles.zoneChipActive]}
            onPress={() => setSelectedZone(z)}
          >
            <Text style={[styles.zoneText, selectedZone === z && styles.zoneTextActive]}>{z}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid de Mesas */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Sincronizando sala con la nube...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.tablesGrid}>
          {sortedTables.map((tbl) => {
            const isAvail = tbl.status === 'available';
            const isOccup = tbl.status === 'occupied';
            const isBill = tbl.status === 'billing';

            return (
              <TouchableOpacity
                key={tbl.id}
                style={[
                  styles.tableCard,
                  isAvail && styles.borderAvail,
                  isOccup && styles.borderOccup,
                  isBill && styles.borderBill,
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectTable(tbl)}
                onLongPress={() => handleDeleteTable(tbl)}
                delayLongPress={500}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.tableNum}>{tbl.identifier}</Text>
                  <View
                    style={[
                      styles.dot,
                      isAvail && styles.dotAvail,
                      isOccup && styles.dotOccup,
                      isBill && styles.dotBill,
                    ]}
                  />
                </View>

                <Text style={styles.tableZone}>{tbl.zone}</Text>

                <View style={styles.cardBottom}>
                  <Text
                    style={[
                      styles.statusLabel,
                      isAvail && { color: '#10b981' },
                      isOccup && { color: '#818cf8' },
                      isBill && { color: '#f59e0b' },
                    ]}
                  >
                    {isAvail ? 'Libre' : isOccup ? 'Ocupada' : 'Por Cobrar'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Tarjeta Transparente interactiva para crear mesa */}
          <TouchableOpacity style={styles.addCardTransparent} activeOpacity={0.6} onPress={handleCreateTable}>
            <Text style={styles.addCardPlus}>+</Text>
            <Text style={styles.addCardLabel}>Mesa {nextTableNumber}</Text>
            <Text style={styles.addCardSub}>Tocar para crear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* MODAL 1: TOMAR COMANDA */}
      <Modal visible={modalMode === 'order'} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalLargeBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Comanda — {selectedTable?.identifier}</Text>
                <Text style={styles.modalSub}>Atendido por: {sessionUser?.full_name}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalMode(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeMenu}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => {
                const qty = cart[item.id]?.quantity || 0;
                return (
                  <View style={styles.dishRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dishName}>{item.name}</Text>
                      <Text style={styles.dishPrice}>${Number(item.price).toLocaleString()} COP</Text>
                    </View>

                    <View style={styles.qtyControls}>
                      {qty > 0 && (
                        <TouchableOpacity style={styles.qtyMinus} onPress={() => removeFromCart(item.id)}>
                          <Text style={styles.qtySymbol}>-</Text>
                        </TouchableOpacity>
                      )}
                      {qty > 0 && <Text style={styles.qtyNumber}>{qty}</Text>}
                      <TouchableOpacity style={styles.qtyPlus} onPress={() => addToCart(item)}>
                        <Text style={styles.qtySymbol}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.orderSummaryBar}>
              <View>
                <Text style={styles.summaryItemsText}>{cartItemsArray.reduce((acc, i) => acc + i.quantity, 0)} platos</Text>
                <Text style={styles.summaryTotalText}>Total: ${cartTotal.toLocaleString()} COP</Text>
              </View>

              <TouchableOpacity
                style={[styles.sendOrderBtn, (cartTotal === 0 || isProcessing) && styles.sendOrderBtnDisabled]}
                disabled={cartTotal === 0 || isProcessing}
                onPress={handleSendOrder}
              >
                <Text style={styles.sendOrderBtnText}>{isProcessing ? 'Guardando...' : 'Cargar Comanda'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: CUENTA, COBRO Y LIBERACIÓN */}
      <Modal visible={modalMode === 'checkout'} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalLargeBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cuenta — {selectedTable?.identifier}</Text>
                <Text style={styles.modalSub}>
                  Estado: {selectedTable?.status === 'billing' ? 'Cuenta Solicitada' : 'En Consumo'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalMode(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Ítems consumidos:</Text>
            <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
              {activeOrder?.items?.map((it: any) => (
                <View key={it.id} style={styles.billItemRow}>
                  <Text style={styles.billItemName}>{it.quantity}x {it.name}</Text>
                  <Text style={styles.billItemPrice}>${(Number(it.unit_price) * it.quantity).toLocaleString()} COP</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
              <Text style={styles.totalValue}>${Number(activeOrder?.total || 0).toLocaleString()} COP</Text>
            </View>

            <Text style={styles.sectionTitle}>Método de Pago:</Text>
            <View style={styles.paymentsRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.paymentChip, selectedPayment === m && styles.paymentChipActive]}
                  onPress={() => setSelectedPayment(m)}
                >
                  <Text style={[styles.paymentText, selectedPayment === m && styles.paymentTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.checkoutButtons}>
              <TouchableOpacity style={styles.addMoreBtn} onPress={() => setModalMode('order')}>
                <Text style={styles.addMoreText}>+ Añadir Platos</Text>
              </TouchableOpacity>

              {selectedTable?.status !== 'billing' && (
                <TouchableOpacity style={styles.billBtn} onPress={handleRequestBill}>
                  <Text style={styles.billText}>🧾 Pedir Cuenta</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.payReleaseBtn, isProcessing && { opacity: 0.6 }]}
                disabled={isProcessing}
                onPress={handlePayAndRelease}
              >
                <Text style={styles.payReleaseText}>{isProcessing ? 'Procesando...' : '💵 Cobrar y Liberar Mesa'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 16 },
  topActions: { marginBottom: 10 },
  addTableTransparentBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#6366f199',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTableTransparentText: { color: '#818cf8', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  zoneScroll: { flexDirection: 'row', maxHeight: 40, marginBottom: 12 },
  zoneChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: '#0f172a', marginRight: 8, borderWidth: 1, borderColor: '#1e293b' },
  zoneChipActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  zoneText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  zoneTextActive: { color: '#ffffff' },

  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', fontSize: 12, marginTop: 12 },

  tablesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  tableCard: { width: '31%', backgroundColor: '#0f172a', borderRadius: 14, padding: 12, borderWidth: 1.5, minHeight: 100, justifyContent: 'space-between' },
  borderAvail: { borderColor: '#10b98140' },
  borderOccup: { borderColor: '#6366f180', backgroundColor: '#1e1b4b30' },
  borderBill: { borderColor: '#f59e0b80', backgroundColor: '#451a0330' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableNum: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  tableZone: { color: '#64748b', fontSize: 10, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotAvail: { backgroundColor: '#10b981' },
  dotOccup: { backgroundColor: '#6366f1' },
  dotBill: { backgroundColor: '#f59e0b' },
  cardBottom: { marginTop: 6 },
  statusLabel: { fontSize: 10, fontWeight: 'bold' },

  addCardTransparent: {
    width: '31%',
    minHeight: 100,
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#6366f160',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  addCardPlus: { color: '#818cf8', fontSize: 24, fontWeight: 'bold', lineHeight: 26 },
  addCardLabel: { color: '#c7d2fe', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  addCardSub: { color: '#64748b', fontSize: 9, marginTop: 2 },

  modalBg: { flex: 1, backgroundColor: '#00000095', justifyContent: 'center', padding: 18 },
  modalLargeBox: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 10 },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  modalSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },

  dishRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b50' },
  dishName: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  dishPrice: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyMinus: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  qtyPlus: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  qtySymbol: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  qtyNumber: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', minWidth: 16, textAlign: 'center' },
  orderSummaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e293b' },
  summaryItemsText: { color: '#94a3b8', fontSize: 11 },
  summaryTotalText: { color: '#38bdf8', fontSize: 15, fontWeight: 'bold' },
  sendOrderBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  sendOrderBtnDisabled: { backgroundColor: '#334155' },
  sendOrderBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  sectionTitle: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginTop: 10, marginBottom: 6 },
  billItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billItemName: { color: '#ffffff', fontSize: 12 },
  billItemPrice: { color: '#94a3b8', fontSize: 12 },
  totalBox: { backgroundColor: '#020617', padding: 14, borderRadius: 12, alignItems: 'center', marginVertical: 10, borderWidth: 1, borderColor: '#312e81' },
  totalLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  totalValue: { color: '#38bdf8', fontSize: 24, fontWeight: '900', marginTop: 2 },
  paymentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  paymentChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155' },
  paymentChipActive: { backgroundColor: '#4f46e5', borderColor: '#6366f1' },
  paymentText: { color: '#94a3b8', fontSize: 11 },
  paymentTextActive: { color: '#ffffff', fontWeight: 'bold' },
  checkoutButtons: { gap: 8 },
  addMoreBtn: { paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center' },
  addMoreText: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },
  billBtn: { paddingVertical: 10, borderRadius: 10, backgroundColor: '#d97706', alignItems: 'center' },
  billText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  payReleaseBtn: { paddingVertical: 14, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center' },
  payReleaseText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
});