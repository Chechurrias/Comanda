'use client';

import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  CookingPot,
  PackageCheck,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

const orderItems = [
  { name: 'Hamburguesa de la casa', detail: 'Queso cheddar · papas rústicas', quantity: 1, price: 28900 },
  { name: 'Limonada natural', detail: 'Vaso grande', quantity: 2, price: 9500 },
  { name: 'Brownie tibio', detail: 'Con helado de vainilla', quantity: 1, price: 12500 },
];

const orderStages = [
  { label: 'Borrador', detail: 'El mesero revisa la comanda antes de enviarla.', icon: Clock3 },
  { label: 'Enviado', detail: 'La comanda salió del dispositivo del mesero.', icon: Send },
  { label: 'Recibido en cocina', detail: 'El equipo de cocina recibió el pedido.', icon: ChefHat },
  { label: 'En preparación', detail: 'Cocina está preparando los productos.', icon: CookingPot },
  { label: 'Listo para entregar', detail: 'El pedido está listo para llevar a la mesa.', icon: PackageCheck },
  { label: 'Entregado', detail: 'La comanda llegó a la Mesa 08.', icon: CheckCircle2 },
];

const actionLabels = [
  'Enviar pedido a cocina',
  'Simular recepción en cocina',
  'Iniciar preparación',
  'Marcar pedido como listo',
  'Confirmar entrega a la mesa',
];

function formatPrice(value: number) {
  return `$${value.toLocaleString('es-CO')}`;
}

export default function OrderFlowDemo() {
  const [stage, setStage] = useState(0);
  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const currentStage = orderStages[stage];
  const CurrentIcon = currentStage.icon;
  const progress = (stage / (orderStages.length - 1)) * 100;
  const isDelivered = stage === orderStages.length - 1;

  return (
    <section
      id="como-funciona"
      aria-labelledby="order-flow-title"
      className="relative isolate scroll-mt-24 overflow-hidden border-y border-amber-500/10 bg-[#0A0A0A] py-20 text-[#F4F1EA] sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(rgba(10, 10, 10, 0.88), rgba(10, 10, 10, 0.92)), url('/images/bartender.jpg')",
        }}
      />
      <div className="pointer-events-none absolute -left-36 top-8 z-0 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-36 bottom-0 z-0 h-96 w-96 rounded-full bg-amber-600/10 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10 grid gap-5 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-amber-400">
              <Sparkles className="h-4 w-4 animate-pulse" />
              Paso a paso · simulación interactiva
            </p>
            <h2 id="order-flow-title" className="max-w-2xl font-serif text-3xl font-extrabold leading-tight tracking-tight text-[#F4F1EA] sm:text-4xl lg:text-5xl">
              De la mesa a cocina, y de cocina de vuelta a la mesa.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-neutral-300 sm:text-base">
            Envía una comanda de ejemplo y avanza por cada etapa del servicio. Prueba cómo el equipo puede seguir el pedido en todo momento.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <article className="rounded-[1.75rem] border border-white/10 bg-[#121212]/85 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-500 hover:border-amber-500/30 hover:shadow-amber-950/20 sm:p-7 lg:col-span-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Comanda de demostración</p>
                <h3 className="mt-1 font-serif text-2xl font-bold text-[#F4F1EA]">Mesa 08</h3>
                <p className="mt-1 text-xs text-neutral-500">Pedido #024 · Salón principal</p>
              </div>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
                Datos ficticios
              </span>
            </div>

            <div className="space-y-3 py-5">
              {orderItems.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition-all duration-500 hover:border-amber-500/20 hover:bg-white/[0.07]"
                  style={{ transitionDelay: `${index * 70}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm font-bold text-amber-300">
                      {item.quantity}×
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-100">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{item.detail}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-neutral-200">
                    {formatPrice(item.quantity * item.price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm font-medium text-neutral-400">Total de la comanda</span>
              <span className="text-xl font-bold text-[#F4F1EA]">{formatPrice(subtotal)}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStage(current => Math.min(current + 1, orderStages.length - 1))}
                disabled={isDelivered}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-950/40 transition-all duration-300 hover:-translate-y-0.5 hover:bg-amber-400 disabled:cursor-default disabled:bg-amber-500/70 disabled:hover:translate-y-0"
              >
                {stage === 0 ? <Send className="h-4 w-4" /> : isDelivered ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {isDelivered ? 'Pedido entregado' : actionLabels[stage]}
              </button>
              <button
                type="button"
                onClick={() => setStage(0)}
                disabled={stage === 0}
                aria-label="Reiniciar simulación"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-amber-500/30 hover:bg-white/10 disabled:cursor-default disabled:opacity-45"
              >
                <RotateCcw className="h-4 w-4" />
                Reiniciar
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-neutral-500">
              Simulación local · no se envían datos ni se conecta a una base de datos.
            </p>
          </article>

          <article aria-live="polite" className="rounded-[1.75rem] border border-white/10 bg-[#121212]/85 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Seguimiento del pedido</p>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#F4F1EA]">Una comanda, todo el equipo conectado</h3>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-500 ${isDelivered ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                <span className={`h-2 w-2 rounded-full ${isDelivered ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`} />
                {currentStage.label}
              </span>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 sm:p-6">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
                <span>MESERO</span>
                <span>COCINA</span>
                <span>MESA 08</span>
              </div>
              <div className="relative my-7">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-600 transition-[width] duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div
                  className="absolute -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-[#171717] bg-amber-500 text-neutral-950 shadow-[0_0_16px_rgba(245,158,11,0.4)] transition-[left] duration-700 ease-out"
                  style={{ left: `calc(${progress}% - 14px)` }}
                >
                  <CurrentIcon className="h-3 w-3" />
                </div>
              </div>

              <div key={stage} className="order-stage-enter rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
                    <CurrentIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#F4F1EA]">{currentStage.label}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">{currentStage.detail}</p>
                  </div>
                  {stage > 0 && <span className="ml-auto shrink-0 text-[11px] font-medium text-amber-300">Ahora</span>}
                </div>
              </div>

              <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {orderStages.slice(1).map((item, index) => {
                  const stepNumber = index + 1;
                  const isComplete = stage >= stepNumber;
                  const isCurrent = stage === stepNumber;
                  const StepIcon = item.icon;

                  return (
                    <li
                      key={item.label}
                      className={`flex min-h-[3.75rem] items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all duration-500 ${isCurrent ? 'scale-[1.02] border-amber-500/40 bg-amber-500/10 text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.1)]' : isComplete ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200' : 'border-white/5 bg-white/[0.03] text-neutral-500'}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isComplete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-neutral-500'}`}>
                        {isComplete ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                      </span>
                      <span className="font-semibold leading-4">{item.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
                <ChefHat className="h-4 w-4" />
              </span>
              <p className="text-xs leading-5 text-neutral-400">
                <span className="font-semibold text-amber-200">Vista de cocina:</span> la comanda aparece con sus productos y cambia de estado al avanzar la simulación.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
