alter table public.orders
  add column if not exists table_identifier text;

update public.orders order_row
set table_identifier = table_row.identifier
from public.restaurant_tables table_row
where table_row.id = order_row.table_id
  and table_row.tenant_id = order_row.tenant_id
  and order_row.table_identifier is null;

alter table public.orders
  alter column table_id drop not null;

create or replace function public.delete_restaurant_table(
  p_tenant_id uuid,
  p_table_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table public.restaurant_tables%rowtype;
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  select * into v_table
  from public.restaurant_tables
  where id = p_table_id
    and tenant_id = p_tenant_id
    and status = 'available'
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'Only available tables can be deleted.';
  end if;

  if exists (
    select 1
    from public.orders
    where tenant_id = p_tenant_id
      and table_id = p_table_id
      and status in ('open', 'billing')
  ) then
    raise exception using errcode = '55000', message = 'The table has an active order and cannot be deleted.';
  end if;

  update public.orders
  set table_identifier = coalesce(table_identifier, v_table.identifier),
      table_id = null
  where tenant_id = p_tenant_id
    and table_id = p_table_id;

  delete from public.restaurant_tables
  where id = p_table_id and tenant_id = p_tenant_id;
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
        'table_name', coalesce(table_row.identifier, order_row.table_identifier, 'Mesa'),
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
