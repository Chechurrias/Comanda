-- Operator accounts use the platform_operators table already created by the
-- console's bootstrap SQL. Client table reads are restricted; mobile access
-- uses the narrow security-definer RPCs below.

create table if not exists public.platform_operators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default 'Super Admin',
  role text not null default 'operator' check (role in ('owner', 'operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.platform_operators
  add column if not exists role text not null default 'operator',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.platform_operators
set role = 'owner'
where user_id = (
  select user_id from public.platform_operators order by created_at asc limit 1
) and not exists (
  select 1 from public.platform_operators where role = 'owner'
);

alter table public.platform_operators enable row level security;
revoke all on public.platform_operators from public, anon, authenticated;
grant select on public.platform_operators to authenticated;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_operators
    where user_id = auth.uid() and is_active = true
  );
$$;
revoke all on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;

do $$
declare old_policy record;
begin
  for old_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'platform_operators'
  loop
    execute format('drop policy %I on public.platform_operators', old_policy.policyname);
  end loop;
end;
$$;
create policy platform_operator_read_self
  on public.platform_operators for select to authenticated
  using (user_id = auth.uid() and public.is_operator());

create table if not exists public.console_bootstrap_state (
  singleton boolean primary key default true check (singleton = true),
  initialized boolean not null default false
);
insert into public.console_bootstrap_state(singleton, initialized)
values (true, false) on conflict (singleton) do nothing;
alter table public.console_bootstrap_state enable row level security;
revoke all on public.console_bootstrap_state from public, anon, authenticated;

create or replace function public.claim_console_bootstrap()
returns boolean language plpgsql security definer
set search_path = public, pg_temp as $$
declare claimed boolean;
begin
  update public.console_bootstrap_state set initialized = true
  where singleton = true and initialized = false
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.release_console_bootstrap()
returns void language sql security definer
set search_path = public, pg_temp as $$
  update public.console_bootstrap_state set initialized = false where singleton = true;
$$;
revoke all on function public.claim_console_bootstrap() from public, anon, authenticated;
revoke all on function public.release_console_bootstrap() from public, anon, authenticated;
grant execute on function public.claim_console_bootstrap() to service_role;
grant execute on function public.release_console_bootstrap() to service_role;

-- Remove old permissive policies before adding the operator-only policies.
-- This prevents a stale anon policy from OR-ing around the console guard.
do $$
declare
  target_table text;
  old_policy record;
begin
  foreach target_table in array array['tenants', 'licenses', 'plans', 'devices', 'users'] loop
    if to_regclass('public.' || target_table) is not null then
      for old_policy in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = target_table
      loop
        execute format('drop policy %I on public.%I', old_policy.policyname, target_table);
      end loop;
      execute format('alter table public.%I enable row level security', target_table);
      execute format('revoke all on public.%I from public, anon, authenticated', target_table);
      execute format('grant select on public.%I to authenticated', target_table);
      execute format(
        'create policy platform_operator_select on public.%I for select to authenticated using (public.is_operator())',
        target_table
      );
      if target_table = any(array['tenants', 'licenses', 'devices', 'users']) then
        execute format('grant update on public.%I to authenticated', target_table);
        execute format(
          'create policy platform_operator_update on public.%I for update to authenticated using (public.is_operator()) with check (public.is_operator())',
          target_table
        );
      end if;
      if target_table = 'licenses' then
        execute format('grant insert on public.%I to authenticated', target_table);
        execute format(
          'create policy platform_operator_insert on public.%I for insert to authenticated with check (public.is_operator())',
          target_table
        );
      end if;
    end if;
  end loop;
end;
$$;

-- Authenticated customers are not console operators; tenant data remains
-- inaccessible to them through these platform tables.

-- Mobile clients use narrowly scoped functions instead of anonymous table
-- reads, so the RLS policy above does not expose tenant/user rows to the app.
create table if not exists public.mobile_pin_attempts (
  device_id uuid primary key references public.devices(id) on delete cascade,
  failed_count smallint not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mobile_pin_attempts enable row level security;
revoke all on public.mobile_pin_attempts from public, anon, authenticated;

create or replace function public.get_mobile_device_status(
  p_tenant_id uuid,
  p_device_id uuid
)
returns table (
  tenant_status varchar,
  trust_status varchar,
  license_valid boolean,
  restaurant_name varchar
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.status, d.trust_status,
    exists (
      select 1 from public.licenses l
      where l.tenant_id = t.id and l.is_active = true
        and l.starts_at <= now() and l.expires_at > now()
    ),
    t.name
  from public.devices d
  join public.tenants t on t.id = d.tenant_id
  where d.id = p_device_id and d.tenant_id = p_tenant_id
  limit 1;
$$;

create or replace function public.verify_mobile_pin(
  p_tenant_id uuid,
  p_device_id uuid,
  p_pin varchar
)
returns table (role varchar, full_name varchar, is_active boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_failed smallint;
  v_locked_until timestamptz;
  v_user public.users%rowtype;
begin
  if p_pin !~ '^[0-9]{4}$' then return; end if;

  if not exists (
    select 1 from public.devices d
    join public.tenants t on t.id = d.tenant_id
    where d.id = p_device_id and d.tenant_id = p_tenant_id
      and d.trust_status = 'trusted' and t.status = 'active'
      and exists (select 1 from public.licenses l where l.tenant_id = t.id
        and l.is_active and l.starts_at <= now() and l.expires_at > now())
  ) then return; end if;

  insert into public.mobile_pin_attempts(device_id) values (p_device_id)
    on conflict (device_id) do nothing;
  select failed_count, locked_until into v_failed, v_locked_until
    from public.mobile_pin_attempts where device_id = p_device_id for update;
  if v_locked_until is not null and v_locked_until > now() then return; end if;

  select * into v_user from public.users u
    where u.tenant_id = p_tenant_id and u.pin_code = p_pin and u.is_active = true
    limit 1;

  if found then
    update public.mobile_pin_attempts set failed_count = 0, locked_until = null,
      updated_at = now() where device_id = p_device_id;
    return query select v_user.role, v_user.full_name, v_user.is_active;
    return;
  end if;

  v_failed := coalesce(v_failed, 0) + 1;
  update public.mobile_pin_attempts set failed_count = v_failed,
    locked_until = case when v_failed >= 5 then now() + interval '15 minutes' else null end,
    updated_at = now() where device_id = p_device_id;
end;
$$;

create or replace function public.get_mobile_license_summary(
  p_tenant_id uuid,
  p_device_id uuid
)
returns table (
  plan_code varchar,
  plan_name varchar,
  max_devices smallint,
  max_waiters smallint,
  expires_at timestamptz,
  devices_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.plan, p.name, l.max_devices, l.max_waiters, l.expires_at,
    (select count(*) from public.devices d2 where d2.tenant_id = t.id and d2.trust_status = 'trusted')
  from public.devices d
  join public.tenants t on t.id = d.tenant_id
  join lateral (
    select lic.* from public.licenses lic where lic.tenant_id = t.id
    order by lic.created_at desc limit 1
  ) l on true
  left join public.plans p on p.code = l.plan
  where d.id = p_device_id and d.tenant_id = p_tenant_id
    and d.trust_status = 'trusted'
  limit 1;
$$;

revoke all on function public.get_mobile_device_status(uuid, uuid) from public;
revoke all on function public.verify_mobile_pin(uuid, uuid, varchar) from public;
revoke all on function public.get_mobile_license_summary(uuid, uuid) from public;
grant execute on function public.get_mobile_device_status(uuid, uuid) to anon, authenticated;
grant execute on function public.verify_mobile_pin(uuid, uuid, varchar) to anon, authenticated;
grant execute on function public.get_mobile_license_summary(uuid, uuid) to anon, authenticated;
