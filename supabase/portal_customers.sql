create table if not exists public.portal_customers (
  database_id text primary key,
  login_email text not null,
  customer_id text null,
  insured_id text null,
  commercial_name text null,
  first_name text null,
  last_name text null,
  email text null,
  phone text null,
  cell_phone text null,
  is_active boolean not null default true,
  source_payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.portal_customers enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portal_customers'
  loop
    execute format('drop policy if exists %I on public.portal_customers', p.policyname);
  end loop;
end
$$;

create policy "Authenticated read own login_email"
on public.portal_customers
for select
to authenticated
using (lower(login_email) = lower(auth.jwt() ->> 'email'));

create policy "Pre-auth insert sync"
on public.portal_customers
for insert
to anon, authenticated
with check (true);

create policy "Pre-auth update sync"
on public.portal_customers
for update
to anon, authenticated
using (true)
with check (true);
