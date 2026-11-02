'use client';

import { supabase } from '@/lib/supabase';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password.length < 14) {
      setError('Usa al menos 14 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace('/tenants');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <div>
          <h1 className="text-xl font-bold text-white">Crea tu contraseña personal</h1>
          <p className="mt-2 text-sm text-slate-400">La contraseña temporal debe reemplazarse antes de usar la consola.</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <label className="block space-y-1.5 text-xs text-slate-300">Nueva contraseña
          <input type="password" required minLength={14} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
        </label>
        <label className="block space-y-1.5 text-xs text-slate-300">Confirmar contraseña
          <input type="password" required minLength={14} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white" />
        </label>
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </main>
  );
}
