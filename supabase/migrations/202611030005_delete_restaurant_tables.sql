drop trigger if exists orders_reject_archived_tables on public.orders;
drop function if exists public.prevent_orders_for_archived_tables();
drop function if exists public.archive_restaurant_table(uuid, uuid);

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

create or replace function public.waiter_get_tables(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_tables jsonb;
  v_tenant_id uuid;
begin
  select * into v_actor
  from public.resolve_restaurant_actor(null, p_session_token);

  select staff.tenant_id into v_tenant_id
  from public.restaurant_staff staff
  where staff.id = v_actor.staff_id;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.identifier), '[]'::jsonb)
    into v_tables
  from public.restaurant_tables t
  where t.tenant_id = v_tenant_id;

  return v_tables;
end;
$$;

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

revoke delete on public.restaurant_tables from authenticated;
revoke all on function public.delete_restaurant_table(uuid, uuid) from public, anon;
grant execute on function public.delete_restaurant_table(uuid, uuid) to authenticated;
