// Reemplaza la línea 1:
// import { Sidebar } from '@/components/layout/Sidebar';

// Por esta ruta relativa:
import React from 'react';
import { Sidebar } from '../../components/layout/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-900/40 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}