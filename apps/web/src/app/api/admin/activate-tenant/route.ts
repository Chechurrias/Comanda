import { NextRequest, NextResponse } from 'next/server';
import { authorizeConsoleRequest } from '@/lib/console-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await authorizeConsoleRequest(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const { deviceId, name, email, pin, planCode, duration } = body;
  if (
    typeof deviceId !== 'string' ||
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof pin !== 'string' ||
    typeof planCode !== 'string' ||
    typeof duration !== 'string'
  ) {
    return NextResponse.json({ error: 'Faltan datos de activación.' }, { status: 400 });
  }

  const { data, error } = await auth.serviceClient.rpc('activate_restaurant', {
    p_device_id: deviceId,
    p_name: name.trim(),
    p_email: email.trim().toLowerCase(),
    p_pin: pin,
    p_plan_code: planCode,
    p_duration: duration,
  });

  if (error) {
    console.error('[activate-tenant] RPC failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const activation = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ activation }, { status: 201 });
}
