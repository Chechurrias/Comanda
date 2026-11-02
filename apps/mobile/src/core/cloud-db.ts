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

  addTable: async (tenantId: string, identifier: string, zone: string) => {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .insert({ tenant_id: tenantId, identifier, zone, status: 'available' })
      .select()
      .single();
    if (error) throw error;
    return data;
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

  // --- PEDIDOS Y COMANDAS ---
  getActiveOrder: async (tenantId: string, tableId: string) => {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('table_id', tableId)
      .in('status', ['open', 'billing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!order) return null;

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsErr) throw itemsErr;
    return { ...order, items: items || [] };
  },

  sendOrder: async (
    tenantId: string,
    tableId: string,
    staffId: string,
    waiterName: string,
    activeOrderId: string | null,
    itemsToAdd: Array<{ id: string; name: string; price: number; quantity: number }>
  ) => {
    let orderId = activeOrderId;
    const addedTotal = itemsToAdd.reduce((acc, i) => acc + (i.price * i.quantity), 0);

    // 1. Si no hay orden abierta, crearla
    if (!orderId) {
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenantId,
          table_id: tableId,
          staff_id: staffId,
          waiter_name: waiterName,
          status: 'open',
          total: addedTotal
        })
        .select()
        .single();

      if (orderErr) throw orderErr;
      orderId = newOrder.id;
    } else {
      // 2. Si ya existe, incrementar total
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('total')
        .eq('id', orderId)
        .single();

      const newTotal = Number(currentOrder?.total || 0) + addedTotal;
      await supabase
        .from('orders')
        .update({ total: newTotal })
        .eq('id', orderId);
    }

    // 3. Insertar los ítems
    const itemsPayload = itemsToAdd.map(item => ({
      tenant_id: tenantId,
      order_id: orderId,
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    // 4. Marcar mesa como ocupada
    await supabase
      .from('restaurant_tables')
      .update({ status: 'occupied' })
      .eq('id', tableId);

    return orderId;
  },

  requestTableBill: async (tableId: string) => {
    await supabase
      .from('restaurant_tables')
      .update({ status: 'billing' })
      .eq('id', tableId);

    await supabase
      .from('orders')
      .update({ status: 'billing' })
      .eq('table_id', tableId)
      .eq('status', 'open');
  },


  payAndReleaseTable: async (orderId: string, tableId: string, paymentMethod: string) => {
    // Cerrar orden con medio de pago y fecha
    await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_method: paymentMethod,
        closed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    // Liberar mesa a disponible
    await supabase
      .from('restaurant_tables')
      .update({ status: 'available' })
      .eq('id', tableId);
      
  }, 



  // --- GESTIÓN DE PERSONAL (SOLO ADMIN / CAJA) ---
  getStaff: async (tenantId: string) => {
    const { data, error } = await supabase
      .from('restaurant_staff')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_active', { ascending: false })
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  createWaiter: async (
    tenantId: string,
    fullName: string,
    pinCode: string,
    role: 'waiter_basic' | 'waiter_advanced'
  ) => {
    const { data, error } = await supabase
      .from('restaurant_staff')
      .insert({
        tenant_id: tenantId,
        full_name: fullName.trim(),
        role,
        pin_code: pinCode.trim(),
        is_active: true, // Nace activo
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe un mesero con el nombre "${fullName}" o con ese PIN en este restaurante.`);
      }
      throw error;
    }
    return data;
  },

  toggleStaffStatus: async (staffId: string, nextStatus: boolean) => {
    const { error } = await supabase
      .from('restaurant_staff')
      .update({ is_active: nextStatus })
      .eq('id', staffId);
    if (error) throw error;
  },

  updateStaffRole: async (staffId: string, role: 'waiter_basic' | 'waiter_advanced') => {
    const { error } = await supabase
      .from('restaurant_staff')
      .update({ role })
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