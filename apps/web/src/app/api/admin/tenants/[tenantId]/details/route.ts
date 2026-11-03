import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeConsoleRequest } from '@/lib/console-auth';

export const runtime = 'nodejs';

type TenantTable =
  | 'licenses'
  | 'restaurant_tables'
  | 'menu_categories'
  | 'menu_items'
  | 'restaurant_staff'
  | 'orders'
  | 'order_items';

interface LicenseRow {
  id: string;
  plan: string;
  max_devices: number;
  max_waiters: number;
  max_tables: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchTenantRows<T>(
  client: SupabaseClient,
  table: TenantTable,
  columns: string,
  tenantId: string,
): Promise<T[]> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + 999);

    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  const auth = await authorizeConsoleRequest(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { tenantId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
    return NextResponse.json({ error: 'Identificador de restaurante inválido.' }, { status: 400 });
  }

  const { data: tenant, error: tenantError } = await auth.serviceClient
    .from('tenants')
    .select('id, name, slug, status, timezone, currency, contact_email, contact_phone, created_at, updated_at, legal_name, trade_name, tax_id, logo_url')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) {
    console.error('[tenant-details] Tenant query failed:', tenantError.message);
    return NextResponse.json({ error: 'No se pudo consultar el restaurante.' }, { status: 500 });
  }
  if (!tenant) {
    return NextResponse.json({ error: 'No se encontró el restaurante.' }, { status: 404 });
  }

  try {
    const [licenses, tables, categories, menuItems, staff, orders, orderItems] = await Promise.all([
      fetchTenantRows<LicenseRow>(auth.serviceClient, 'licenses', 'id, plan, max_devices, max_waiters, max_tables, starts_at, expires_at, is_active, revoked_at, created_at, updated_at', tenantId),
      fetchTenantRows(auth.serviceClient, 'restaurant_tables', 'id, identifier, zone, status, created_at, is_archived', tenantId),
      fetchTenantRows(auth.serviceClient, 'menu_categories', 'id, name, sort_order, created_at', tenantId),
      fetchTenantRows(auth.serviceClient, 'menu_items', 'id, category_id, name, price, is_available, created_at', tenantId),
      fetchTenantRows(auth.serviceClient, 'restaurant_staff', 'id, full_name, role, is_active, created_at, email', tenantId),
      fetchTenantRows(auth.serviceClient, 'orders', 'id, table_id, table_identifier, staff_id, waiter_name, status, total, payment_method, created_at, closed_at', tenantId),
      fetchTenantRows(auth.serviceClient, 'order_items', 'id, order_id, menu_item_id, name, unit_price, quantity, subtotal, created_at', tenantId),
    ]);

    const planCodes = [...new Set(licenses.map(license => license.plan).filter(Boolean))];
    const { data: plans, error: plansError } = planCodes.length
      ? await auth.serviceClient.from('plans').select('code, name').in('code', planCodes)
      : { data: [], error: null };
    if (plansError) throw plansError;

    const planNames = new Map<string, string>();
    for (const plan of plans ?? []) planNames.set(plan.code, plan.name);
    const licensesWithNames = licenses.map(license => ({
      ...license,
      plan_name: planNames.get(license.plan) ?? license.plan,
    }));

    return NextResponse.json(
      { tenant, licenses: licensesWithNames, tables, categories, menuItems, staff, orders, orderItems },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error) {
    console.error('[tenant-details] Related data query failed:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar toda la información del restaurante. Verifica que el esquema de Supabase esté actualizado.' },
      { status: 500 },
    );
  }
}
