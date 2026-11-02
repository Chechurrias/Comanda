import { deviceStorage } from './storage';

let inMemoryUser: any = null;

export const authSession = {
  // Guarda toda la información devuelta por login_waiter o Supabase Auth
  saveUser: async (userData: any) => {
    inMemoryUser = userData;
    try {
      await deviceStorage.set('auth_user_session', JSON.stringify(userData));
    } catch (e) {
      console.warn('[AuthSession] Error guardando sesión:', e);
    }
  },

  // Recupera el usuario con su tenant_id garantizado
  getUser: async () => {
    if (inMemoryUser && inMemoryUser.tenant_id) {
      return inMemoryUser;
    }
    try {
      const raw = await deviceStorage.get('auth_user_session');
      if (raw) {
        inMemoryUser = JSON.parse(raw);
        return inMemoryUser;
      }
    } catch (e) {
      console.warn('[AuthSession] Error leyendo sesión:', e);
    }
    return null;
  },

  // Cierra la sesión
  clear: async () => {
    inMemoryUser = null;
    try {
      await deviceStorage.remove('auth_user_session');
    } catch (e) {
      console.warn('[AuthSession] Error limpiando sesión:', e);
    }
  },
};