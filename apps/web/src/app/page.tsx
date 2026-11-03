'use client';

import {
  Armchair,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  ChartNoAxesColumnIncreasing,
  Check,
  ChefHat,
  Cloud,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Utensils,
  Wifi,
  Zap
} from 'lucide-react';
import { useEffect, useState } from 'react';
import OrderFlowDemo from './OrderFlowDemo';
import ScrollReveal from './ScrollReveal';

const EXPO_BUILD_PAGE_URL =
  'https://expo.dev/accounts/chechordguez/projects/Comanda/builds/7b2fe109-7d17-48c9-b762-f91a04a4bfb0';

function getAndroidApkUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const highlights = [
  'Operación desde el día 1 con tu Wi-Fi local',
  'Mesas y pedidos organizados desde el teléfono administrador',
  'Menú y personal del restaurante administrados desde la app',
  'Meseros conectados a la caja gestionando tus pedidos en tiempo real',
];

const modules = [
  {
    icon: Utensils,
    title: 'Comandas digitales',
    description: 'Toma pedidos desde el celular del mesero y envíalos al equipo sin papeles ni confusiones.',
  },
  {
    icon: ChefHat,
    title: 'Pantalla de cocina',
    description: 'Consulta los pedidos pendientes y su estado para organizar la preparación.',
  },
  {
    icon: Armchair,
    title: 'Gestión de mesas',
    description: 'Organiza mesas por zona y consulta de un vistazo cuáles están libres u ocupadas.',
  },
  {
    icon: Boxes,
    title: 'Inventario de productos y precios',
    description: 'Ten una referencia clara de tus productos e insumos para planificar la operación.',
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: 'Reportes y ventas',
    description: 'Consulta las ventas y el movimiento del restaurante desde un mismo lugar.',
  },
  {
    icon: ReceiptText,
    title: 'Cuentas y facturación',
    description: 'Revisa el detalle de consumo de cada mesa antes de cobrar y cerrar la cuenta.',
  },
];

const features = [
  {
    icon: Zap,
    title: 'Todo en tiempo real',
    description: 'Los pedidos y cambios de estado se comparten para que el equipo esté al tanto de la operación.',
  },
  {
    icon: Smartphone,
    title: 'En cualquier dispositivo',
    description: 'Accede desde los teléfonos y tablets compatibles que ya utilizas en el restaurante.',
  },
  {
    icon: Cloud,
    title: 'Información en la nube',
    description: 'Consulta la información centralizada del restaurante cuando la necesites.',
  },
  {
    icon: ShieldCheck,
    title: 'Acceso por roles',
    description: 'Cada integrante utiliza el acceso correspondiente a sus tareas en el restaurante.',
  },
];

// Pasos interactivos enriquecidos con diseño de alto impacto visual
const interactiveSteps = [
  {
    number: '01',
    title: 'Registro y Vinculación Cloud',
    subtitle: 'Autenticación instantánea en Supabase',
    body: 'Crea el perfil de tu establecimiento y sincroniza tus credenciales de administrador de forma cifrada en la nube.',
    state: 'En Línea',
    badge: 'Fase Inicial',
    icon: Cloud,
    image: '/images/ImageTableAlone.jpg',
    statLabel: 'Conexión Segura',
    statValue: '< 45ms Latencia',
  },
  {
    number: '02',
    title: 'Configuración de Menú y Zonas',
    subtitle: 'Arquitectura Operativa del Salón',
    body: 'Distribuye tus mesas por zonas (Terraza, Salón VIP, Barra), carga categorías de platos, precios e insumos y asigna PINs de seguridad.',
    state: 'Sincronizado',
    badge: 'Inventario & Mesas',
    icon: Boxes,
    image: '/images/ImageMainSalon.jpg',
    statLabel: 'Estructura Lista',
    statValue: '18 Mesas / 3 Zonas',
  },
  {
    number: '03',
    title: 'Enlace de Meseros por Wi-Fi',
    subtitle: 'Red Local de Alta Velocidad',
    body: 'Los teléfonos móviles del personal se conectan al instante con la caja registradora mediante la red local Wi-Fi de tu local.',
    state: 'Activo en Red',
    badge: 'Tiempo Real',
    icon: Wifi,
    image: '/images/ImageLobby.jpg',
    statLabel: 'Dispositivos',
    statValue: '4 Celulares Conectados',
  },
  {
    number: '04',
    title: 'Comandas y Reportes en Vivo',
    subtitle: 'Control Absoluto de Caja y Cocina',
    body: 'Despacha comandas digitales directo a la pantalla de cocina, monitorea tiempos de servicio y revisa cierres de caja automatizados.',
    state: 'Operando',
    badge: 'Dashboard Global',
    icon: ChartNoAxesColumnIncreasing,
    image: '/images/tables.jpg',
    statLabel: 'Ventas del Día',
    statValue: 'Sincronizadas al Cierre',
  },
];

export default function LandingPage() {
  const configuredApkUrl = getAndroidApkUrl();
  const apkUrl = configuredApkUrl ?? EXPO_BUILD_PAGE_URL;

  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % interactiveSteps.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <main className="min-h-screen scroll-smooth overflow-hidden bg-[#0A0A0A] text-[#F4F1EA]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-xl">
        <nav aria-label="Navegación principal" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <a href="#inicio" className="flex items-center gap-2 font-serif text-lg font-bold text-[#F4F1EA]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-neutral-950">
              <Utensils className="h-4 w-4" />
            </span>
            Comanda Cloud
          </a>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-neutral-300 sm:text-sm">
            <a className="transition-colors hover:text-amber-300" href="#inicio">Inicio</a>
            <a className="transition-colors hover:text-amber-300" href="#como-funciona">Paso a paso</a>
            <a className="transition-colors hover:text-amber-300" href="#modulos">Módulos</a>
            <a className="transition-colors hover:text-amber-300" href="#funciones">Funciones</a>
          </div>
        </nav>
      </header>

      {/* Fondo ambiental cálido principal */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[38rem] bg-[radial-gradient(ellipse_at_top,rgba(217,119,6,0.94),transparent_65%)]" />

      {/* SECCIÓN INICIO / HERO */}
      <section
        id="inicio"
        className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:pb-32 md:pt-20 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10, 10, 10, 0.44), rgba(10, 10, 10, 0.48)), url('/images/ImageTableAlone.jpg')`
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div>
          <h1 className="max-w-2xl text-4xl font-serif font-extrabold leading-[1.08] tracking-tight text-[#F4F1EA] sm:text-5xl lg:text-6xl">
            Toda tu operación en una sola pantalla.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-neutral-300 font-light sm:text-lg">
            Comanda Cloud conecta en tiempo real al administrador, meseros y cocina para 
            optimizar la gestión de tu restaurante. Controla mesas, personal, pedidos y reportes de ventas
            desde cualquier teléfono Android. Todo conectado, todo más fácil.
          </p>

          <ul className="mt-7 space-y-3">
            {highlights.map(item => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-neutral-200">
                <Check className="mt-1 h-4 w-4 shrink-0 text-amber-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div id="descarga" className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={apkUrl}
              target={configuredApkUrl ? undefined : '_blank'}
              rel="noopener noreferrer"
              download={configuredApkUrl ? 'Comanda.apk' : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-950/50 transition-all hover:bg-amber-400 hover:shadow-amber-500/20"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {configuredApkUrl
                ? 'Descargar Comanda para Android'
                : 'Ver descarga para Android en Expo'}
            </a>
            <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-3.5 text-sm font-semibold text-[#F4F1EA] transition-all hover:bg-white/10 hover:border-amber-500/30">
              Ver cómo funciona <ArrowRight className="h-4 w-4 text-amber-400" />
            </a>
          </div>
          <p className="mt-3 max-w-lg text-xs leading-5 text-neutral-500">
            {configuredApkUrl
              ? 'El instalador se abrirá desde el enlace seguro configurado.'
              : 'Se abrirá la página del build en Expo. Allí selecciona Install o Download para obtener el APK.'}
          </p>
        </div>

        {/* Tarjeta Hero Interactiva */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="relative rounded-[2rem] border border-white/15 bg-[#121212]/90 backdrop-blur-2xl p-6 shadow-2xl shadow-black/80">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-medium text-neutral-400">Tu Restaurante</p>
                <p className="mt-1 font-bold text-[#F4F1EA]">Paso a Paso para usar comanda cloud</p>
              </div>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-400 animate-pulse">
                Paso {activeStep + 1} de 4
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {interactiveSteps.map((item, index) => {
                const isActive = index === activeStep;
                return (
                  <div
                    key={item.number}
                    onClick={() => { setActiveStep(index); setIsPaused(true); }}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition-all duration-500 bg-cover bg-center relative overflow-hidden ${
                      isActive
                        ? 'border-amber-500 shadow-xl shadow-amber-950/60 scale-[1.03] ring-2 ring-amber-500/50'
                        : 'border-white/15 hover:border-amber-500/40 opacity-75 hover:opacity-100'
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(to bottom, rgba(10, 10, 10, 0.78), rgba(10, 10, 10, 0.90)), url('${item.image}')`
                    }}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <span className={`text-xs font-bold ${isActive ? 'text-amber-300' : 'text-white'}`}>Paso {index + 1}</span>
                      <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-amber-400 shadow-[0_0_8px_currentColor]' : 'bg-neutral-600'}`} />
                    </div>
                    <p className="mt-2.5 text-xs text-neutral-100 font-medium line-clamp-1 relative z-10">{item.title}</p>
                    <p className={`mt-1 text-[10px] font-semibold relative z-10 ${isActive ? 'text-amber-300' : 'text-emerald-400'}`}>{item.state}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 min-h-[5.5rem] flex flex-col justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 backdrop-blur-md p-3.5 text-xs text-neutral-300">
              <span className="font-bold text-white block mb-1">{interactiveSteps[activeStep].title}</span>
              <p className="text-[11px] text-neutral-400 line-clamp-2">{interactiveSteps[activeStep].body}</p>
            </div>
          </div>
        </div>
      </section>

      <OrderFlowDemo />

      {/* SECCIÓN MÓDULOS */}
      <section
        id="modulos"
        aria-labelledby="modules-title"
        className="relative scroll-mt-24 overflow-hidden border-y border-amber-500/10 bg-cover bg-center py-20 sm:py-24"
        style={{
          backgroundImage: "linear-gradient(rgba(10, 10, 10, 0.45), rgba(10, 10, 10, 0.49)), url('/images/cocina-chef.jpg')",
        }}
      >
        <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-amber-600/10 blur-[120px]" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="relative">
            <ScrollReveal className="mb-12 grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-end">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Módulos de Comanda Cloud</p>
                <h2 id="modules-title" className="max-w-2xl font-serif text-3xl font-extrabold leading-tight tracking-tight text-[#F4F1EA] sm:text-4xl lg:text-5xl">
                  Cada parte de tu restaurante, conectada.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-neutral-300 sm:text-base">
                Explora las herramientas para organizar pedidos, mesas y ventas desde una experiencia conectada.
              </p>
            </ScrollReveal>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(({ icon: Icon, title, description }, index) => (
                <ScrollReveal key={title} delay={index * 90} className="h-full">
                  <article className="group flex h-full gap-4 rounded-2xl border border-white/10 bg-[#121212]/75 p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/40 hover:bg-[#1A1A1A]/90 sm:p-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 transition-colors group-hover:bg-amber-500/20">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-[#F4F1EA] transition-colors group-hover:text-amber-300">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-400">{description}</p>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN FUNCIONES */}
      <section
        id="funciones"
        aria-labelledby="features-title"
        className="relative scroll-mt-24 overflow-hidden border-b border-amber-500/10 bg-cover bg-center py-20 sm:py-24"
        style={{
          backgroundImage: "linear-gradient(rgba(10, 10, 10, 0.43), rgba(10, 10, 10, 0.39)), url('/images/ImageMainSalon.jpg')",
        }}
      >
        <div className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-amber-600/10 blur-[130px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <ScrollReveal className="mb-12 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Funciones</p>
            <h2 id="features-title" className="font-serif text-3xl font-extrabold tracking-tight text-[#F4F1EA] sm:text-4xl lg:text-5xl">
              Menos improvisación, más control en cada servicio.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-300 sm:text-base">
              Comanda Cloud está pensada para ayudarte a mantener al equipo conectado y la información organizada durante el servicio.
            </p>
          </ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }, index) => (
              <ScrollReveal key={title} delay={index * 100} className="h-full">
                <article className="group h-full rounded-2xl border border-white/10 bg-[#121212]/75 p-6 shadow-xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/40 hover:bg-[#1A1A1A]/90">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 transition-colors group-hover:bg-amber-500/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-serif text-lg font-bold text-[#F4F1EA] transition-colors group-hover:text-amber-300">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-400">{description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* PIE DE PÁGINA */}
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 border-t border-white/5 bg-[#0A0A0A]">
        <p>© {new Date().getFullYear()} Comanda. Herramientas para el servicio diario.</p> 
        <p>Para Android · Activación inicial desde la consola web</p>
      </footer>
    </main>
  );
}