import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'comanda-console-access';
const REFRESH_COOKIE = 'comanda-console-refresh';
const PUBLIC_PATHS = new Set(['/', '/login', '/setup']);
const PUBLIC_API_PREFIXES = ['/api/auth/session', '/api/auth/bootstrap'];

function redirectToLogin(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PREFIXES.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'La autenticación de consola no está configurada.' }, { status: 503 });
  }

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!accessToken) return redirectToLogin(request);

  const verifyUser = (token: string) => fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  let userResponse = await verifyUser(accessToken);
  let refreshedTokens: { access_token: string; refresh_token: string } | null = null;

  if (!userResponse.ok && refreshToken) {
    const refreshResponse = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (refreshResponse.ok) {
      refreshedTokens = await refreshResponse.json();
      accessToken = refreshedTokens?.access_token ?? '';
      userResponse = await verifyUser(accessToken);
    }
  }

  if (!userResponse.ok || !accessToken) return redirectToLogin(request);
  const user = await userResponse.json();

  if (user.user_metadata?.must_change_password && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // Verifica el rol en Postgres usando el JWT del operador y RLS, nunca los
  // metadatos editables del perfil de Auth.
  const operatorResponse = await fetch(
    `${url}/rest/v1/platform_operators?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
  );
  if (!operatorResponse.ok) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
      : NextResponse.redirect(new URL('/login?error=operator', request.url));
  }
  const operators = await operatorResponse.json();
  if (!Array.isArray(operators) || operators.length !== 1) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
      : NextResponse.redirect(new URL('/login?error=operator', request.url));
  }

  const response = NextResponse.next();
  if (refreshedTokens) {
    const secure = process.env.NODE_ENV === 'production';
    response.cookies.set(ACCESS_COOKIE, refreshedTokens.access_token, {
      httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 60 * 60,
    });
    response.cookies.set(REFRESH_COOKIE, refreshedTokens.refresh_token, {
      httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
