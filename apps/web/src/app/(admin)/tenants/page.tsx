'use client';

import { getConsoleAccessToken, supabase } from '@/lib/supabase';
import {
  Armchair,
  Ban,
  Building2,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Users,
  X,
  XCircle
} from 'lucide-react';
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
  users_count: number;
}

interface UserItem {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface TenantInspection {
  tenant: {
    id: string;
    name: string | null;
    slug: string | null;
    status: string;
    timezone: string;
    currency: string;
    contact_email: string | null;
    contact_phone: string | null;
    created_at: string;
    updated_at: string;
    legal_name: string | null;
    trade_name: string | null;
    tax_id: string | null;
    logo_url: string | null;
  };
  licenses: Array<Record<string, string | number | boolean | null>>;
  tables: Array<{ id: string; identifier: string; zone: string; status: string; created_at: string; is_archived: boolean }>;
  categories: Array<{ id: string; name: string; sort_order: number | null; created_at: string }>;
  menuItems: Array<{ id: string; category_id: string | null; name: string; price: number; is_available: boolean; created_at: string }>;
  staff: Array<{ id: string; full_name: string; role: string; is_active: boolean; created_at: string; email: string | null }>;
  orders: Array<{ id: string; table_id: string | null; table_identifier: string | null; staff_id: string | null; waiter_name: string; status: string; total: number; payment_method: string | null; created_at: string; closed_at: string | null }>;
  orderItems: Array<{ id: string; order_id: string; menu_item_id: string | null; name: string; unit_price: number; quantity: number; subtotal: number; created_at: string }>;
}

type InspectionTab = 'overview' | 'tables' | 'menu' | 'staff' | 'sales';

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
  const [activeTab, setActiveTab] = useState<'license' | 'staff'>('license');
  const [tenantUsers, setTenantUsers] = useState<UserItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inspection, setInspection] = useState<TenantInspection | null>(null);
  const [inspectionTenant, setInspectionTenant] = useState<TenantDetail | null>(null);
  const [inspectionTab, setInspectionTab] = useState<InspectionTab>('overview');
  const [isInspectionLoading, setIsInspectionLoading] = useState(false);
  const [inspectionError, setInspectionError] = useState('');

  // Formulario de extensión de licencia
  const [extendOption, setExtendOption] = useState('1');

  // 1. Cargar clientes y consolidar datos de Supabase (Sin la tabla devices)
  const loadTenantsData = async () => {
    setIsLoading(true);
    try {
      const [tenantsRes, licensesRes, plansRes, staffRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('licenses').select('*'),
        supabase.from('plans').select('*'),
        supabase.from('restaurant_staff').select('id, tenant_id, role')
      ]);

      const queryError = tenantsRes.error || licensesRes.error || plansRes.error || staffRes.error;
      if (queryError) throw queryError;

      const rawTenants = tenantsRes.data || [];
      const rawLicenses = licensesRes.data || [];
      const rawPlans = plansRes.data || [];
      const rawStaff = staffRes.data || [];

      const consolidated: TenantDetail[] = rawTenants.map((t) => {
        const tenantLicenses = rawLicenses
          .filter(l => l.tenant_id === t.id)
          .sort((a, b) => new Date(b.created_at || b.starts_at || 0).getTime() - new Date(a.created_at || a.starts_at || 0).getTime());
        const lic = tenantLicenses.find(l => l.is_active) || tenantLicenses[0];
        const plan = lic ? rawPlans.find(p => p.code?.toLowerCase() === lic.plan?.toLowerCase()) : null;
        const staffCount = rawStaff.filter(staff => staff.tenant_id === t.id).length;

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
          users_count: staffCount,
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

    const staffRes = await supabase
      .from('restaurant_staff')
      .select('id, full_name, role, is_active')
      .eq('tenant_id', tenant.id);

    if (staffRes.error) {
      alert(`No se pudo cargar el personal del restaurante: ${staffRes.error.message}`);
      return;
    }
    setTenantUsers(staffRes.data || []);
  };

  const openInspection = async (tenant: TenantDetail) => {
    setInspectionTenant(tenant);
    setInspection(null);
    setInspectionError('');
    setInspectionTab('overview');
    setIsInspectionLoading(true);

    try {
      const accessToken = await getConsoleAccessToken();
      if (!accessToken) throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');

      const response = await fetch(`/api/admin/tenants/${tenant.id}/details`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
      const responseBody = await response.text();
      let result: Partial<TenantInspection> & { error?: string };
      try {
        result = JSON.parse(responseBody);
      } catch {
        throw new Error(`El servidor devolvió una respuesta inesperada (HTTP ${response.status}). Intenta actualizar la página.`);
      }
      if (!response.ok) throw new Error(result.error || 'No se pudo consultar el restaurante.');
      setInspection(result as TenantInspection);
    } catch (error) {
      setInspectionError(error instanceof Error ? error.message : 'No se pudo cargar el detalle.');
    } finally {
      setIsInspectionLoading(false);
    }
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

  // 5. Extender Vigencia de Licencia
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
            max_devices: PLAN_LIMITS.pro.max_devices,
            max_waiters: PLAN_LIMITS.pro.max_waiters,
            max_tables: PLAN_LIMITS.pro.max_tables,
            is_active: true,
            starts_at: new Date().toISOString(),
            expires_at: newExpiry.toISOString(),
          });
        if (error) throw error;
      }

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

  // 7. Modificar/Resetear PIN de un usuario
  const handleUpdateUserPin = async (userId: string, userName: string) => {
    const newPin = prompt(`Ingresa el nuevo PIN de 4 dígitos para ${userName}:`);
    if (!newPin) return;

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      alert('El PIN debe tener exactamente 4 números.');
      return;
    }

    try {
      const { error } = await supabase.from('restaurant_staff').update({ pin_code: newPin }).eq('id', userId);
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
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Control de Restaurantes Clientes
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Supervisa planes, vigencias y personal de cada cliente en la nube.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Vencimiento</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loadError ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-rose-400">
                    {loadError}
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    Aún no hay restaurantes registrados en la base de datos.
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
                          onClick={() => openInspection(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 mr-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
                        >
                          <Eye className="w-3 h-3" />
                          Ver detalle
                        </button>
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

      {/* 5. MODAL: GESTIÓN INTEGRAL DEL RESTAURANTE */}
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
                        Suspender Restaurante Inmediatamente
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

              {/* TAB 2: PERSONAL Y PINS */}
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
                                  {isAdminRole ? 'Gerente / Admin' : 'Mesero'}
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

      {inspectionTenant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm">
          <section className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">{inspectionTenant.name}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {inspectionTenant.trade_name || 'Detalle del restaurante'} · {inspectionTenant.tax_id || 'Sin NIT'}
                </p>
              </div>
              <button onClick={() => setInspectionTenant(null)} aria-label="Cerrar detalle" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </header>

            <nav className="flex gap-1 overflow-x-auto px-4 border-b border-slate-800">
              {([
                ['overview', 'General'],
                ['tables', 'Mesas'],
                ['menu', 'Platos y categorías'],
                ['staff', 'Meseros'],
                ['sales', 'Comandas y ventas'],
              ] as Array<[InspectionTab, string]>).map(([tab, label]) => (
                <button key={tab} onClick={() => setInspectionTab(tab)} className={`shrink-0 px-3 py-3 text-xs font-semibold border-b-2 ${inspectionTab === tab ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </nav>

            <div className="p-5 overflow-y-auto">
              {isInspectionLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Consultando datos seguros de Supabase…
                </div>
              ) : inspectionError ? (
                <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{inspectionError}</div>
              ) : inspection ? (
                <>
                  {inspectionTab === 'overview' && (
                    <div className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          ['Mesas', inspection.tables.length, <Armchair key="tables" className="w-4 h-4" />],
                          ['Platos', inspection.menuItems.length, <Utensils key="menu" className="w-4 h-4" />],
                          ['Meseros', inspection.staff.length, <Users key="staff" className="w-4 h-4" />],
                          ['Comandas', inspection.orders.length, <ReceiptText key="orders" className="w-4 h-4" />],
                        ].map(([label, count, icon]) => (
                          <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                            <div className="flex items-center justify-between text-slate-400 text-xs">{label}{icon}</div>
                            <p className="mt-2 text-2xl font-bold text-white">{count}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <DetailCard title="Información del establecimiento">
                          <DetailRow label="Nombre comercial" value={inspection.tenant.trade_name || inspection.tenant.name} />
                          <DetailRow label="Razón social" value={inspection.tenant.legal_name} />
                          <DetailRow label="NIT" value={inspection.tenant.tax_id} />
                          <DetailRow label="Slug" value={inspection.tenant.slug} />
                          <DetailRow label="Estado" value={inspection.tenant.status} />
                          <DetailRow label="Moneda / zona horaria" value={`${inspection.tenant.currency} · ${inspection.tenant.timezone}`} />
                          <DetailRow label="Correo" value={inspection.tenant.contact_email} />
                          <DetailRow label="Teléfono" value={inspection.tenant.contact_phone} />
                          <DetailRow
                            label="Logotipo"
                            value={inspection.tenant.logo_url
                              ? <a href={inspection.tenant.logo_url} target="_blank" rel="noreferrer" className="text-indigo-300 underline">Ver archivo</a>
                              : 'Sin logotipo'}
                          />
                          <DetailRow label="Creado" value={formatDateTime(inspection.tenant.created_at)} />
                          <DetailRow label="Actualizado" value={formatDateTime(inspection.tenant.updated_at)} />
                        </DetailCard>
                        <DetailCard title="Licencias">
                          {inspection.licenses.length ? inspection.licenses.map((license, index) => (
                            <div key={String(license.id ?? index)} className="border-b border-slate-800 last:border-0 py-2">
                              <DetailRow label="Plan" value={String(license.plan_name ?? license.plan ?? '—')} />
                              <DetailRow label="Estado" value={license.is_active ? 'Activa' : 'Inactiva'} />
                              <DetailRow label="Vigencia" value={`${formatDateTime(String(license.starts_at ?? ''))} – ${formatDateTime(String(license.expires_at ?? ''))}`} />
                              <DetailRow label="Capacidades configuradas" value={`Dispositivos ${license.max_devices ?? '—'} · Meseros ${license.max_waiters ?? '—'} · Mesas ${license.max_tables ?? '—'}`} />
                            </div>
                          )) : <p className="text-xs text-slate-500">Sin licencias registradas.</p>}
                        </DetailCard>
                      </div>
                    </div>
                  )}

                  {inspectionTab === 'tables' && (
                    <DataTable
                      icon={<Armchair className="w-4 h-4" />}
                      title="Mesas"
                      empty="No hay mesas registradas."
                      headers={['Mesa', 'Zona', 'Estado', 'Archivada', 'Creada']}
                      rows={inspection.tables.map(table => [table.identifier, table.zone, table.status, table.is_archived ? 'Sí' : 'No', formatDateTime(table.created_at)])}
                    />
                  )}
                  {inspectionTab === 'menu' && (
                    <div className="space-y-6">
                      <DataTable
                        icon={<Utensils className="w-4 h-4" />}
                        title="Platos"
                        empty="No hay platos registrados."
                        headers={['Plato', 'Categoría', 'Precio', 'Disponible', 'Creado']}
                        rows={inspection.menuItems.map(item => [
                          item.name,
                          inspection.categories.find(category => category.id === item.category_id)?.name ?? 'Sin categoría',
                          `${inspection.tenant.currency} ${Number(item.price).toLocaleString()}`,
                          item.is_available ? 'Sí' : 'No',
                          formatDateTime(item.created_at),
                        ])}
                      />
                      <DataTable
                        icon={<Utensils className="w-4 h-4" />}
                        title="Categorías"
                        empty="No hay categorías registradas."
                        headers={['Categoría', 'Orden', 'Creada']}
                        rows={inspection.categories.map(category => [category.name, category.sort_order ?? '—', formatDateTime(category.created_at)])}
                      />
                    </div>
                  )}
                  {inspectionTab === 'staff' && (
                    <DataTable
                      icon={<Users className="w-4 h-4" />}
                      title="Meseros"
                      empty="No hay meseros registrados."
                      headers={['Nombre', 'Rol', 'Estado', 'Correo', 'Creado']}
                      rows={inspection.staff.map(person => [person.full_name, person.role, person.is_active ? 'Activo' : 'Pausado', person.email || '—', formatDateTime(person.created_at)])}
                    />
                  )}
                  {inspectionTab === 'sales' && (
                    <div className="space-y-3">
                      <DataTable
                        icon={<ReceiptText className="w-4 h-4" />}
                        title="Comandas y ventas"
                        empty="No hay comandas registradas."
                        headers={['Fecha', 'Mesa', 'Mesero', 'Estado', 'Total', 'Pago', 'Ítems']}
                        rows={inspection.orders.map(order => [
                          formatDateTime(order.created_at),
                          order.table_identifier || inspection.tables.find(table => table.id === order.table_id)?.identifier || 'Mesa eliminada',
                          order.waiter_name || inspection.staff.find(person => person.id === order.staff_id)?.full_name || '—',
                          order.status,
                          `${inspection.tenant.currency} ${Number(order.total).toLocaleString()}`,
                          order.payment_method || '—',
                          inspection.orderItems.filter(item => item.order_id === order.id).map(item => `${item.quantity}× ${item.name} (${inspection.tenant.currency} ${Number(item.subtotal).toLocaleString()})`).join(', ') || '—',
                        ])}
                      />
                    </div>
                  )}
                  <p className="mt-4 text-[11px] text-slate-500">
                    Consulta de solo lectura. Por seguridad, no se muestran PINs, hashes ni identificadores de autenticación.
                  </p>
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value || '—'}</span>
    </div>
  );
}

function DataTable({
  icon,
  title,
  empty,
  headers,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800">
      <div className="flex items-center gap-2 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white">{icon}{title}</div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-xs text-slate-300">
            <thead className="bg-slate-950/40 text-[10px] uppercase text-slate-500">
              <tr>{headers.map(header => <th key={header} className="px-4 py-2.5 font-semibold">{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top hover:bg-slate-800/30">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-md whitespace-normal px-4 py-3">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-4 py-8 text-center text-xs text-slate-500">{empty}</p>}
    </section>
  );
}