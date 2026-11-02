'use client';

import {
  BarChart3,
  Building2,
  KeyRound,
  LogOut,
  ShieldAlert,
  Smartphone,
  UserRound
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const NAVIGATION_ITEMS = [
  { name: 'Restaurantes (Tenants)', href: '/tenants', icon: Building2 },
  { name: 'Operadores', href: '/operators', icon: UserRound },
  { name: 'Planes y Licencias', href: '/licenses', icon: KeyRound },
  { name: 'Distribución APK', href: '/apk-releases', icon: Smartphone },
  { name: 'Métricas Globales', href: '/metrics', icon: BarChart3 },
  { name: 'Auditoría y Seguridad', href: '/audit', icon: ShieldAlert },
];

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [operatorEmail, setOperatorEmail] = useState('');

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setOperatorEmail(data.user?.email ?? '');
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          void fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            }),
          });
        }
        setOperatorEmail(session?.user.email ?? '');
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
          C
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight">Comanda SaaS</h1>
          <span className="text-xs text-indigo-400 font-medium tracking-wide">SUPER ADMIN</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex flex-col text-xs">
          <span className="font-medium text-slate-200">Operador de plataforma</span>
          <span className="text-slate-500">{operatorEmail}</span>
        </div>
        <button 
          onClick={() => void handleSignOut()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
