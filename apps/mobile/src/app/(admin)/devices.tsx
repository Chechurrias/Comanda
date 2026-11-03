import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deviceStorage } from '../../core/storage';
import { supabase } from '../../core/api/supabase';

type LicenseSummary = {
  plan_name?: string;
  plan_code?: string;
  max_devices: number;
  expires_at: string;
  devices_count: number;
};

export default function DevicesScreen() {
  const [summary, setSummary] = useState<LicenseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      try {
        const [tenantId, deviceId] = await Promise.all([
          deviceStorage.get('tenant_id'),
          deviceStorage.get('device_token'),
        ]);
        if (!tenantId || !deviceId || tenantId === 'local') {
          throw new Error('Este dispositivo no tiene una activación cloud válida.');
        }

        const { data, error } = await supabase.rpc('get_mobile_license_summary', {
          p_tenant_id: tenantId,
          p_device_id: deviceId,
        });
        if (error) throw error;

        const license = Array.isArray(data) ? data[0] : data;
        if (!license) throw new Error('No se encontró una licencia activa para este dispositivo.');
        if (active) setSummary(license as LicenseSummary);
      } catch (error: any) {
        if (active) Alert.alert('No se pudo cargar la licencia', error.message || 'Intenta de nuevo.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadSummary();
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>LICENCIA CLOUD</Text>
        {isLoading ? (
          <ActivityIndicator color="#818cf8" style={styles.loading} />
        ) : summary ? (
          <>
            <Text style={styles.planName}>{summary.plan_name || summary.plan_code || 'Plan'}</Text>
            <Text style={styles.planSub}>Vencimiento: {summary.expires_at?.split('T')[0] || '—'}</Text>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{summary.devices_count} / {summary.max_devices}</Text>
              <Text style={styles.metricLbl}>Dispositivos cloud autorizados</Text>
            </View>
          </>
        ) : (
          <Text style={styles.planSub}>No hay información de licencia disponible.</Text>
        )}
      </View>
      <Text style={styles.note}>
        Las comandas, mesas, pagos y reportes se procesan en Supabase. Esta pantalla solo consulta la licencia y los dispositivos autorizados.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, gap: 14, backgroundColor: '#020617' },
  card: { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1e293b' },
  cardTitle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  planName: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  planSub: { color: '#94a3b8', fontSize: 12, marginTop: 5 },
  loading: { marginVertical: 18 },
  metricBox: { backgroundColor: '#020617', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginTop: 16 },
  metricVal: { color: '#818cf8', fontSize: 18, fontWeight: 'bold' },
  metricLbl: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
  note: { color: '#64748b', fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
});
