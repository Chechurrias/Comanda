import { createClient } from '@supabase/supabase-js';

export async function authorizeConsoleRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    return { error: 'No autenticado.', status: 401 as const };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return { error: 'Falta configurar Supabase en el servidor.', status: 500 as const };
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !userData.user) {
    return { error: 'La sesión no es válida.', status: 401 as const };
  }

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: operator, error: operatorError } = await serviceClient
    .from('platform_operators')
    .select('user_id, role, is_active')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (operatorError || !operator) {
    return { error: 'Esta cuenta no tiene acceso a la consola.', status: 403 as const };
  }

  return { user: userData.user, operator, serviceClient };
}
