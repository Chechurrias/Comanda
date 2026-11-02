'use client';

import { supabase } from '@/lib/supabase';
import {
  Ban,
  Building2,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Users,
  X,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TenantDetail {
  id: string;
  name: string;
  trade_name?: string;
  legal_name?: string;
  tax_id?: string;
  status: string;
  created_at: string;
  license?: {
    id: string;
    is_active: boolean;
    status: string;
    starts_at: string;
    expires_at: string;
    plan_name: string;
    max_devices: number;
    max_waiters: number;
  };
  devices_count: number;
  users_count: number;
}

interface DeviceItem {
  id: string;
  device_name: string;
  hardware_id: string;
  trust_status: string;
  created_at: string;
}

interface UserItem {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

const PLAN_LIMITS: Record<string, { max_devices: number; max_waiters: number; max_tables: number }> = {
  basic: { max_devices: 1, max_waiters: 0, max_tables: 15 },
  pro: { max_devices: 3, max_waiters: 2, max_tables: 35 },
  enterprise: { max_devices: 6, max_waiters: 5, max_tables: 100 },
};

export default function TenantsManagementPage() {
  const [tenants, setTenants] = useState<TenantDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Modal de Gestión
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'license' | 'devices' | 'staff'>('license');
  const [tenantDevices, setTenantDevices] = useState<DeviceItem[]>([]);
  const [tenantUsers, setTenantUsers] = useState<UserItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Formulario de extensión de licencia
  const [extendOption, setExtendOption] = useState('1');

  // 1. Cargar clientes y consolidar datos de Supabase
  const loadTenantsData = async () => {
    setIsLoading(true);
    try {
      const [tenantsRes, licensesRes, plansRes, devicesRes, usersRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('licenses').select('*'),
        supabase.from('plans').select('*'),
        supabase.from('devices').select('id, tenant_id, trust_status'),
        supabase.from('users').select('id, tenant_id, role')
      ]);

      const queryError = tenantsRes.error || licensesRes.error || plansRes.error || devicesRes.error || usersRes.error;
      if (queryError) throw queryError;

      const rawTenants = tenantsRes.data || [];
      const rawLicenses = licensesRes.data || [];
      const rawPlans = plansRes.data || [];
      const rawDevices = devicesRes.data || [];
      const rawUsers = usersRes.data || [];

      const consolidated: TenantDetail[] = rawTenants.map((t) => {
        // Si hay duplicados históricos, priorizar la licencia activa más reciente.
        const tenantLicenses = rawLicenses
          .filter(l => l.tenant_id === t.id)
          .sort((a, b) => new Date(b.created_at || b.starts_at || 0).getTime() - new Date(a.created_at || a.starts_at || 0).getTime());
        const lic = tenantLicenses.find(l => l.is_active) || tenantLicenses[0];
        // En tu DB 'licenses.plan' es un texto (código de plan) que coincide con 'plans.code'
        const plan = lic ? rawPlans.find(p => p.code?.toLowerCase() === lic.plan?.toLowerCase()) : null;
        const devCount = rawDevices.filter(d => d.tenant_id === t.id && d.trust_status === 'trusted').length;
        const usrCount = rawUsers.filter(u => u.tenant_id === t.id).length;

        return {
          id: t.id,
          name: t.name || t.trade_name || 'Sin Nombre',
          trade_name: t.trade_name,
          legal_name: t.legal_name,
          tax_id: t.tax_id || 'Sin NIT',
          status: t.status || 'active',
          created_at: t.created_at,
          license: lic ? {
            id: lic.id,
            is_active: lic.is_active ?? true,
            status: (lic.is_active ?? true) ? 'active' : 'suspended',
            starts_at: lic.starts_at,
            expires_at: lic.expires_at,
            plan_name: plan?.name || (lic.plan ? lic.plan.toUpperCase() : 'Básico'),
            max_devices: lic.max_devices ?? plan?.max_devices ?? 1,
            max_waiters: lic.max_waiters ?? plan?.max_waiters ?? 5,
          } : undefined,
          devices_count: devCount,
          users_count: usrCount,
        };
      });

      setTenants(consolidated);
      setLoadError('');
    } catch (err: any) {
      console.error('Error al cargar clientes:', err.message);
      setLoadError(err.message || 'No se pudieron cargar los restaurantes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenantsData();
  }, []);

  // 2. Abrir Modal de Gestión
  const openManageModal = async (tenant: TenantDetail) => {
    setSelectedTenant(tenant);
    setIsModalOpen(true);
    setActiveTab('license');

    const [devicesRes, usersRes] = await Promise.all([
      supabase
      .from('devices')
      .select('id, device_name, hardware_id, trust_status, created_at')
      .eq('tenant_id', tenant.id),
      supabase
      .from('users')
      .select('id, full_name, role, is_active')
      .eq('tenant_id', tenant.id),
    ]);
    const queryError = devicesRes.error || usersRes.error;
    if (queryError) {
      alert(`No se pudo cargar el detalle del restaurante: ${queryError.message}`);
      return;
    }
    setTenantDevices(devicesRes.data || []);
    setTenantUsers(usersRes.data || []);
  };

  // 4. Suspender / Reactivar Restaurante
  const toggleLicenseStatus = async (tenant: TenantDetail) => {
    const nextStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
    const isLicenseActive = nextStatus === 'active';
    setIsProcessing(true);

    try {
      const updates = [
        supabase.from('tenants').update({ status: nextStatus }).eq('id', tenant.id),
        ...(tenant.license?.id
          ? [supabase.from('licenses').update({ is_active: isLicenseActive }).eq('id', tenant.license.id)]
          : []),
      ];

      const updateResults = await Promise.all(updates);
      const updateError = updateResults.find(result => result.error)?.error;
      if (updateError) throw updateError;
      await loadTenantsData();

      if (selectedTenant) {
        setSelectedTenant({
          ...selectedTenant,
          status: nextStatus,
          license: selectedTenant.license ? { 
            ...selectedTenant.license, 
            is_active: isLicenseActive,
            status: nextStatus 
          } : undefined
        });
      }
      alert(`Restaurante ${nextStatus === 'suspended' ? 'SUSPENDIDO' : 'ACTIVADO'} con éxito.`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Extender Vigencia de Licencia (o Crear si no tenía)
  const handleExtendLicense = async () => {
    if (!selectedTenant) return;
    setIsProcessing(true);

    try {
      const currentExpiry = selectedTenant.license?.expires_at 
        ? new Date(selectedTenant.license.expires_at) 
        : new Date();

      const baseDate = (!isNaN(currentExpiry.getTime()) && currentExpiry > new Date()) 
        ? currentExpiry 
        : new Date();

      const newExpiry = new Date(baseDate);

      switch (extendOption) {
        case 'trial_7':
          newExpiry.setDate(newExpiry.getDate() + 7);
          break;
        case 'trial_15':
          newExpiry.setDate(newExpiry.getDate() + 15);
          break;
        case 'lifetime':
          newExpiry.setFullYear(newExpiry.getFullYear() + 99);
          break;
        default:
          newExpiry.setMonth(newExpiry.getMonth() + Number(extendOption));
          break;
      }

      // Si ya tiene fila de licencia, la actualiza; si no existía, la crea
      if (selectedTenant.license?.id) {
        const { error } = await supabase
          .from('licenses')
          .update({ 
            expires_at: newExpiry.toISOString(),
            is_active: true
          })
          .eq('id', selectedTenant.license.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('licenses')
          .insert({
            tenant_id: selectedTenant.id,
            plan: 'pro',
            max_devices: PLAN_LIMITS.pro.max_devices, // 3
            max_waiters: PLAN_LIMITS.pro.max_waiters, // 2
            max_tables: PLAN_LIMITS.pro.max_tables,   // 35
            is_active: true,
            starts_at: new Date().toISOString(),
            expires_at: newExpiry.toISOString(),
          });
        if (error) throw error;
      }

      // Asegurar que el tenant también esté activo
      const { error: tenantError } = await supabase.from('tenants').update({ status: 'active' }).eq('id', selectedTenant.id);
      if (tenantError) throw tenantError;

      await loadTenantsData();
      setIsModalOpen(false);
      alert(`Vigencia extendida con éxito hasta el ${newExpiry.toLocaleDateString()}.`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Alternar estado del dispositivo (Revocar / Re-autorizar)
  const toggleDeviceTrust = async (deviceId: string, currentStatus: string) => {
    const nextTrust = currentStatus === 'trusted' ? 'revoked' : 'trusted';
    const actionText = nextTrust === 'revoked' ? 'revocar' : 'autorizar';

    if (!confirm(`¿Seguro que deseas ${actionText} este dispositivo?`)) return;

    try {
      const { error } = await supabase
        .from('devices')
        .update({ trust_status: nextTrust })
        .eq('id', deviceId);
      if (error) throw error;

      setTenantDevices(prev => prev.map(d => d.id === deviceId ? { ...d, trust_status: nextTrust } : d));
      await loadTenantsData();
      alert(`Dispositivo ${nextTrust === 'revoked' ? 'revocado (bloqueado)' : 'autorizado'} con éxito.`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // 7. Modificar/Resetear PIN de un usuario
  const handleUpdateUserPin = async (userId: string, userName: string) => {
    const newPin = prompt(`Ingresa el nuevo PIN de 4 dígitos para ${userName}:`);
    if (!newPin) return;

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      alert('El PIN debe tener exactamente 4 números.');
      return;
    }

    try {
      const { error } = await supabase.from('users').update({ pin_code: newPin }).eq('id', userId);
      if (error) throw error;
      alert(`PIN de ${userName} actualizado con éxito.`);
    } catch (err: any) {
      alert('Error actualizando PIN: ' + err.message);
    }
  };

  // Métricas
  const totalCount = tenants.length;
  const activeCount = tenants.filter(t => t.status === 'active').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;
  const totalTerminals = tenants.reduce((acc, t) => acc + t.devices_count, 0);

  // Filtrado
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.tax_id && t.tax_id.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* El alta oficial ocurre desde la consola de activaciones */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Control de Restaurantes Clientes
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Supervisa planes, vigencias, terminales vinculadas y personal de cada cliente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/activations"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Registrar cliente
          </Link>
          <button 
            onClick={loadTenantsData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>

        </div>
      </div>

      {/* 2. Tarjetas de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Restaurantes</span>
            <p className="text-2xl font-bold text-white mt-0.5">{totalCount}</p>
          </div>
          <div className="p-2.5 bg-slate-800/60 rounded-lg text-slate-300 border border-slate-700/40">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">Restaurantes Activos</span>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{activeCount}</p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-400">Terminales Móviles</span>
            <p className="text-2xl font-bold text-indigo-400 mt-0.5">{totalTerminals}</p>
          </div>
          <div className="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-rose-400">Suspendidos</span>
            <p className="text-2xl font-bold text-rose-400 mt-0.5">{suspendedCount}</p>
          </div>
          <div className="p-2.5 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="inline-flex p-1 bg-slate-900/90 border border-slate-800 rounded-lg self-start">
          {[
            { id: 'all', label: 'Todos', count: totalCount },
            { id: 'active', label: 'Activos', count: activeCount },
            { id: 'suspended', label: 'Suspendidos', count: suspendedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === tab.id ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por restaurante o NIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* 4. Tabla de Clientes */}
      <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-[11px] font-medium uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Restaurante</th>
                <th className="px-5 py-3.5">Plan & Capacidad</th>
                <th className="px-5 py-3.5">Terminales en Uso</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Vencimiento</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
      {loadError ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-rose-400">
                    {loadError}
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Aún no hay restaurantes. Activa un dispositivo desde la consola de activaciones para registrar el primero.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isLifetime = t.license?.expires_at && new Date(t.license.expires_at).getFullYear() > 2090;

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/25 transition-colors">
                      {/* Restaurante */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-sm flex items-center justify-center border border-indigo-500/20">
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-xs">{t.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {t.tax_id} • Registrado el {new Date(t.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {t.license?.plan_name || 'Sin Licencia'}
                        </span>
                      </td>

                      {/* Dispositivos */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 text-xs">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-200">
                            {t.devices_count} de {t.license?.max_devices || 1} terminales
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-3.5">
                        {t.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Suspendido
                          </span>
                        )}
                      </td>

                      {/* Vencimiento */}
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-300">
                        {isLifetime ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                            <Sparkles className="w-3 h-3" /> Vitalicia
                          </span>
                        ) : t.license?.expires_at ? (
                          new Date(t.license.expires_at).toLocaleDateString()
                        ) : (
                          <span className="text-slate-500">Sin Licencia</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openManageModal(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition-all active:scale-95"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: GESTIÓN INTEGRAL DEL RESTAURANTE               */}
      {/* ======================================================== */}
      {isModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
                  {selectedTenant.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedTenant.name}</h3>
                  <span className="text-[11px] text-slate-400">{selectedTenant.tax_id}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas del Modal */}
            <div className="flex border-b border-slate-800 px-6 bg-slate-950/20">
              <button
                onClick={() => setActiveTab('license')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'license'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Licencia y Vigencia
              </button>
              <button
                onClick={() => setActiveTab('devices')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'devices'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Terminales ({tenantDevices.length})
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'staff'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Personal y PINs ({tenantUsers.length})
              </button>
            </div>

            <div className="p-6">
              
              {/* TAB 1: LICENCIA */}
              {activeTab === 'license' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-medium">Estado del Servicio</span>
                      {selectedTenant.status === 'active' ? (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Suspendido
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Plan Asignado</span>
                      <span className="text-white font-medium">{selectedTenant.license?.plan_name || 'Sin Licencia Creada'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Vencimiento Actual</span>
                      <span className="text-indigo-400 font-mono font-medium">
                        {selectedTenant.license?.expires_at 
                          ? new Date(selectedTenant.license.expires_at).toLocaleDateString()
                          : 'Sin Vencimiento Asignado'}
                      </span>
                    </div>
                  </div>

                  {/* Extender Vigencia */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {selectedTenant.license ? 'Extender Vigencia de Licencia' : 'Asignar / Crear Licencia para este Restaurante'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={extendOption}
                        onChange={(e) => setExtendOption(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="trial_7">+ 7 Días (Prueba)</option>
                        <option value="trial_15">+ 15 Días (Prueba)</option>
                        <option value="1">+ 1 Mes Adicional</option>
                        <option value="3">+ 3 Meses</option>
                        <option value="12">+ 1 Año</option>
                        <option value="lifetime">Licencia Vitalicia (99 años)</option>
                      </select>
                      <button
                        onClick={handleExtendLicense}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        {selectedTenant.license ? 'Aplicar' : 'Crear Licencia'}
                      </button>
                    </div>
                  </div>

                  {/* Botón de Emergencia: Suspender o Reactivar */}
                  <div className="pt-2 border-t border-slate-800">
                    {selectedTenant.status === 'active' ? (
                      <button
                        onClick={() => toggleLicenseStatus(selectedTenant)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-all cursor-pointer"
                      >
                        <Ban className="w-4 h-4" />
                        Suspender Restaurante Inmediatamente (Bloquea Celulares)
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleLicenseStatus(selectedTenant)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Reactivar Acceso al Restaurante
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: TERMINALES */}
              {activeTab === 'devices' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Teléfonos o tablets con acceso autorizado para este restaurante:
                  </p>
                  {tenantDevices.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No hay dispositivos vinculados a este establecimiento.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                      {tenantDevices.map(dev => (
                        <div key={dev.id} className="py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Smartphone className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-xs font-medium text-white">{dev.device_name}</div>
                              <div className="text-[10px] font-mono text-slate-500">{dev.hardware_id}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {dev.trust_status === 'trusted' ? (
                              <button
                                onClick={() => toggleDeviceTrust(dev.id, dev.trust_status)}
                                title="Revocar acceso a este celular"
                                className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold border border-rose-500/20 transition-all cursor-pointer"
                              >
                                Revocar
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleDeviceTrust(dev.id, dev.trust_status)}
                                title="Volver a autorizar este celular"
                                className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold border border-emerald-500/20 transition-all cursor-pointer"
                              >
                                Reactivar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PERSONAL Y PINS */}
              {activeTab === 'staff' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Personal registrado en este restaurante (puedes cambiar un PIN en caso de olvido):
                  </p>
                  {tenantUsers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No hay personal registrado en este local.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                      {tenantUsers.map(usr => {
                        const isAdminRole = usr.role === 'restaurant_admin';

                        return (
                          <div key={usr.id} className="py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Users className="w-4 h-4 text-slate-400" />
                              <div>
                                <div className="text-xs font-medium text-white">{usr.full_name}</div>
                                <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                                  isAdminRole ? 'text-amber-400' : 'text-indigo-400'
                                }`}>
                                  {isAdminRole ? 'Gerente / Admin' : 'Mesero (waiter_basic)'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleUpdateUserPin(usr.id, usr.full_name)}
                              title="Toca para cambiar este PIN"
                              className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-800 transition-colors cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3 text-slate-500" />
                                <span className="font-mono text-xs font-bold text-indigo-400 tracking-widest">
                                Cambiar PIN
                              </span>
                              <span className="text-[9px] text-slate-500 ml-1">✏️</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
    </div>
  );
}
