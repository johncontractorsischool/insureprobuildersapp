create table if not exists public.portal_customers (
  database_id text not null,
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

alter table public.portal_customers
  alter column database_id set not null;

alter table public.portal_customers
  alter column login_email set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.portal_customers'::regclass
      and contype = 'p'
  ) then
    alter table public.portal_customers drop constraint portal_customers_pkey;
  end if;
end
$$;

alter table public.portal_customers
  add constraint portal_customers_pkey primary key (login_email, database_id);

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

create policy "Authenticated insert own login_email"
on public.portal_customers
for insert
to authenticated
with check (
  auth.jwt() ->> 'email' is not null
  and lower(login_email) = lower(auth.jwt() ->> 'email')
);

create policy "Authenticated update own login_email"
on public.portal_customers
for update
to authenticated
using (
  auth.jwt() ->> 'email' is not null
  and lower(login_email) = lower(auth.jwt() ->> 'email')
)
with check (
  auth.jwt() ->> 'email' is not null
  and lower(login_email) = lower(auth.jwt() ->> 'email')
);
