import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4 text-center text-slate-100">
      <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
      <p className="text-slate-400 mb-6">Página no encontrada</p>
      <Link 
        href="/" 
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white transition-all"
      >
        Volver al Inicio
      </Link>
    </div>
  );
}