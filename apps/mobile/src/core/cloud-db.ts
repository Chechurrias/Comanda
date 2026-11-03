import { supabase } from './api/supabase';

export const cloudDbService = {
  // --- MESAS ---
  getTables: async (tenantId: string) => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('identifier', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  getWaiterTables: async (sessionToken: string) => {
    const { data, error } = await supabase.rpc('waiter_get_tables', {
      p_session_token: sessionToken,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  addTable: async (tenantId: string, identifier: string, zone: string) => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .insert({ tenant_id: tenantId, identifier, zone, status: 'available' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getMenu: async (tenantId: string) => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*, menu_categories(name)')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      category: item.menu_categories?.name || 'General',
    }));
  },

  deleteTable: async (tableId: string) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', tableId);
    if (error) throw error;
  },

  // --- MENÚ ---
  getAvailableMenu: async (tenantId: string) => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*, menu_categories(name)')
      .eq('tenant_id', tenantId)
      .eq('is_available', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      category: item.menu_categories?.name || 'General'
    }));
  },

  getWaiterMenu: async (sessionToken: string) => {
    const { data, error } = await supabase.rpc('waiter_get_menu', {
      p_session_token: sessionToken,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  addMenuItem: async (tenantId: string, name: string, price: number, categoryName: string) => {
    const normalizedCategory = categoryName.trim();
    const { data: existingCategory, error: categoryLookupError } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', normalizedCategory)
      .maybeSingle();

    if (categoryLookupError) throw categoryLookupError;

    let categoryId = existingCategory?.id;
    if (!categoryId) {
      const { data: newCategory, error: categoryInsertError } = await supabase
        .from('menu_categories')
        .insert({ tenant_id: tenantId, name: normalizedCategory })
        .select('id')
        .single();

      if (categoryInsertError) throw categoryInsertError;
      categoryId = newCategory.id;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        tenant_id: tenantId,
        category_id: categoryId,
        name: name.trim(),
        price,
        is_available: true,
      })
      .select('*, menu_categories(name)')
      .single();
    if (error) throw error;

    return {
      ...data,
      category: data.menu_categories?.name || normalizedCategory,
    };
  },

  toggleMenuItem: async (itemId: string, isAvailable: boolean) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: isAvailable })
      .eq('id', itemId);
    if (error) throw error;
  },

  deleteMenuItem: async (itemId: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  },

  // --- PEDIDOS Y COMANDAS ---
  getActiveOrder: async (tenantId: string, tableId: string, waiterSessionToken?: string) => {
    const { data, error } = await supabase.rpc('get_active_order', {
      p_tenant_id: tenantId,
      p_table_id: tableId,
      p_waiter_session: waiterSessionToken ?? null,
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') return null;
    const result = data as { order?: Record<string, unknown>; items?: unknown[] };
    return result.order ? { ...result.order, items: result.items || [] } : null;
  },

  sendOrder: async (
    tenantId: string,
    tableId: string,
    activeOrderId: string | null,
    itemsToAdd: { id: string; quantity: number }[],
    requestId: string,
    waiterSessionToken?: string
  ) => {
    const { data, error } = await supabase.rpc('send_order', {
      p_tenant_id: tenantId,
      p_table_id: tableId,
      p_active_order_id: activeOrderId,
      p_items: itemsToAdd,
      p_request_id: requestId,
      p_waiter_session: waiterSessionToken ?? null,
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('El servidor no devolvió el pedido creado.');
    return data;
  },

  requestTableBill: async (tenantId: string, tableId: string, waiterSessionToken?: string) => {
    const { error } = await supabase.rpc('request_table_bill', {
      p_tenant_id: tenantId,
      p_table_id: tableId,
      p_waiter_session: waiterSessionToken ?? null,
    });
    if (error) throw error;
  },


  payAndReleaseTable: async (
    tenantId: string,
    orderId: string,
    tableId: string,
    paymentMethod: string
  ) => {
    const { data, error } = await supabase.rpc('pay_and_release_table', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_table_id: tableId,
      p_payment_method: paymentMethod,
    });
    if (error) throw error;
    if (typeof data !== 'number') throw new Error('El servidor no devolvió el total cobrado.');
    return data;
  },

  getDailySalesReport: async (tenantId: string, day: string) => {
    const { data, error } = await supabase.rpc('get_daily_sales_report', {
      p_tenant_id: tenantId,
      p_day: day,
    });
    if (error) throw error;
    return data;
  },



  // --- GESTIÓN DE PERSONAL (SOLO ADMIN / CAJA) ---
  getStaff: async (tenantId: string) => {
    const { data, error } = await supabase
      .from('restaurant_staff')
      .select('id, tenant_id, full_name, role, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('is_active', { ascending: false })
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  createWaiter: async (
    tenantId: string,
    fullName: string,
    pinCode: string
  ) => {
    const { data, error } = await supabase.rpc('admin_create_waiter', {
      p_tenant_id: tenantId,
      p_full_name: fullName.trim(),
      p_pin: pinCode.trim(),
    });

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe un mesero con el nombre "${fullName}" en este restaurante.`);
      }
      throw error;
    }
    return data;
  },

  resetWaiterPin: async (tenantId: string, staffId: string, pinCode: string) => {
    const { error } = await supabase.rpc('admin_reset_waiter_pin', {
      p_tenant_id: tenantId,
      p_staff_id: staffId,
      p_pin: pinCode.trim(),
    });
    if (error) throw error;
  },

  toggleStaffStatus: async (staffId: string, nextStatus: boolean) => {
    const { error } = await supabase
      .from('restaurant_staff')
      .update({ is_active: nextStatus })
      .eq('id', staffId);
    if (error) throw error;
  },

  deleteStaff: async (staffId: string) => {
    const { error } = await supabase
      .from('restaurant_staff')
      .delete()
      .eq('id', staffId);
    if (error) throw error;
  },
};