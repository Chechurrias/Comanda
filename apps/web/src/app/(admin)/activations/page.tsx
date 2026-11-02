'use client';

import { getConsoleAccessToken, supabase } from '@/lib/supabase';
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type TrustStatus = 'pending' | 'trusted' | 'revoked';
type PlanCode = 'basic' | 'pro' | 'enterprise';
type LicenseDuration = 'trial_7' | 'trial_15' | '1' | '12' | 'lifetime';

interface DeviceRequest {
  id: string;
  pairing_code: string | null;
  device_name: string | null;
  hardware_id: string | null;
  trust_status: TrustStatus;
  created_at: string;
  tenant_id: string | null;
}

interface PlanConfiguration {
  code: string;
  max_devices: number;
  max_waiters: number;
  max_tables: number;
}

const PLAN_OPTIONS: { value: PlanCode; label: string }[] = [
  { value: 'basic', label: 'Básico' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const DURATION_OPTIONS: {
  value: LicenseDuration;
  label: string;
}[] = [
  { value: 'trial_7', label: 'Versión de prueba — 7 días' },
  { value: 'trial_15', label: 'Versión de prueba — 15 días' },
  { value: '1', label: '1 mes' },
  { value: '12', label: '1 año — 12 meses' },
  // Se conserva la convención existente de 99 años.
  { value: 'lifetime', label: 'Larga duración — 99 años' },
];

const STATUS_CONFIG: Record<
  TrustStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pendiente',
    className:
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  trusted: {
    label: 'Autorizado',
    className:
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  revoked: {
    label: 'Revocado',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50';

const PARTIAL_ACTIVATIONS_STORAGE_KEY = 'comanda:partial-activations';

const LABEL_CLASS =
  'block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Ocurrió un error inesperado.';
}

function isPlanCode(value: string): value is PlanCode {
  return PLAN_OPTIONS.some(option => option.value === value);
}

function isLicenseDuration(value: string): value is LicenseDuration {
  return DURATION_OPTIONS.some(option => option.value === value);
}

function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(
      result.getUTCFullYear(),
      result.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  result.setUTCDate(Math.min(originalDay, lastDay));

  return result;
}

function getExpirationDate(
  startsAt: Date,
  duration: LicenseDuration
): Date {
  if (duration === 'trial_7' || duration === 'trial_15') {
    const expiresAt = new Date(startsAt);
    const days = duration === 'trial_7' ? 7 : 15;

    expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
    return expiresAt;
  }

  if (duration === 'lifetime') {
    return addMonthsClamped(startsAt, 99 * 12);
  }

  return addMonthsClamped(startsAt, Number(duration));
}

function validatePlanConfiguration(plan: PlanConfiguration): void {
  if (
    !Number.isInteger(plan.max_devices) ||
    plan.max_devices < 1 ||
    !Number.isInteger(plan.max_waiters) ||
    plan.max_waiters < 0 ||
    !Number.isInteger(plan.max_tables) ||
    plan.max_tables < 0
  ) {
    throw new Error(
      'El plan tiene límites inválidos. Revisa la tabla plans.'
    );
  }
}

export default function ActivationsPage() {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedDevice, setSelectedDevice] =
    useState<DeviceRequest | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [restaurantName, setRestaurantName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('pro');
  const [licenseDuration, setLicenseDuration] =
    useState<LicenseDuration>('trial_7');

  // Evita dos ejecuciones simultáneas antes del siguiente render.
  const processingRef = useRef(false);

  // Bloqueo local de dispositivos con una activación parcialmente guardada.
  const [partialActivations, setPartialActivations] = useState<
    Record<string, string>
  >({});
  const [isPartialStateLoaded, setIsPartialStateLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PARTIAL_ACTIVATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setPartialActivations(parsed as Record<string, string>);
        }
      }
    } catch (error) {
      console.warn('[Activations] No se pudo recuperar el estado parcial:', error);
    } finally {
      setIsPartialStateLoaded(true);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const { data, error } = await supabase
        .from('devices')
        .select(
          'id, pairing_code, device_name, hardware_id, trust_status, created_at, tenant_id'
        )
        .or(`trust_status.neq.pending,created_at.gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setRequests((data ?? []) as DeviceRequest[]);
    } catch (error: unknown) {
      console.error('[Activations] Error cargando dispositivos:', error);
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const closeModal = () => {
    if (processingRef.current) {
      return;
    }

    setIsModalOpen(false);
    setSelectedDevice(null);
    setAdminPin('');
    setActivationError('');
  };

  const openApproveModal = (device: DeviceRequest) => {
    if (!isPartialStateLoaded) {
      return;
    }

    if (processingRef.current) {
      return;
    }

    if (device.trust_status !== 'pending') {
      setLoadError('Solo puedes autorizar dispositivos pendientes.');
      return;
    }

    if (device.tenant_id || partialActivations[device.id]) {
      setLoadError(
        'Este dispositivo tiene una vinculación o activación parcial. Revisa sus registros antes de continuar.'
      );
      return;
    }

    setSelectedDevice(device);
    setRestaurantName(
      (device.device_name ?? '').replace(' (Móvil)', '').trim()
    );
    setAdminEmail('');
    setAdminPin('');
    setSelectedPlan('pro');
    setLicenseDuration('trial_7');
    setActivationError('');
    setSuccessMessage('');
    setIsModalOpen(true);
  };

  const handleApprove = async () => {
    if (processingRef.current) {
      return;
    }

    setActivationError('');

    const device = selectedDevice;
    const cleanName = restaurantName.trim();
    const cleanEmail = adminEmail.trim().toLowerCase();

    if (!device || device.trust_status !== 'pending') {
      setActivationError('Selecciona un dispositivo pendiente.');
      return;
    }

    if (device.tenant_id || partialActivations[device.id]) {
      setActivationError(
        'El dispositivo requiere revisión de una vinculación anterior.'
      );
      return;
    }

    if (!cleanName) {
      setActivationError('Ingresa el nombre del restaurante.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setActivationError('Ingresa un correo válido para el administrador.');
      return;
    }

    if (!/^\d{4}$/.test(adminPin)) {
      setActivationError('El PIN debe contener exactamente 4 dígitos.');
      return;
    }

    if (!isPlanCode(selectedPlan)) {
      setActivationError('Selecciona un plan válido.');
      return;
    }

    if (!isLicenseDuration(licenseDuration)) {
      setActivationError('Selecciona una duración válida.');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const accessToken = await getConsoleAccessToken();
      if (!accessToken) throw new Error('Tu sesión expiró. Ingresa de nuevo a la consola.');
      const response = await fetch('/api/admin/activate-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          deviceId: device.id,
          name: cleanName,
          email: cleanEmail,
          pin: adminPin,
          planCode: selectedPlan,
          duration: licenseDuration,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo completar la activación.');
      }

      setSuccessMessage(
        `Restaurante ${cleanName} creado; licencia, administrador y terminal quedaron vinculados en una sola operación.`
      );
      setIsModalOpen(false);
      setSelectedDevice(null);
      setAdminPin('');
      await fetchDevices();
    } catch (error: unknown) {
      setActivationError(getErrorMessage(error));
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredRequests = requests.filter(device =>
    [
      device.pairing_code,
      device.device_name,
      device.hardware_id,
    ].some(value =>
      (value ?? '').toLowerCase().includes(normalizedSearch)
    )
  );

  const selectedHasPartialActivation =
    selectedDevice !== null &&
    Boolean(partialActivations[selectedDevice.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-wrap justify-between items-center gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-indigo-400 shrink-0" />
            Terminales y dispositivos vinculados
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Alta única: solicita la activación desde el celular administrador y complétala aquí. Se crearán juntos el restaurante, licencia, administrador y terminal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchDevices()}
          disabled={isLoading || isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-indigo-400 ${
              isLoading ? 'animate-spin' : ''
            }`}
          />
          Refrescar
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {loadError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          {successMessage}
        </div>
      )}

      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />

          <input
            type="search"
            aria-label="Buscar dispositivos"
            placeholder="Buscar por código, dispositivo o ID de hardware..."
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/50">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Código terminal</th>
              <th className="px-5 py-3.5">Dispositivo</th>
              <th className="px-5 py-3.5">ID hardware</th>
              <th className="px-5 py-3.5">Fecha</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5 text-right">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando dispositivos...
                  </div>
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10"
                >
                  <div className="mx-auto max-w-lg space-y-3">
                    <p className="text-sm font-semibold text-slate-200">
                      No hay solicitudes de alta pendientes
                    </p>
                    <p className="text-xs leading-5 text-slate-400">
                      En el celular que será administrador, abre Comanda y elige “Activar restaurante”. Cuando aparezca la solicitud aquí, pulsa “Autorizar terminal” para registrar el cliente en una sola operación. Los meseros se emparejan después por la red local.
                    </p>
                    {searchTerm.trim() && (
                      <p className="text-xs text-amber-300">
                        También puede que ningún dispositivo coincida con la búsqueda.
                      </p>
                    )}
                    <Link
                      href="/tenants"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      Ver clientes existentes
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRequests.map(device => {
                const status = STATUS_CONFIG[device.trust_status];
                const needsReview =
                  Boolean(partialActivations[device.id]) ||
                  (device.trust_status === 'pending' &&
                    Boolean(device.tenant_id));

                return (
                  <tr
                    key={device.id}
                    className="hover:bg-slate-800/25"
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-400">
                      {device.pairing_code ?? '—'}
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-white">
                      {device.device_name ?? 'Sin nombre'}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400 break-all">
                      {device.hardware_id ?? '—'}
                    </td>

                    <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                      {new Date(device.created_at).toLocaleDateString(
                        'es-CO'
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${status.className}`}
                      >
                        {device.trust_status === 'pending' ? (
                          <Clock className="w-3 h-3" />
                        ) : device.trust_status === 'trusted' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}

                        {status.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {needsReview ? (
                        <span className="text-xs text-amber-400">
                          Requiere revisión
                        </span>
                      ) : device.trust_status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => openApproveModal(device)}
                          disabled={isProcessing || !isPartialStateLoaded}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold disabled:opacity-50"
                        >
                          Autorizar terminal
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {device.trust_status === 'trusted'
                            ? 'Activo'
                            : 'Revocado'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="activation-title"
            aria-busy={isProcessing}
            className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />

                <h2
                  id="activation-title"
                  className="text-sm font-semibold text-white"
                >
                  Autorizar terminal
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isProcessing}
                aria-label="Cerrar modal"
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={event => {
                event.preventDefault();
                void handleApprove();
              }}
              className="p-5 space-y-4"
            >
              <p className="text-xs text-slate-400">
                Terminal:{' '}
                <span className="font-mono text-indigo-300">
                  {selectedDevice.pairing_code ?? selectedDevice.id}
                </span>
              </p>

              {activationError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 break-words"
                >
                  {activationError}
                </div>
              )}

              <fieldset
                disabled={isProcessing || selectedHasPartialActivation}
                className="space-y-4 disabled:opacity-60"
              >
                <div>
                  <label
                    htmlFor="restaurant-name"
                    className={LABEL_CLASS}
                  >
                    Nombre del restaurante
                  </label>

                  <input
                    id="restaurant-name"
                    type="text"
                    required
                    maxLength={150}
                    value={restaurantName}
                    onChange={event =>
                      setRestaurantName(event.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-email"
                    className={LABEL_CLASS}
                  >
                    Correo del administrador
                  </label>

                  <input
                    id="admin-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="off"
                    value={adminEmail}
                    onChange={event =>
                      setAdminEmail(event.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="activation-plan"
                      className={LABEL_CLASS}
                    >
                      Plan
                    </label>

                    <select
                      id="activation-plan"
                      value={selectedPlan}
                      onChange={event => {
                        if (isPlanCode(event.target.value)) {
                          setSelectedPlan(event.target.value);
                        }
                      }}
                      className={INPUT_CLASS}
                    >
                      {PLAN_OPTIONS.map(option => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-pin"
                      className={LABEL_CLASS}
                    >
                      PIN administrador
                    </label>

                    <input
                      id="admin-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      required
                      minLength={4}
                      maxLength={4}
                      autoComplete="new-password"
                      value={adminPin}
                      onChange={event =>
                        setAdminPin(
                          event.target.value
                            .replace(/\D/g, '')
                            .slice(0, 4)
                        )
                      }
                      className={`${INPUT_CLASS} font-mono text-center tracking-widest`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="license-duration"
                    className={LABEL_CLASS}
                  >
                    Duración de la licencia
                  </label>

                  <select
                    id="license-duration"
                    value={licenseDuration}
                    onChange={event => {
                      if (isLicenseDuration(event.target.value)) {
                        setLicenseDuration(event.target.value);
                      }
                    }}
                    className={INPUT_CLASS}
                  >
                    {DURATION_OPTIONS.map(option => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Cerrar
                </button>

                <button
                  type="submit"
                  disabled={
                    isProcessing || selectedHasPartialActivation
                  }
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Autorizando...
                    </>
                  ) : (
                    'Autorizar terminal'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
