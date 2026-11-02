import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ClipboardList,
  Menu as MenuIcon,
  Smartphone,
  Wifi,
} from 'lucide-react';

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
  'Mesas y pedidos organizados desde el teléfono administrador',
  'Menú y personal del restaurante administrados en la app',
  'Meseros conectados a la caja por el Wi-Fi local',
];

export default function LandingPage() {
  const configuredApkUrl = getAndroidApkUrl();
  const apkUrl = configuredApkUrl ?? EXPO_BUILD_PAGE_URL;

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,rgba(79,70,229,0.22),transparent_65%)]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="#inicio" className="flex items-center gap-3" aria-label="Comanda, inicio">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-lg font-black text-white shadow-lg shadow-indigo-950/60">C</span>
          <span className="text-lg font-bold tracking-tight">Comanda</span>
        </a>
        <a
          href="#descarga"
          className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-white transition hover:border-indigo-400 hover:bg-slate-800"
        >
          Obtener la app
        </a>
      </header>

      <section id="inicio" className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:pb-32 md:pt-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Operación conectada dentro de tu restaurante
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Tus mesas y pedidos, <span className="text-indigo-300">en orden.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Comanda conecta al administrador y a los meseros para gestionar el menú,
            atender mesas y enviar pedidos desde teléfonos Android.
          </p>

          <ul className="mt-7 space-y-3">
            {highlights.map(item => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>

          <div id="descarga" className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={apkUrl}
              target={configuredApkUrl ? undefined : '_blank'}
              rel="noopener noreferrer"
              download={configuredApkUrl ? 'Comanda.apk' : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-400"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {configuredApkUrl
                ? 'Descargar Comanda para Android'
                : 'Ver descarga para Android en Expo'}
            </a>
            <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-5 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-900">
              Ver cómo funciona <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-3 max-w-lg text-xs leading-5 text-slate-500">
            {configuredApkUrl
              ? 'El instalador se abrirá desde el enlace seguro configurado.'
              : 'Se abrirá la página del build en Expo. Allí selecciona Install o Download para obtener el APK.'}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-indigo-500/10 blur-2xl" />
          <div className="relative rounded-[2rem] border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs font-medium text-slate-400">Restaurante</p>
                <p className="mt-1 font-bold text-white">Vista de operación</p>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">En la red local</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { table: 'Mesa 04', detail: '2 pedidos', state: 'En preparación', color: 'text-amber-300' },
                { table: 'Mesa 07', detail: '4 personas', state: 'Atendida', color: 'text-emerald-300' },
                { table: 'Mesa 09', detail: '1 pedido', state: 'Nuevo pedido', color: 'text-indigo-300' },
                { table: 'Mesa 12', detail: 'Disponible', state: 'Libre', color: 'text-slate-400' },
              ].map(item => (
                <div key={item.table} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{item.table}</span>
                    <span className={`h-2 w-2 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                  </div>
                  <p className="mt-4 text-xs text-slate-400">{item.detail}</p>
                  <p className={`mt-1 text-xs font-semibold ${item.color}`}>{item.state}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-200"><Wifi className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold text-white">Administrador + meseros</p>
                <p className="mt-1 text-xs text-slate-400">Pedidos compartidos por la red Wi-Fi del local</p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-xl sm:flex sm:items-center sm:gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ClipboardList className="h-4 w-4" /></span>
            <span className="text-xs font-semibold text-white">Comandas sincronizadas localmente</span>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-y border-slate-800 bg-slate-900/45">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Así se usa</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Del administrador a cada mesa</h2>
            <p className="mt-4 leading-7 text-slate-400">Un flujo sencillo para poner al equipo en marcha y mantener los pedidos conectados durante el servicio.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { number: '01', icon: Smartphone, title: 'Activa el restaurante', body: 'La consola web registra el restaurante, su licencia, el administrador y el primer teléfono autorizado.' },
              { number: '02', icon: MenuIcon, title: 'Prepara la operación', body: 'Desde el teléfono administrador, configura el menú, las mesas y los PIN del personal.' },
              { number: '03', icon: Wifi, title: 'Conecta a los meseros', body: 'Los teléfonos del equipo se enlazan con la caja por el Wi-Fi local para consultar mesas y enviar comandas.' },
            ].map(step => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-widest text-indigo-300">{step.number}</span>
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="mt-7 text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{step.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Comanda. Herramientas para el servicio diario.</p>
        <p>Para Android · Activación inicial desde la consola web</p>
      </footer>
    </main>
  );
}
