import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ACCESS_COOKIE = 'comanda-console-access';
const REFRESH_COOKIE = 'comanda-console-refresh';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  }
  const { accessToken, refreshToken } = await request.json().catch(() => ({}));
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    return NextResponse.json({ error: 'Sesión incompleta.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Falta configurar Supabase.' }, { status: 500 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: 'La sesión no es válida.' }, { status: 401 });
  }

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: operator } = await service
    .from('platform_operators')
    .select('user_id')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!operator) {
    return NextResponse.json({ error: 'Cuenta sin autorización de consola.' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 60 * 60,
  });
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
