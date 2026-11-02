'use client';

import { supabase } from '@/lib/supabase'; // Asegúrate de que esta ruta apunte a tu cliente de Supabase
import { CheckCircle2, Smartphone } from 'lucide-react';
import { useEffect } from 'react';

export default function EmailConfirmedPage() {
  useEffect(() => {
    // Cuando la página carga, Supabase lee silenciosamente la URL de confirmación
    // y guarda la sesión del usuario en el navegador de manera segura.
    const procesarLogin = async () => {
      try {
        await supabase.auth.getSession();
      } catch (error) {
        console.error('Error al procesar la sesión:', error);
      }
    };
    procesarLogin();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
        
        {/* Ícono de Éxito */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            ¡Correo Confirmado con Éxito!
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Tu cuenta de administrador ha sido verificada correctamente en Comanda Cloud.
          </p>
        </div>

        {/* Tarjeta de Instrucción */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
          Ya puedes abrir la aplicación <strong className="text-white">Comanda</strong> en tu dispositivo e iniciar sesión con tu correo y contraseña.
        </div>

        {/* Botón para intentar abrir la app móvil por Deep Link */}
        <div className="pt-2">
          <a
            href="comanda://"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Smartphone className="w-4 h-4" />
            Abrir App Comanda
          </a>
        </div>

      </div>
    </div>
  );
}