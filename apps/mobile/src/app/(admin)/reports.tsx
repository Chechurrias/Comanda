import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { localDbService } from '../../core/database';

type TabOption = 'general' | 'productos' | 'facturas';

export default function ReportsScreen() {
  const router = useRouter();

  // Fecha seleccionada (por defecto hoy en formato YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toLocaleDateString('en-CA');
  });

  // Pestaña activa: 'general' | 'productos' | 'facturas'
  const [activeTab, setActiveTab] = useState<TabOption>('general');

  // Datos
  const [summary, setSummary] = useState<any>({ total_sales: 0, orders_count: 0, average_ticket: 0 });
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Factura expandida para ver su detalle
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const loadReportData = useCallback((dateStr: string) => {
    setSummary(localDbService.getDailySalesSummary(dateStr));
    setPaymentMethods(localDbService.getSalesByPaymentMethod(dateStr));
    setProducts(localDbService.getTopSellingItems(dateStr, 100));
    setInvoices(localDbService.getPaidOrdersHistory(dateStr));
  }, []);

  // Carga inicial y al cambiar fecha
  useState(() => {
    loadReportData(selectedDate);
  });

  // Navegación de fechas (Día anterior / Día siguiente)
  const changeDate = (days: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + days);
    const newDateStr = current.toLocaleDateString('en-CA');
    setSelectedDate(newDateStr);
    loadReportData(newDateStr);
  };

  const isToday = selectedDate === new Date().toLocaleDateString('en-CA');

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado con botón Volver */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informes de Ventas</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Selector de Fecha */}
      <View style={styles.dateSelector}>
        <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrowText}>◀ Anterior</Text>
        </TouchableOpacity>

        <View style={styles.dateDisplay}>
          <Text style={styles.dateText}>{selectedDate}</Text>
          {isToday && <Text style={styles.todayBadge}>HOY</Text>}
        </View>

        <TouchableOpacity 
          style={[styles.dateArrowBtn, isToday && styles.dateArrowBtnDisabled]} 
          onPress={() => !isToday && changeDate(1)}
          disabled={isToday}
        >
          <Text style={[styles.dateArrowText, isToday && { color: '#475569' }]}>Siguiente ▶</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de Pestañas (General | Productos | Facturas) */}
      <View style={styles.tabsBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'general' && styles.tabItemActive]}
          onPress={() => setActiveTab('general')}
        >
          <Text style={[styles.tabText, activeTab === 'general' && styles.tabTextActive]}>
            General
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'productos' && styles.tabItemActive]}
          onPress={() => setActiveTab('productos')}
        >
          <Text style={[styles.tabText, activeTab === 'productos' && styles.tabTextActive]}>
            Productos ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'facturas' && styles.tabItemActive]}
          onPress={() => setActiveTab('facturas')}
        >
          <Text style={[styles.tabText, activeTab === 'facturas' && styles.tabTextActive]}>
            Facturas ({invoices.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* VISTA 1: GENERAL                                         */}
      {/* ======================================================== */}
      {activeTab === 'general' && (
        <ScrollView contentContainerStyle={styles.tabContent}>
          {/* Card Total Vendido */}
          <View style={styles.mainKpiCard}>
            <Text style={styles.kpiLabel}>TOTAL RECAUDADO</Text>
            <Text style={styles.kpiValue}>${summary.total_sales.toLocaleString()} COP</Text>
            
            <View style={styles.kpiRow}>
              <View style={styles.subKpi}>
                <Text style={styles.subKpiLabel}>Facturas Pagadas</Text>
                <Text style={styles.subKpiValue}>{summary.orders_count}</Text>
              </View>
              
            </View>
          </View>

          {/* Desglose por método de pago */}
          <Text style={styles.sectionTitle}>Ingresos por Forma de Pago</Text>
          {paymentMethods.length === 0 ? (
            <Text style={styles.emptyNotice}>No hubo pagos registrados en esta fecha.</Text>
          ) : (
            paymentMethods.map(pm => (
              <View key={pm.payment_method} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>{pm.payment_method}</Text>
                  <Text style={styles.itemSubtitle}>{pm.total_orders} transacciones</Text>
                </View>
                <Text style={styles.itemPrice}>${pm.total_amount.toLocaleString()} COP</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: PRODUCTOS                                       */}
      {/* ======================================================== */}
      {activeTab === 'productos' && (
        <View style={{ flex: 1 }}>
          {products.length === 0 ? (
            <Text style={styles.emptyNotice}>No hay productos vendidos en esta fecha.</Text>
          ) : (
            <FlatList
              data={products}
              keyExtractor={item => item.name}
              contentContainerStyle={styles.tabContent}
              renderItem={({ item, index }) => (
                <View style={styles.itemCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Text style={styles.rankNumber}>#{index + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemSubtitle}>{item.total_qty} unidades vendidas</Text>
                    </View>
                  </View>
                  <Text style={styles.itemPrice}>${item.total_revenue.toLocaleString()} COP</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* VISTA 3: FACTURAS / CUENTAS                              */}
      {/* ======================================================== */}
      {activeTab === 'facturas' && (
        <View style={{ flex: 1 }}>
          {invoices.length === 0 ? (
            <Text style={styles.emptyNotice}>No hay facturas cerradas en esta fecha.</Text>
          ) : (
            <FlatList
              data={invoices}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.tabContent}
              renderItem={({ item }) => {
                const isExpanded = expandedInvoiceId === item.id;
                const timeString = item.closed_at
                  ? new Date(item.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--';

                return (
                  <TouchableOpacity
                    style={styles.invoiceCard}
                    activeOpacity={0.8}
                    onPress={() => setExpandedInvoiceId(isExpanded ? null : item.id)}
                  >
                    <View style={styles.invoiceHeader}>
                      <View>
                        <Text style={styles.itemTitle}>{item.table_name}</Text>
                        <Text style={styles.itemSubtitle}>
                          {timeString} • {item.payment_method} {item.waiter_name ? `• Por: ${item.waiter_name}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.invoiceTotal}>${item.total.toLocaleString()} COP</Text>
                        <Text style={styles.expandText}>{isExpanded ? 'Ocultar ▲' : 'Ver detalle ▼'}</Text>
                      </View>
                    </View>

                    {/* Detalle de platos desplegable */}
                    {isExpanded && (
                      <View style={styles.invoiceItemsDetail}>
                        <Text style={styles.detailHeading}>Platos consumidos:</Text>
                        {item.items?.map((it: any, idx: number) => (
                          <View key={idx} style={styles.detailRow}>
                            <Text style={styles.detailText}>{it.quantity}x {it.name}</Text>
                            <Text style={styles.detailText}>${(it.price * it.quantity).toLocaleString()} COP</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  backButton: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#1e293b', borderRadius: 8 },
  backButtonText: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold' },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  // Selector de fecha
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  dateArrowBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#1e293b', borderRadius: 8 },
  dateArrowBtnDisabled: { backgroundColor: '#0f172a', opacity: 0.5 },
  dateArrowText: { color: '#818cf8', fontSize: 12, fontWeight: 'bold' },
  dateDisplay: { alignItems: 'center' },
  dateText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  todayBadge: { color: '#10b981', fontSize: 9, fontWeight: 'bold', marginTop: 2 },

  // Barra de tabs
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#4f46e5' },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#ffffff', fontWeight: 'bold' },

  // Contenido de tabs
  tabContent: { padding: 16, paddingBottom: 40, gap: 10 },
  sectionTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: 'bold', marginTop: 14, marginBottom: 4 },
  emptyNotice: { color: '#64748b', textAlign: 'center', marginVertical: 40, fontSize: 13 },

  // KPI Card
  mainKpiCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#312e81',
    alignItems: 'center',
  },
  kpiLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  kpiValue: { color: '#10b981', fontSize: 28, fontWeight: '900', marginVertical: 6 },
  kpiRow: { flexDirection: 'row', gap: 12, marginTop: 10, width: '100%' },
  subKpi: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  subKpiLabel: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  subKpiValue: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginTop: 2 },

  // Item Cards (Productos y Métodos)
  itemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  itemSubtitle: { color: '#64748b', fontSize: 11, marginTop: 2 },
  itemPrice: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },
  rankNumber: { color: '#818cf8', fontSize: 14, fontWeight: '900', width: 24 },

  // Facturas
  invoiceCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceTotal: { color: '#10b981', fontSize: 14, fontWeight: 'bold' },
  expandText: { color: '#6366f1', fontSize: 10, marginTop: 3 },
  invoiceItemsDetail: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  detailHeading: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginBottom: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  detailText: { color: '#cbd5e1', fontSize: 12 },
});