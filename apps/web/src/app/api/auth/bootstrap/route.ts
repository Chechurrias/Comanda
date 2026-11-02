import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const expected = process.env.CONSOLE_BOOTSTRAP_SECRET;
  const { bootstrapSecret } = await request.json().catch(() => ({}));
  if (!expected || typeof bootstrapSecret !== 'string' || !constantTimeEqual(expected, bootstrapSecret)) {
    return NextResponse.json({ error: 'Clave de inicialización incorrecta.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.CONSOLE_OWNER_EMAIL?.trim().toLowerCase();
  if (!url || !serviceKey || !email) {
    return NextResponse.json({ error: 'Configura URL, service role y correo maestro en el servidor.' }, { status: 500 });
  }

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: claimed, error: claimError } = await service.rpc('claim_console_bootstrap');
  if (claimError) {
    return NextResponse.json({ error: 'Aplica primero la migración de operadores.' }, { status: 503 });
  }
  if (!claimed) {
    return NextResponse.json({ error: 'El bootstrap ya fue usado o está en proceso.' }, { status: 409 });
  }

  const { count, error: countError } = await service
    .from('platform_operators')
    .select('user_id', { count: 'exact', head: true });
  if (countError) {
    await service.rpc('release_console_bootstrap');
    return NextResponse.json({ error: 'No se pudo comprobar el estado de inicialización.' }, { status: 500 });
  }
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'La consola ya fue inicializada.' }, { status: 409 });

  const password = randomBytes(30).toString('base64url');
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Operador maestro', must_change_password: true },
  });
  if (createError || !created.user) {
    await service.rpc('release_console_bootstrap');
    return NextResponse.json({ error: createError?.message ?? 'No se pudo crear la cuenta.' }, { status: 400 });
  }

  const { error: roleError } = await service.from('platform_operators').insert({
    user_id: created.user.id,
    email,
    full_name: 'Operador maestro',
    role: 'owner',
    is_active: true,
  });
  if (roleError) {
    await service.auth.admin.deleteUser(created.user.id);
    await service.rpc('release_console_bootstrap');
    return NextResponse.json({ error: 'No se pudo asignar el rol maestro; la cuenta se revirtió.' }, { status: 500 });
  }

  return NextResponse.json({
    email,
    password,
    message: 'Cuenta maestra creada. La contraseña se muestra solo en esta respuesta.',
  }, { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
}
