create extension if not exists pgcrypto;

alter table public.restaurant_staff
  add column if not exists pin_hash text;

update public.restaurant_staff
set pin_hash = crypt(pin_code, gen_salt('bf')),
    pin_code = '****-' || id::text
where pin_hash is null;

do $$
begin
  if exists (
    select 1
    from public.restaurant_tables
    group by tenant_id, lower(btrim(identifier))
    having count(*) > 1
  ) then
    raise exception 'Duplicate normalized table identifiers exist within a tenant; resolve them before applying this migration.';
  end if;

  if exists (
    select 1
    from public.restaurant_staff
    where role = 'waiter_basic'
    group by tenant_id, lower(btrim(full_name))
    having count(*) > 1
  ) then
    raise exception 'Duplicate waiter names exist within a tenant; resolve them before applying this migration.';
  end if;

  if exists (
    select 1
    from public.orders
    where status in ('open', 'billing')
    group by tenant_id, table_id
    having count(*) > 1
  ) then
    raise exception 'Tables with multiple active orders exist; resolve them before applying this migration.';
  end if;
end;
$$;

create unique index if not exists restaurant_tables_tenant_identifier_normalized_uq
  on public.restaurant_tables (tenant_id, lower(btrim(identifier)));

create unique index if not exists restaurant_staff_tenant_waiter_name_normalized_uq
  on public.restaurant_staff (tenant_id, lower(btrim(full_name)))
  where role = 'waiter_basic';

create unique index if not exists orders_one_active_per_table_uq
  on public.orders (tenant_id, table_id)
  where status in ('open', 'billing');

create index if not exists orders_paid_tenant_closed_at_idx
  on public.orders (tenant_id, closed_at)
  where status = 'paid';

create table if not exists public.waiter_sessions (
  token_hash bytea primary key,
  staff_id uuid not null references public.restaurant_staff(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists waiter_sessions_expiry_idx
  on public.waiter_sessions (expires_at);

create table if not exists public.waiter_login_attempts (
  staff_id uuid primary key references public.restaurant_staff(id) on delete cascade,
  failed_count smallint not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.order_submissions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, request_id)
);

create or replace function public.admin_create_waiter(
  p_tenant_id uuid,
  p_full_name text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff public.restaurant_staff%rowtype;
  v_staff_id uuid := gen_random_uuid();
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' or coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'Waiter name or PIN is invalid.';
  end if;

  insert into public.restaurant_staff (
    id, tenant_id, full_name, role, pin_code, pin_hash, is_active
  )
  values (
    v_staff_id, p_tenant_id, btrim(p_full_name), 'waiter_basic', '****-' || v_staff_id::text,
    crypt(p_pin, gen_salt('bf')), true
  )
  returning * into v_staff;

  return jsonb_build_object(
    'id', v_staff.id,
    'tenant_id', v_staff.tenant_id,
    'full_name', v_staff.full_name,
    'role', v_staff.role,
    'is_active', v_staff.is_active,
    'created_at', v_staff.created_at
  );
end;
$$;

alter table public.waiter_sessions enable row level security;
alter table public.waiter_login_attempts enable row level security;
alter table public.order_submissions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.waiter_sessions, public.waiter_login_attempts,
  public.order_submissions, public.orders, public.order_items
  from public, anon, authenticated;

revoke insert, update, select on public.restaurant_staff from anon, authenticated;
grant select (id, tenant_id, full_name, role, is_active, created_at)
  on public.restaurant_staff to authenticated;
grant update (is_active) on public.restaurant_staff to authenticated;

create or replace function public.resolve_restaurant_actor(
  p_tenant_id uuid default null,
  p_waiter_session text default null
)
returns table (staff_id uuid, full_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_tenant_id is null and p_waiter_session is null then
    raise exception using errcode = '22023', message = 'A restaurant or waiter session is required.';
  end if;

  if p_waiter_session is not null then
    return query
      select staff.id, staff.full_name
      from public.waiter_sessions waiter_session
      join public.restaurant_staff staff
        on staff.id = waiter_session.staff_id
       and staff.tenant_id = waiter_session.tenant_id
      join public.tenants tenant on tenant.id = waiter_session.tenant_id
      where waiter_session.token_hash = digest(p_waiter_session, 'sha256')
        and (p_tenant_id is null or waiter_session.tenant_id = p_tenant_id)
        and waiter_session.expires_at > now()
        and staff.role = 'waiter_basic'
        and staff.is_active
        and tenant.status = 'active';

    if not found then
      raise exception using errcode = '28000', message = 'Waiter session is invalid or expired.';
    end if;
    return;
  end if;

  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  return query
    select staff.id, staff.full_name
    from public.restaurant_staff staff
    where staff.tenant_id = p_tenant_id
      and staff.auth_user_id = auth.uid()
      and staff.role = 'restaurant_admin'
      and staff.is_active;
end;
$$;

drop function if exists public.login_waiter(text, text, text);

create function public.login_waiter(
  p_restaurant_identifier text,
  p_waiter_name text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_staff public.restaurant_staff%rowtype;
  v_failed smallint;
  v_locked_until timestamptz;
  v_session_token text;
begin
  delete from public.waiter_sessions where expires_at <= now();

  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    return jsonb_build_object('success', false, 'error', 'Credenciales inválidas.');
  end if;

  select tenant.id into v_tenant_id
  from public.tenants tenant
  where lower(tenant.slug) = lower(btrim(p_restaurant_identifier))
    and tenant.status = 'active';

  if v_tenant_id is null then
    return jsonb_build_object('success', false, 'error', 'Credenciales inválidas.');
  end if;

  select staff.* into v_staff
  from public.restaurant_staff staff
  where staff.tenant_id = v_tenant_id
    and staff.role = 'waiter_basic'
    and lower(btrim(staff.full_name)) = lower(btrim(p_waiter_name))
  limit 1;

  if not found or not v_staff.is_active then
    return jsonb_build_object('success', false, 'error', 'Credenciales inválidas.');
  end if;

  insert into public.waiter_login_attempts (staff_id)
  values (v_staff.id)
  on conflict (staff_id) do nothing;

  select attempts.failed_count, attempts.locked_until
    into v_failed, v_locked_until
  from public.waiter_login_attempts attempts
  where attempts.staff_id = v_staff.id
  for update;

  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object('success', false, 'error', 'Credenciales inválidas.');
  end if;

  if v_staff.pin_hash is null or crypt(p_pin, v_staff.pin_hash) <> v_staff.pin_hash then
    v_failed := coalesce(v_failed, 0) + 1;
    update public.waiter_login_attempts
    set failed_count = v_failed,
        locked_until = case when v_failed >= 5 then now() + interval '15 minutes' else null end,
        updated_at = now()
    where staff_id = v_staff.id;
    return jsonb_build_object('success', false, 'error', 'Credenciales inválidas.');
  end if;

  update public.waiter_login_attempts
  set failed_count = 0, locked_until = null, updated_at = now()
  where staff_id = v_staff.id;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  insert into public.waiter_sessions (token_hash, staff_id, tenant_id, expires_at)
  values (
    digest(v_session_token, 'sha256'),
    v_staff.id,
    v_tenant_id,
    now() + interval '12 hours'
  );

  return jsonb_build_object(
    'success', true,
    'session_token', v_session_token,
    'tenant_id', v_tenant_id,
    'restaurant_name', (select name from public.tenants where id = v_tenant_id),
    'staff_id', v_staff.id,
    'full_name', v_staff.full_name,
    'role', 'waiter_basic'
  );
end;
$$;

create or replace function public.waiter_get_tables(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_tables jsonb;
begin
  select * into v_actor
  from public.resolve_restaurant_actor(null, p_session_token);

  select coalesce(jsonb_agg(to_jsonb(t) order by t.identifier), '[]'::jsonb)
    into v_tables
  from public.restaurant_tables t
  join public.restaurant_staff staff on staff.tenant_id = t.tenant_id
  where staff.id = v_actor.staff_id;

  return v_tables;
end;
$$;

create or replace function public.waiter_get_menu(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_menu jsonb;
begin
  select * into v_actor
  from public.resolve_restaurant_actor(null, p_session_token);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'tenant_id', item.tenant_id,
        'category_id', item.category_id,
        'name', item.name,
        'price', item.price,
        'is_available', item.is_available,
        'created_at', item.created_at,
        'category', coalesce(category.name, 'General')
      )
      order by item.name
    ),
    '[]'::jsonb
  )
  into v_menu
  from public.menu_items item
  join public.restaurant_staff staff on staff.tenant_id = item.tenant_id
  left join public.menu_categories category
    on category.id = item.category_id
   and category.tenant_id = item.tenant_id
  where staff.id = v_actor.staff_id
    and item.is_available;

  return v_menu;
end;
$$;

create or replace function public.get_active_order(
  p_tenant_id uuid,
  p_table_id uuid,
  p_waiter_session text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_order public.orders%rowtype;
  v_items jsonb;
begin
  select * into v_actor
  from public.resolve_restaurant_actor(p_tenant_id, p_waiter_session);

  if not exists (
    select 1 from public.restaurant_tables
    where id = p_table_id and tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '22023', message = 'Table does not belong to this restaurant.';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id
    and table_id = p_table_id
    and status in ('open', 'billing')
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at), '[]'::jsonb)
    into v_items
  from public.order_items item
  where item.tenant_id = p_tenant_id
    and item.order_id = v_order.id;

  return jsonb_build_object('order', to_jsonb(v_order), 'items', v_items);
end;
$$;

create or replace function public.send_order(
  p_tenant_id uuid,
  p_table_id uuid,
  p_active_order_id uuid,
  p_items jsonb,
  p_request_id uuid,
  p_waiter_session text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_table public.restaurant_tables%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_menu_item public.menu_items%rowtype;
  v_quantity integer;
begin
  select * into v_actor
  from public.resolve_restaurant_actor(p_tenant_id, p_waiter_session);

  if p_request_id is null
     or coalesce(jsonb_typeof(p_items), '') <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'Order request is invalid.';
  end if;

  select * into v_table
  from public.restaurant_tables
  where id = p_table_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Table does not belong to this restaurant.';
  end if;

  select submission.order_id into v_order_id
  from public.order_submissions submission
  where submission.tenant_id = p_tenant_id
    and submission.request_id = p_request_id;

  if found then
    return v_order_id;
  end if;

  if p_active_order_id is null then
    select order_row.id into v_order_id
    from public.orders order_row
    where order_row.tenant_id = p_tenant_id
      and order_row.table_id = p_table_id
      and order_row.status = 'open'
    for update;

    if not found then
      insert into public.orders (
        tenant_id, table_id, staff_id, waiter_name, status, total
      )
      values (
        p_tenant_id, p_table_id, v_actor.staff_id, v_actor.full_name, 'open', 0
      )
      returning id into v_order_id;
    end if;
  else
    select order_row.id into v_order_id
    from public.orders order_row
    where order_row.id = p_active_order_id
      and order_row.tenant_id = p_tenant_id
      and order_row.table_id = p_table_id
      and order_row.status = 'open'
    for update;

    if not found then
      raise exception using errcode = '22023', message = 'The active order is not open for this table.';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'quantity', '') !~ '^[1-9][0-9]*$'
       or coalesce(v_item->>'id', '') = '' then
      raise exception using errcode = '22023', message = 'An order item is invalid.';
    end if;

    v_quantity := (v_item->>'quantity')::integer;
    select item.* into v_menu_item
    from public.menu_items item
    where item.id = (v_item->>'id')::uuid
      and item.tenant_id = p_tenant_id
      and item.is_available;

    if not found then
      raise exception using errcode = '22023', message = 'A menu item is unavailable or belongs to another restaurant.';
    end if;

    insert into public.order_items (
      tenant_id, order_id, menu_item_id, name, unit_price, quantity, subtotal
    )
    values (
      p_tenant_id,
      v_order_id,
      v_menu_item.id,
      v_menu_item.name,
      v_menu_item.price,
      v_quantity,
      v_menu_item.price * v_quantity
    );
  end loop;

  update public.orders
  set total = (
    select coalesce(sum(item.subtotal), 0)
    from public.order_items item
    where item.tenant_id = p_tenant_id
      and item.order_id = v_order_id
  )
  where id = v_order_id and tenant_id = p_tenant_id;

  update public.restaurant_tables
  set status = 'occupied'
  where id = p_table_id and tenant_id = p_tenant_id;

  insert into public.order_submissions (tenant_id, request_id, order_id)
  values (p_tenant_id, p_request_id, v_order_id);

  return v_order_id;
end;
$$;

create or replace function public.request_table_bill(
  p_tenant_id uuid,
  p_table_id uuid,
  p_waiter_session text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_order_id uuid;
begin
  select * into v_actor
  from public.resolve_restaurant_actor(p_tenant_id, p_waiter_session);

  perform 1
  from public.restaurant_tables
  where id = p_table_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Table does not belong to this restaurant.';
  end if;

  select id into v_order_id
  from public.orders
  where tenant_id = p_tenant_id
    and table_id = p_table_id
    and status in ('open', 'billing')
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'There is no active order for this table.';
  end if;

  update public.orders set status = 'billing' where id = v_order_id;
  update public.restaurant_tables set status = 'billing' where id = p_table_id;
end;
$$;

create or replace function public.pay_and_release_table(
  p_tenant_id uuid,
  p_order_id uuid,
  p_table_id uuid,
  p_payment_method text
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_total numeric;
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  if p_payment_method is null
     or p_payment_method not in ('Efectivo', 'Tarjeta Débito/Crédito', 'Nequi / Transferencia') then
    raise exception using errcode = '22023', message = 'Payment method is not supported.';
  end if;

  perform 1
  from public.restaurant_tables
  where id = p_table_id and tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Table does not belong to this restaurant.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and tenant_id = p_tenant_id
    and table_id = p_table_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Order does not belong to this table.';
  end if;

  if v_order.status = 'paid' then
    if v_order.payment_method <> p_payment_method then
      raise exception using errcode = '22023', message = 'Order was already paid with a different method.';
    end if;
    return v_order.total;
  end if;

  if v_order.status not in ('open', 'billing') then
    raise exception using errcode = '22023', message = 'Order cannot be paid in its current state.';
  end if;

  select coalesce(sum(item.subtotal), 0) into v_total
  from public.order_items item
  where item.tenant_id = p_tenant_id
    and item.order_id = p_order_id;

  update public.orders
  set status = 'paid',
      total = v_total,
      payment_method = p_payment_method,
      closed_at = now()
  where id = p_order_id and tenant_id = p_tenant_id;

  update public.restaurant_tables
  set status = 'available'
  where id = p_table_id and tenant_id = p_tenant_id;
  return v_total;
end;
$$;

create or replace function public.get_daily_sales_report(
  p_tenant_id uuid,
  p_day date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_summary jsonb;
  v_payment_methods jsonb;
  v_products jsonb;
  v_invoices jsonb;
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  select timezone into v_timezone from public.tenants where id = p_tenant_id;
  if v_timezone is null then
    raise exception using errcode = '22023', message = 'Restaurant does not exist.';
  end if;

  v_start := p_day::timestamp at time zone v_timezone;
  v_end := (p_day + 1)::timestamp at time zone v_timezone;

  select jsonb_build_object(
    'total_sales', coalesce(sum(order_row.total), 0),
    'orders_count', count(order_row.id),
    'average_ticket', coalesce(avg(order_row.total), 0)
  )
  into v_summary
  from public.orders order_row
  where order_row.tenant_id = p_tenant_id
    and order_row.status = 'paid'
    and order_row.closed_at >= v_start
    and order_row.closed_at < v_end;

  select coalesce(jsonb_agg(to_jsonb(payment_row)), '[]'::jsonb)
  into v_payment_methods
  from (
    select coalesce(order_row.payment_method, 'Sin especificar') as payment_method,
           count(*) as total_orders,
           sum(order_row.total) as total_amount
    from public.orders order_row
    where order_row.tenant_id = p_tenant_id
      and order_row.status = 'paid'
      and order_row.closed_at >= v_start
      and order_row.closed_at < v_end
    group by coalesce(order_row.payment_method, 'Sin especificar')
    order by payment_method
  ) payment_row;

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into v_products
  from (
    select item.name,
           sum(item.quantity)::bigint as total_qty,
           sum(item.subtotal) as total_revenue
    from public.order_items item
    join public.orders order_row
      on order_row.id = item.order_id
     and order_row.tenant_id = item.tenant_id
    where item.tenant_id = p_tenant_id
      and order_row.status = 'paid'
      and order_row.closed_at >= v_start
      and order_row.closed_at < v_end
    group by item.name
    order by total_revenue desc
  ) product_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', order_row.id,
        'table_name', coalesce(table_row.identifier, 'Mesa'),
        'payment_method', order_row.payment_method,
        'waiter_name', order_row.waiter_name,
        'closed_at', order_row.closed_at,
        'total', order_row.total,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', item.name,
            'quantity', item.quantity,
            'price', item.unit_price
          ) order by item.created_at)
          from public.order_items item
          where item.tenant_id = p_tenant_id
            and item.order_id = order_row.id
        ), '[]'::jsonb)
      )
      order by order_row.closed_at desc
    ),
    '[]'::jsonb
  )
  into v_invoices
  from public.orders order_row
  left join public.restaurant_tables table_row
    on table_row.id = order_row.table_id
   and table_row.tenant_id = order_row.tenant_id
  where order_row.tenant_id = p_tenant_id
    and order_row.status = 'paid'
    and order_row.closed_at >= v_start
    and order_row.closed_at < v_end;

  return jsonb_build_object(
    'summary', v_summary,
    'payment_methods', v_payment_methods,
    'products', v_products,
    'invoices', v_invoices
  );
end;
$$;

revoke all on function public.resolve_restaurant_actor(uuid, text) from public;
revoke all on function public.admin_create_waiter(uuid, text, text) from public;
revoke all on function public.login_waiter(text, text, text) from public;
revoke all on function public.waiter_get_tables(text) from public;
revoke all on function public.waiter_get_menu(text) from public;
revoke all on function public.get_active_order(uuid, uuid, text) from public;
revoke all on function public.send_order(uuid, uuid, uuid, jsonb, uuid, text) from public;
revoke all on function public.request_table_bill(uuid, uuid, text) from public;
revoke all on function public.pay_and_release_table(uuid, uuid, uuid, text) from public;
revoke all on function public.get_daily_sales_report(uuid, date) from public;

grant execute on function public.resolve_restaurant_actor(uuid, text) to anon, authenticated;
grant execute on function public.admin_create_waiter(uuid, text, text) to authenticated;
grant execute on function public.login_waiter(text, text, text) to anon, authenticated;
grant execute on function public.waiter_get_tables(text) to anon, authenticated;
grant execute on function public.waiter_get_menu(text) to anon, authenticated;
grant execute on function public.get_active_order(uuid, uuid, text) to anon, authenticated;
grant execute on function public.send_order(uuid, uuid, uuid, jsonb, uuid, text) to anon, authenticated;
grant execute on function public.request_table_bill(uuid, uuid, text) to anon, authenticated;
grant execute on function public.pay_and_release_table(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.get_daily_sales_report(uuid, date) to authenticated;
