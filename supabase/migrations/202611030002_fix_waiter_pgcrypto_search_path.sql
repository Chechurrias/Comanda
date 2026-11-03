alter function public.admin_create_waiter(uuid, text, text)
  set search_path = extensions, public, pg_temp;

alter function public.login_waiter(text, text, text)
  set search_path = extensions, public, pg_temp;

alter function public.resolve_restaurant_actor(uuid, text)
  set search_path = extensions, public, pg_temp;

create or replace function public.admin_reset_waiter_pin(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = extensions, public, pg_temp
as $$
begin
  if not public.is_restaurant_admin(p_tenant_id) then
    raise exception using errcode = '42501', message = 'Restaurant administrator access required.';
  end if;

  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception using errcode = '22023', message = 'PIN must contain exactly four digits.';
  end if;

  update public.restaurant_staff
  set pin_code = '****-' || id::text,
      pin_hash = crypt(p_pin, gen_salt('bf'))
  where id = p_staff_id
    and tenant_id = p_tenant_id
    and role = 'waiter_basic';

  if not found then
    raise exception using errcode = '22023', message = 'Waiter does not belong to this restaurant.';
  end if;

  delete from public.waiter_sessions
  where staff_id = p_staff_id;
end;
$$;

revoke all on function public.admin_reset_waiter_pin(uuid, uuid, text) from public, anon;
grant execute on function public.admin_reset_waiter_pin(uuid, uuid, text) to authenticated;
