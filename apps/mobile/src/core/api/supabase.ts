import { createClient } from '@supabase/supabase-js';
import { deviceStorage } from '../storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
    storage: {
      getItem: deviceStorage.get,
      setItem: deviceStorage.set,
      removeItem: deviceStorage.remove,
    },
  },
});