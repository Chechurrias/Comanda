import type { Metadata } from 'next';
import './globals.css';
import ClientWrapper from './ClientWrapper';

export const metadata: Metadata = {
  title: 'Comanda | Mesas, menú y pedidos en un solo lugar',
  description: 'Administra mesas, menú y meseros desde el teléfono administrador. Conecta los teléfonos del equipo por la red Wi-Fi del restaurante.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        <ClientWrapper>{children}</ClientWrapper>
      </body>
    </html>
  );
}
