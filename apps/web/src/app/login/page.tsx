'use client';

import { supabase } from '@/lib/supabase';
import { Loader2, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConsoleLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError || !data.session) {
      setError('Correo o contraseña incorrectos.');
      setIsLoading(false);
      return;
    }

    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      }),
    });

    if (!sessionResponse.ok) {
      await supabase.auth.signOut();
      const response = await sessionResponse.json().catch(() => ({}));
      setError(response.error || 'Esta cuenta no está habilitada para la consola.');
      setIsLoading(false);
      return;
    }

    const requestedNext = new URLSearchParams(window.location.search).get('next');
    const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/tenants';
    router.replace(data.user.user_metadata?.must_change_password ? '/change-password' : nextPath);
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Ingreso de operadores</h1>
          <p className="text-sm text-slate-400">Consola de administración Comanda</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <label className="block space-y-1.5 text-xs font-medium text-slate-300">
          Correo
          <input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" />
        </label>

        <label className="block space-y-1.5 text-xs font-medium text-slate-300">
          Contraseña
          <input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" />
        </label>

        <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
