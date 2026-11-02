-- Align the original bootstrap migration with the schema currently consumed
-- by the applications. This migration is additive and safe on the supplied DB.
alter table public.tenants
  add column if not exists legal_name varchar,
  add column if not exists trade_name varchar,
  add column if not exists tax_id varchar;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code varchar not null unique,
  name varchar not null,
  max_devices integer not null default 3,
  max_waiters integer not null default 5,
  max_tables integer not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  role varchar not null default 'restaurant_admin',
  email varchar not null,
  password_hash varchar not null default '',
  full_name varchar not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  pin_code varchar default '1234'
);

alter table public.devices
  add column if not exists android_id varchar(64),
  add column if not exists device_token varchar,
  add column if not exists pairing_code varchar,
  add column if not exists hardware_id varchar,
  add column if not exists activated_at timestamptz,
  add column if not exists trust_status varchar default 'pending',
  add column if not exists device_name varchar,
  add column if not exists name varchar;

alter table public.devices alter column tenant_id drop not null;
alter table public.devices alter column android_id drop not null;

-- Fail explicitly instead of silently selecting one of conflicting activation
-- requests. Resolve any duplicate codes before applying this migration.
do $$
begin
  if exists (
    select 1 from public.devices
    where pairing_code is not null
    group by pairing_code having count(*) > 1
  ) then
    raise exception 'Duplicate devices.pairing_code values exist; clean them before applying activation constraints.';
  end if;
end $$;

create unique index if not exists devices_pairing_code_unique
  on public.devices(pairing_code) where pairing_code is not null;

create unique index if not exists devices_device_token_unique
  on public.devices(device_token) where device_token is not null;

do $$
begin
  if exists (
    select 1 from public.licenses where is_active
    group by tenant_id having count(*) > 1
  ) then
    raise exception 'Tenants with multiple active licenses exist; resolve them before applying activation constraints.';
  end if;
end $$;

create unique index if not exists licenses_one_active_per_tenant
  on public.licenses(tenant_id) where is_active;

-- Keep legacy status and the current trust_status contract in sync.
create or replace function public.sync_device_trust_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.trust_status is not null then
      new.status := case new.trust_status
        when 'trusted' then 'authorized'
        when 'revoked' then 'blocked'
        else 'pending'
      end;
    else
      new.trust_status := case new.status
        when 'authorized' then 'trusted'
        when 'blocked' then 'revoked'
        else 'pending'
      end;
    end if;
  elsif new.trust_status is distinct from old.trust_status then
    new.status := case new.trust_status
      when 'trusted' then 'authorized'
      when 'revoked' then 'blocked'
      else 'pending'
    end;
  elsif new.status is distinct from old.status then
    new.trust_status := case new.status
      when 'authorized' then 'trusted'
      when 'blocked' then 'revoked'
      else 'pending'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists devices_sync_trust_status on public.devices;
create trigger devices_sync_trust_status
before insert or update of status, trust_status on public.devices
for each row execute function public.sync_device_trust_status();

-- Codes are minted by the mobile app. This public, narrowly scoped RPC only
-- creates an unlinked pending device; it cannot create tenants or authorize it.
create or replace function public.request_device_activation(
  p_device_id uuid,
  p_pairing_code varchar,
  p_device_name varchar,
  p_hardware_id varchar
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_pairing_code !~ '^[0-9]{6}$' then
    raise exception 'Invalid pairing code';
  end if;
  if p_hardware_id is null or length(trim(p_hardware_id)) < 8 then
    raise exception 'Invalid hardware identifier';
  end if;

  delete from public.devices
  where tenant_id is null
    and trust_status = 'pending'
    and created_at < now() - interval '24 hours';

  insert into public.devices (
    id, device_token, pairing_code, device_name, hardware_id, android_id,
    status, trust_status, tenant_id
  ) values (
    p_device_id, p_device_id::text, p_pairing_code, p_device_name,
    p_hardware_id, p_hardware_id, 'pending', 'pending', null
  );
end;
$$;

revoke all on function public.request_device_activation(uuid, varchar, varchar, varchar) from public;
grant execute on function public.request_device_activation(uuid, varchar, varchar, varchar) to anon, authenticated;

create or replace function public.get_device_activation(p_device_id uuid)
returns table (trust_status varchar, tenant_id uuid, restaurant_name varchar)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select
    case when d.trust_status = 'pending' and d.created_at < now() - interval '24 hours'
      then 'expired' else d.trust_status end,
    d.tenant_id,
    t.name
  from public.devices d
  left join public.tenants t on t.id = d.tenant_id
  where d.id = p_device_id
  limit 1;

  if not found then
    return query select 'expired'::varchar, null::uuid, null::varchar;
  end if;
end;
$$;

revoke all on function public.get_device_activation(uuid) from public;
grant execute on function public.get_device_activation(uuid) to anon, authenticated;

-- All tenant/license/admin/device writes happen in one PostgreSQL transaction.
create or replace function public.activate_restaurant(
  p_device_id uuid,
  p_name varchar,
  p_email varchar,
  p_pin varchar,
  p_plan_code varchar,
  p_duration varchar,
  p_tax_id varchar default null
)
returns table (tenant_id uuid, license_id uuid, admin_user_id uuid, activated_device_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_device public.devices%rowtype;
  v_plan public.plans%rowtype;
  v_tenant_id uuid;
  v_license_id uuid;
  v_admin_id uuid;
  v_expires_at timestamptz;
  v_slug varchar;
begin
  if p_name is null or length(trim(p_name)) = 0 or length(trim(p_name)) > 150 then
    raise exception 'Invalid restaurant name';
  end if;
  if p_email is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid administrator email';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must contain exactly four digits';
  end if;
  if p_duration is null or p_duration not in ('trial_7', 'trial_15', '1', '12', 'lifetime') then
    raise exception 'Invalid license duration';
  end if;

  select * into v_device from public.devices where id = p_device_id for update;
  if not found then
    raise exception 'Activation request was not found';
  end if;
  if v_device.trust_status is distinct from 'pending'
    or v_device.tenant_id is not null
    or v_device.created_at < now() - interval '24 hours' then
    raise exception 'Device is no longer pending or is already linked';
  end if;

  select * into v_plan from public.plans where code = lower(p_plan_code);
  if not found then
    raise exception 'Plan configuration was not found';
  end if;
  if v_plan.max_devices < 1 or v_plan.max_waiters < 0 or v_plan.max_tables < 0 then
    raise exception 'Invalid or missing plan configuration';
  end if;

  v_expires_at := case p_duration
    when 'trial_7' then now() + interval '7 days'
    when 'trial_15' then now() + interval '15 days'
    when '1' then now() + interval '1 month'
    when '12' then now() + interval '12 months'
    else now() + interval '99 years'
  end;

  v_tenant_id := gen_random_uuid();
  v_slug := left(regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'), 60)
    || '-' || left(v_tenant_id::text, 8);

  insert into public.tenants (id, name, slug, trade_name, legal_name, tax_id, status)
  values (v_tenant_id, trim(p_name), v_slug, trim(p_name), trim(p_name), nullif(trim(coalesce(p_tax_id, '')), ''), 'active');

  update public.licenses set is_active = false, updated_at = now()
  where tenant_id = v_tenant_id and is_active;

  insert into public.licenses (
    tenant_id, plan, max_devices, max_waiters, max_tables,
    is_active, starts_at, expires_at
  ) values (
    v_tenant_id, v_plan.code, v_plan.max_devices, v_plan.max_waiters,
    v_plan.max_tables, true, now(), v_expires_at
  ) returning id into v_license_id;

  insert into public.users (tenant_id, role, email, full_name, pin_code, is_active)
  values (v_tenant_id, 'restaurant_admin', lower(trim(p_email)), trim(p_name) || ' Gerencia', p_pin, true)
  returning id into v_admin_id;

  update public.devices
  set tenant_id = v_tenant_id,
      trust_status = 'trusted',
      status = 'authorized',
      activated_at = now()
  where id = p_device_id;

  return query select v_tenant_id, v_license_id, v_admin_id, p_device_id;
end;
$$;

revoke all on function public.activate_restaurant(uuid, varchar, varchar, varchar, varchar, varchar, varchar) from public, anon, authenticated;
grant execute on function public.activate_restaurant(uuid, varchar, varchar, varchar, varchar, varchar, varchar) to service_role;

-- The web server's service role may invoke the RPC, but browser roles cannot
-- call it directly. Direct inserts are governed by existing RLS policies.

