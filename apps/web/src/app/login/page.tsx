'use client';

import { supabase } from '@/lib/supabase';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

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

  // --- NUEVO: Función para iniciar sesión con Google ---
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/Confirm`,
      },
    });
  };
  // ---------------------------------------------------

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

        {/* --- NUEVO: Separador y Botón de Google --- */}
        <div className="pt-2">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex-1 border-t border-slate-800"></div>
            <span className="text-xs font-medium text-slate-500">O continuar con</span>
            <div className="flex-1 border-t border-slate-800"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Ingresar con Google
          </button>
        </div>
        {/* ------------------------------------------- */}

      </form>
    </main>
  );
}