'use client';

import { FormEvent, useState } from 'react';

interface BootstrapResult {
  email: string;
  password: string;
  message: string;
}

export default function ConsoleSetupPage() {
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bootstrapSecret }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo crear la cuenta.');
      setResult(body as BootstrapResult);
      setBootstrapSecret('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Inicializar operador maestro</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Este enlace solo crea la primera cuenta de consola y queda bloqueado después. Necesita la clave de inicialización configurada en el servidor.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        {result ? (
          <div role="status" className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <p>{result.message}</p>
            <p>Correo: <strong>{result.email}</strong></p>
            <p className="break-all">Contraseña inicial: <strong className="font-mono">{result.password}</strong></p>
            <p className="text-xs text-emerald-100">Guárdala ahora en un gestor de contraseñas. No volverá a mostrarse.</p>
            <a href="/login" className="inline-block font-semibold underline">Ir al ingreso</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5 text-xs font-medium text-slate-300">
              Clave de inicialización de un solo uso
              <input type="password" required autoComplete="off" value={bootstrapSecret} onChange={event => setBootstrapSecret(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" />
            </label>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {loading ? 'Creando cuenta…' : 'Crear cuenta maestra'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
