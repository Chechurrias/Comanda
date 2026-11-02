import * as Network from 'expo-network';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../core/api/supabase';
import { authSession } from '../../core/auth-session';
import { localDbService } from '../../core/database';
import { deviceStorage } from '../../core/storage';

export default function AdminDashboardScreen() {
  const router = useRouter();
  // ✅ AHORA (genérico o vacío mientras carga):
const [restaurantName, setRestaurantName] = useState('Mi Restaurante');
  const [localIp, setLocalIp] = useState('192.168.1.X:8080');

  const [tablesCount, setTablesCount] = useState(0);
  const [menuCount, setMenuCount] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  const loadStats = useCallback(async () => {
    // 1. Obtener IP local del WiFi
    if (Platform.OS !== 'web') {
      try {
        const ip = await Network.getIpAddressAsync();
        if (ip) setLocalIp(`${ip}:8080`);
      } catch (e) {
        console.warn('No se pudo obtener IP local:', e);
      }
    }

       // 2. Obtener Nombre del Restaurante configurado (Prioridad Offline Local)
try {
  // Primero lee el nombre que este restaurante específico guardó en el dispositivo
  const storedName = await deviceStorage.get('restaurant_name');
  if (storedName) {
    setRestaurantName(storedName);
  } else {
    // Si no está en local, lo busca en Supabase con el ID de su tenant/licencia
    const tenantId = await deviceStorage.get('tenant_id');
    if (tenantId) {
      const deviceId = await deviceStorage.get('device_token');
      const { data } = await supabase.rpc('get_mobile_device_status', {
        p_tenant_id: tenantId,
        p_device_id: deviceId,
      });
      const tenant = Array.isArray(data) ? data[0] : data;
      if (tenant?.restaurant_name) {
        setRestaurantName(tenant.restaurant_name);
        await deviceStorage.set('restaurant_name', tenant.restaurant_name);
      }
    }
  }
} catch (e) {
  console.warn('Error leyendo nombre del restaurante:', e);
}

    // 3. Contadores locales de la base de datos
    setTablesCount(localDbService.getTables().length);
    setMenuCount(localDbService.getMenu().length);

    // ✅ Corregido: Detecta tanto 'waiter', 'waiter_basic' como 'waiter_advanced'
    const waiters = localDbService
      .getStaff()
      .filter((s: any) => s.role && s.role.startsWith('waiter'));
    setStaffCount(waiters.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <Text style={styles.storeTitle}>{restaurantName}</Text>
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.statusText}>Caja Local • {localIp}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.exitButton}
          onPress={async () => {
            await authSession.clear();
            router.replace('/(auth)/pin-login');
          }}
        >
          <Text style={styles.exitText}>Salir a PIN</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeading}>PANEL DE CONTROL</Text>

        {/* 🌟 LABEL 1: MAPA DE MESAS */}
        <TouchableOpacity 
          style={styles.heroCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/tables')}
        >
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>MÓDULO PRINCIPAL</Text>
          </View>
          <View style={styles.heroIconBox}>
            <Text style={styles.heroIcon}>🍽️</Text>
          </View>
          <Text style={styles.heroTitle}>Mapa de Mesas y Comandas</Text>
          <Text style={styles.heroSubtitle}>
            Plano de sala en tiempo real. Gestiona comandas activas, pedidos, cobro y liberación de mesas.
          </Text>

          <View style={styles.heroFooter}>
            <Text style={styles.heroStat}>{tablesCount} Mesas en Sala</Text>
            <Text style={styles.heroArrow}>Abrir Plano ➔</Text>
          </View>
        </TouchableOpacity>

        {/* GRUPO DE MÓDULOS */}
        <View style={styles.grid}>

          {/* 📊 LABEL 2: INFORMES Y VENTAS */}
          <TouchableOpacity 
            style={[styles.menuCard, styles.reportsHighlightCard]}
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/reports')}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>📊</Text>
            </View>
            <Text style={styles.cardTitle}>Informes y Ventas</Text>
            <Text style={styles.cardSubtitle}>
              Consulta ventas por fecha a nivel general, productos más vendidos y detalle de facturas cobradas.
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardCounterGreen}>Reporte Diario & Facturación</Text>
              <Text style={styles.cardLink}>Ver Informes ➔</Text>
            </View>
          </TouchableOpacity>

          {/* 📋 LABEL 3: PLATOS Y MENÚ */}
          <TouchableOpacity 
            style={styles.menuCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/menu')}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>📋</Text>
            </View>
            <Text style={styles.cardTitle}>Platos y Menú</Text>
            <Text style={styles.cardSubtitle}>
              Creación de platos, precios y control de disponibilidad (Disponible / Agotado).
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardCounter}>{menuCount} Platos registrados</Text>
              <Text style={styles.cardLink}>Gestionar ➔</Text>
            </View>
          </TouchableOpacity>

          {/* 👥 LABEL 4: MESEROS */}
          <TouchableOpacity 
            style={styles.menuCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/staff')}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>👥</Text>
            </View>
            <Text style={styles.cardTitle}>Conexión e Ingreso de Meseros</Text>
            <Text style={styles.cardSubtitle}>
              Alta de meseros, asignación de PIN de 4 dígitos y control de cupos.
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardCounter}>{staffCount} Meseros autorizados</Text>
              <Text style={styles.cardLink}>Administrar ➔</Text>
            </View>
          </TouchableOpacity>

          {/* 🔒 LABEL 5: TERMINALES */}
          <TouchableOpacity 
            style={styles.menuCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(admin)/terminals')}
          >
            <View style={styles.cardIconBox}>
              <Text style={styles.cardIcon}>🔒</Text>
            </View>
            <Text style={styles.cardTitle}>Terminales y PIN Maestro</Text>
            <Text style={styles.cardSubtitle}>
              Dirección IP del servidor WiFi y cambio de PIN de gerencia.
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardCounter}>Seguridad & Red</Text>
              <Text style={styles.cardLink}>Configurar ➔</Text>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    backgroundColor: '#0f172a', 
    borderBottomWidth: 1, 
    borderBottomColor: '#1e293b' 
  },
  storeTitle: { color: '#ffffff', fontSize: 19, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  statusText: { color: '#10b981', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
  exitButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1e293b', borderRadius: 8 },
  exitText: { color: '#a5b4fc', fontSize: 12, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 40 },
  sectionHeading: { color: '#64748b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 14 },

  heroCard: { 
    backgroundColor: '#1e1b4b', 
    borderRadius: 20, 
    padding: 22, 
    borderWidth: 1.5, 
    borderColor: '#4f46e5', 
    marginBottom: 16,
    elevation: 4
  },
  heroBadge: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#312e81', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6, 
    marginBottom: 12 
  },
  heroBadgeText: { color: '#a5b4fc', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  heroIconBox: { marginBottom: 8 },
  heroIcon: { fontSize: 32 },
  heroTitle: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  heroSubtitle: { color: '#cbd5e1', fontSize: 13, marginTop: 6, lineHeight: 18 },
  heroFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 18, 
    paddingTop: 14, 
    borderTopWidth: 1, 
    borderTopColor: '#3730a3' 
  },
  heroStat: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold' },
  heroArrow: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  grid: { gap: 14 },
  menuCard: { 
    backgroundColor: '#0f172a', 
    borderRadius: 16, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: '#1e293b' 
  },
  reportsHighlightCard: {
    borderColor: '#059669',
    backgroundColor: '#064e3b15',
  },
  cardIconBox: { marginBottom: 8 },
  cardIcon: { fontSize: 24 },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  cardSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4, lineHeight: 16 },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 14, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#1e293b' 
  },
  cardCounter: { color: '#818cf8', fontSize: 12, fontWeight: '600' },
  cardCounterGreen: { color: '#34d399', fontSize: 12, fontWeight: '700' },
  cardLink: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },
});
