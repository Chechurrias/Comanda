-- Run immediately in the Supabase SQL Editor after the shared bootstrap SQL.
-- The app uses scoped SECURITY DEFINER RPCs for mobile access; it must not
-- expose whole tenants/devices tables or allow anonymous device insertion.

drop policy if exists "Allow anon read plans" on public.plans;
drop policy if exists "Devices can check status" on public.devices;
drop policy if exists "Tenants can check status" on public.tenants;
drop policy if exists "Devices can insert self" on public.devices;

revoke all on table public.tenants, public.licenses, public.devices,
  public.users, public.plans from public, anon;

revoke all on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;
