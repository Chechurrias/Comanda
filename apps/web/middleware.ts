import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo proteger las páginas privadas de administración
  const isProtectedAdminRoute = pathname.startsWith('/tenants') || pathname.startsWith('/activations');

  if (isProtectedAdminRoute) {
    // Verificar si el operador tiene cookie de sesión en Supabase
    const hasAuthCookie = request.cookies.getAll().some(cookie => cookie.name.includes('-auth-token'));

    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configuración estricta: Solo interceptar tenants y activations
export const config = {
  matcher: ['/tenants/:path*', '/activations/:path*'],
};