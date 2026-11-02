import { createClient } from '@supabase/supabase-js';

// Usar tu URL de Supabase directa como respaldo para evitar error en el compilador
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gvczlbhwjveftevvfcbf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getConsoleAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

