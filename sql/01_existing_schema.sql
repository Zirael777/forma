-- FORMA CRM: initial schema and row-level security
-- Run once in Supabase SQL Editor.

create table if not exists public.crm_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  furniture_type text not null,
  service_type text not null,
  description text,
  photo_paths text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new', 'assessment', 'approval', 'in_progress', 'completed', 'cancelled')),
  estimated_price numeric(12,2) check (estimated_price >= 0),
  admin_notes text,
  consent_given boolean not null check (consent_given = true),
  created_at timestamptz not null default now()
);

alter table public.crm_admins enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.crm_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_crm_admin() from public;
grant execute on function public.is_crm_admin() to authenticated;

drop policy if exists "Admin sees own membership" on public.crm_admins;
create policy "Admin sees own membership"
on public.crm_admins
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public creates orders" on public.orders;
create policy "Public creates orders"
on public.orders
for insert to anon, authenticated
with check (
  status = 'new'
  and estimated_price is null
  and admin_notes is null
  and cardinality(photo_paths) = 0
  and consent_given = true
  and length(trim(customer_name)) between 1 and 150
  and length(trim(phone)) between 5 and 40
  and length(furniture_type) between 1 and 100
  and length(service_type) between 1 and 100
  and length(coalesce(description, '')) <= 5000
);

drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders"
on public.orders
for select to authenticated
using ((select public.is_crm_admin()));

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders"
on public.orders
for update to authenticated
using ((select public.is_crm_admin()))
with check ((select public.is_crm_admin()));

revoke all on public.orders from anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.crm_admins to authenticated;
