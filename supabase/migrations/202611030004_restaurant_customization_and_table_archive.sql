alter table public.restaurant_tables
  add column if not exists is_archived boolean not null default false;

alter table public.tenants
  add column if not exists logo_url text;

drop index if exists public.restaurant_tables_tenant_identifier_normalized_uq;

create unique index restaurant_tables_tenant_identifier_normalized_uq
  on public.restaurant_tables (tenant_id, lower(btrim(identifier)))
  where not is_archived;

create or replace function public.prevent_orders_for_archived_tables()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.restaurant_tables table_row
    where table_row.id = new.table_id
      and table_row.tenant_id = new.tenant_id
      and table_row.is_archived
  ) then
    raise exception using errcode = '55000', message = 'Archived tables cannot receive new orders.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_reject_archived_tables on public.orders;
create trigger orders_reject_archived_tables
  before insert or update of tenant_id, table_id on public.orders
  for each row execute function public.prevent_orders_for_archived_tables();

revoke delete on public.restaurant_tables from authenticated;

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
  where t.tenant_id = (
    select staff.tenant_id
    from public.restaurant_staff staff
    where staff.id = v_actor.staff_id
  )
    and not t.is_archived;

  return v_tables;
end;
$$;

create or replace function public.archive_restaurant_table(
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
  where id = p_table_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Table does not exist in this restaurant.';
  end if;

  if v_table.status <> 'available' or exists (
    select 1
    from public.orders order_row
    where order_row.tenant_id = p_tenant_id
      and order_row.table_id = p_table_id
      and order_row.status in ('open', 'billing')
  ) then
    raise exception using errcode = '55000', message = 'Only tables without active orders can be archived.';
  end if;

  update public.restaurant_tables
  set is_archived = true
  where id = p_table_id and tenant_id = p_tenant_id;
end;
$$;

create or replace function public.get_restaurant_profile(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  select jsonb_build_object(
    'id', tenant.id,
    'name', tenant.name,
    'logo_url', tenant.logo_url
  )
  into v_profile
  from public.tenants tenant
  where tenant.id = p_tenant_id;

  if v_profile is null then
    raise exception using errcode = 'P0002', message = 'Restaurant does not exist.';
  end if;
  return v_profile;
end;
$$;

create or replace function public.update_restaurant_profile(
  p_tenant_id uuid,
  p_name text,
  p_logo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  if btrim(coalesce(p_name, '')) = '' then
    raise exception using errcode = '22023', message = 'Restaurant name is required.';
  end if;

  update public.tenants
  set name = btrim(p_name),
      logo_url = nullif(btrim(coalesce(p_logo_url, '')), '')
  where id = p_tenant_id
  returning jsonb_build_object(
    'id', id,
    'name', name,
    'logo_url', logo_url
  ) into v_profile;

  if v_profile is null then
    raise exception using errcode = 'P0002', message = 'Restaurant does not exist.';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.archive_restaurant_table(uuid, uuid) from public, anon;
revoke all on function public.get_restaurant_profile(uuid) from public, anon;
revoke all on function public.update_restaurant_profile(uuid, text, text) from public, anon;

grant execute on function public.archive_restaurant_table(uuid, uuid) to authenticated;
grant execute on function public.get_restaurant_profile(uuid) to authenticated;
grant execute on function public.update_restaurant_profile(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists restaurant_logos_admin_insert on storage.objects;
create policy restaurant_logos_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_restaurant_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists restaurant_logos_admin_update on storage.objects;
create policy restaurant_logos_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_restaurant_admin(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_restaurant_admin(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists restaurant_logos_admin_delete on storage.objects;
create policy restaurant_logos_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_restaurant_admin(((storage.foldername(name))[1])::uuid)
  );
