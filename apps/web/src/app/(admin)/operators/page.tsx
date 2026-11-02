'use client';

import { getConsoleAccessToken } from '@/lib/supabase';
import { FormEvent, useCallback, useEffect, useState } from 'react';

interface Operator {
  user_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'operator';
  is_active: boolean;
  created_at: string;
}

interface NewCredentials {
  email: string;
  password: string;
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (method: string, body?: unknown) => {
    const token = await getConsoleAccessToken();
    if (!token) throw new Error('Tu sesión expiró. Ingresa nuevamente.');
    const response = await fetch('/api/admin/operators', {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
    return result;
  }, []);

  const loadOperators = useCallback(async () => {
    try {
      const result = await request('GET');
      setOperators(result.operators ?? []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado.');
    }
  }, [request]);

  useEffect(() => { void loadOperators(); }, [loadOperators]);

  const createOperator = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setCredentials(null);
    try {
      const result = await request('POST', { email, fullName });
      setCredentials({ email: result.email, password: result.password });
      setEmail('');
      setFullName('');
      await loadOperators();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado.');
    } finally {
      setBusy(false);
    }
  };

  const toggleOperator = async (operator: Operator) => {
    setBusy(true);
    setError('');
    try {
      await request('PATCH', { userId: operator.user_id, isActive: !operator.is_active });
      await loadOperators();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Cuentas de operadores</h1>
        <p className="mt-1 text-sm text-slate-400">Solo el propietario puede crear o desactivar cuentas de consola.</p>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {credentials && (
        <section role="status" className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <h2 className="font-semibold">Credenciales iniciales del operador</h2>
          <p>Correo: <strong>{credentials.email}</strong></p>
          <p className="break-all">Contraseña: <strong className="font-mono">{credentials.password}</strong></p>
          <p className="text-xs">Se muestra solo ahora. Entrégala por un canal seguro y solicita que la cambie.</p>
        </section>
      )}

      <form onSubmit={createOperator} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-xs text-slate-300">Nombre
          <input required maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <label className="space-y-1 text-xs text-slate-300">Correo
          <input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
        <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Crear operador</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="divide-y divide-slate-800/70">
          {operators.map(operator => (
            <div key={operator.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-200">{operator.full_name || operator.email}</p>
                <p className="text-xs text-slate-400">{operator.email}</p>
                <p className="font-mono text-[10px] text-slate-500">{operator.user_id}</p>
                <p className="mt-1 text-xs text-slate-500">{operator.role === 'owner' ? 'Propietario' : 'Operador'} · {new Date(operator.created_at).toLocaleDateString('es-CO')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={operator.is_active ? 'text-xs text-emerald-400' : 'text-xs text-rose-400'}>{operator.is_active ? 'Activo' : 'Desactivado'}</span>
                {operator.role !== 'owner' && <button type="button" disabled={busy} onClick={() => void toggleOperator(operator)} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">{operator.is_active ? 'Desactivar' : 'Reactivar'}</button>}
              </div>
            </div>
          ))}
          {operators.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No se pudieron cargar operadores o no hay cuentas.</p>}
        </div>
      </section>
    </div>
  );
}
