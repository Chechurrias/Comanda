import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeConsoleRequest } from '@/lib/console-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await authorizeConsoleRequest(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.operator.role !== 'owner') return NextResponse.json({ error: 'Solo el propietario puede administrar operadores.' }, { status: 403 });

  const { data, error } = await auth.serviceClient
    .from('platform_operators')
    .select('user_id, email, full_name, role, is_active, created_at')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'No se pudo cargar la lista de operadores.' }, { status: 500 });
  return NextResponse.json({ operators: data }, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeConsoleRequest(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.operator.role !== 'owner') return NextResponse.json({ error: 'Solo el propietario puede crear operadores.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 120) {
    return NextResponse.json({ error: 'Ingresa un nombre y un correo válidos.' }, { status: 400 });
  }

  const password = randomBytes(30).toString('base64url');
  const { data: created, error: createError } = await auth.serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'No se pudo crear la cuenta.' }, { status: 400 });
  }

  const { error: operatorError } = await auth.serviceClient.from('platform_operators').insert({
    user_id: created.user.id,
    email,
    full_name: fullName,
    role: 'operator',
    is_active: true,
    created_by: auth.user.id,
  });
  if (operatorError) {
    await auth.serviceClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: 'No se pudo asignar el rol; la cuenta se revirtió.' }, { status: 500 });
  }

  return NextResponse.json(
    { email, password, message: 'Cuenta creada; entrega esta contraseña por un canal seguro.' },
    { status: 201, headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeConsoleRequest(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.operator.role !== 'owner') return NextResponse.json({ error: 'Solo el propietario puede cambiar operadores.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.userId !== 'string' || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  if (body.userId === auth.user.id && body.isActive === false) {
    return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta.' }, { status: 400 });
  }

  const { data: updated, error } = await auth.serviceClient
    .from('platform_operators')
    .update({ is_active: body.isActive })
    .eq('user_id', body.userId)
    .neq('role', 'owner')
    .select('user_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'No se pudo actualizar el operador.' }, { status: 400 });
  if (!updated) return NextResponse.json({ error: 'No se encontró una cuenta de operador modificable.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
