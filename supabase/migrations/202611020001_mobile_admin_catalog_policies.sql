create or replace function public.is_restaurant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.restaurant_staff staff
    where staff.tenant_id = p_tenant_id
      and staff.auth_user_id = auth.uid()
      and staff.role = 'restaurant_admin'
      and staff.is_active
  );
$$;

revoke all on function public.is_restaurant_admin(uuid) from public, anon;
grant execute on function public.is_restaurant_admin(uuid) to authenticated;

grant select, insert, update, delete on public.restaurant_tables to authenticated;
grant select, insert, update, delete on public.menu_categories to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert, update, delete on public.restaurant_staff to authenticated;

alter table public.restaurant_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.restaurant_staff enable row level security;

drop policy if exists restaurant_admin_manage_tables on public.restaurant_tables;
create policy restaurant_admin_manage_tables
  on public.restaurant_tables
  for all to authenticated
  using (public.is_restaurant_admin(tenant_id))
  with check (public.is_restaurant_admin(tenant_id));

drop policy if exists restaurant_admin_manage_menu_categories on public.menu_categories;
create policy restaurant_admin_manage_menu_categories
  on public.menu_categories
  for all to authenticated
  using (public.is_restaurant_admin(tenant_id))
  with check (public.is_restaurant_admin(tenant_id));

drop policy if exists restaurant_admin_manage_menu_items on public.menu_items;
create policy restaurant_admin_manage_menu_items
  on public.menu_items
  for all to authenticated
  using (public.is_restaurant_admin(tenant_id))
  with check (
    public.is_restaurant_admin(tenant_id)
    and (
      category_id is null
      or exists (
        select 1
        from public.menu_categories category
        where category.id = menu_items.category_id
          and category.tenant_id = menu_items.tenant_id
      )
    )
  );

drop policy if exists restaurant_admin_manage_waiters on public.restaurant_staff;
create policy restaurant_admin_manage_waiters
  on public.restaurant_staff
  for all to authenticated
  using (
    public.is_restaurant_admin(tenant_id)
    and role = 'waiter_basic'
  )
  with check (
    public.is_restaurant_admin(tenant_id)
    and role = 'waiter_basic'
  );
