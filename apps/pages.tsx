import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Download,
    QrCode,
    ShieldCheck,
    Smartphone,
    Sparkles,
    WifiOff
} from 'lucide-react';
import Link from 'next/link';

// 👉 REEMPLAZA ESTA URL con el enlace público de tu APK en Supabase Storage
const APK_DOWNLOAD_URL = "https://tu-proyecto.supabase.co/storage/v1/object/public/downloads/comanda-pos.apk";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      
      {/* 1. Barra de Navegación */}
      <nav className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              C
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Comanda POS</span>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/tenants" 
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Consola SaaS
            </Link>
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar APK
            </a>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <header className="relative pt-16 pb-20 px-6 max-w-5xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Fase de Prueba Controlada • Versión Android</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight sm:leading-none">
          El sistema POS que <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">
            no se cae cuando se cae el internet
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Diseñado para restaurantes, bares y cafeterías. Toma pedidos en sala con celulares de meseros, cobra en caja y supervisa tus ventas con total autonomía local.
        </p>

        {/* Botón Principal de Descarga */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a
            href={APK_DOWNLOAD_URL}
            download
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-base font-bold shadow-xl shadow-indigo-600/25 transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            Descargar APK para Android
          </a>

          <a
            href="#beneficios"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-base font-semibold border border-slate-800 transition-colors"
          >
            Ver características
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <p className="text-[11px] text-slate-500 mt-3">
          Compatible con Android 8.0 o superior • Instalación directa y segura
        </p>
      </header>

      {/* 3. Beneficios y Características */}
      <section id="beneficios" className="py-16 px-6 max-w-6xl mx-auto w-full border-t border-slate-800/80">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            ¿Por qué elegir Comanda POS?
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Tecnología híbrida: la velocidad del motor local y el control de la nube.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">100% Autónomo Offline</h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Toda la operación corre sobre base de datos local SQLite. Si la red externa falla, las comandas, cobros y mesas siguen funcionando a máxima velocidad.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Vinculación en 5 Segundos</h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Los meseros vinculan su celular escaneando el código QR que muestra la caja principal. Sin contraseñas complejas ni configuraciones de red manuales.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4 border border-sky-500/20">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Cierres y Reportes Diarios</h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Consulta en tiempo real el total facturado, desglose por método de pago (Efectivo, Tarjeta, Transferencia), ticket promedio y ranking de platos vendidos.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Roles Blindados</h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Interfaz exclusiva para meseros (solo comanda y pre-cuenta) y consola completa para administradores con permisos de creación de mesas y cobro.
              </p>
            </div>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Control Anti-Fuga</h3>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Pausa a meseros temporales con un toque o suspende terminales remotamente desde la nube si un dispositivo se pierde o es revocado.
              </p>
            </div>
          </div>

          {/* Card 6 (CTA Directo) */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-slate-900 border border-indigo-500/30 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                Listo para Probar
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
                Descarga la aplicación, instala en tu dispositivo de prueba e inicia el turno con tu PIN de acceso.
              </p>
            </div>
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
            >
              <Download className="w-4 h-4" />
              Descargar Archivo APK
            </a>
          </div>

        </div>
      </section>

      {/* 4. Footer */}
      <footer className="mt-auto border-t border-slate-800/60 py-8 px-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Comanda POS • Sistema de Punto de Venta para Restaurantes</p>
      </footer>

    </div>
  );
}