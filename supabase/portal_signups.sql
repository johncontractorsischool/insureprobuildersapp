create table if not exists public.portal_signups (
  login_email text primary key,
  first_name text not null,
  last_name text not null,
  license_number text null,
  app_fee_number text null,
  agent_name text null,
  sync_status text not null,
  sync_message text null,
  cslb_payload jsonb not null default '{}'::jsonb,
  momentum_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.portal_signups enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portal_signups'
  loop
    execute format('drop policy if exists %I on public.portal_signups', p.policyname);
  end loop;
end
$$;

create policy "Pre-auth insert signup records"
on public.portal_signups
for insert
to anon, authenticated
with check (true);

create policy "Pre-auth update signup records"
on public.portal_signups
for update
to anon, authenticated
using (true)
with check (true);

create policy "Authenticated read own signup record"
on public.portal_signups
for select
to authenticated
using (lower(login_email) = lower(auth.jwt() ->> 'email'));
