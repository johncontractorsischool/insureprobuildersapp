create table if not exists public.portal_agent_assignments (
  id bigint generated always as identity primary key,
  agent_name text not null,
  assigned_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists portal_agent_assignments_assigned_at_idx
  on public.portal_agent_assignments (assigned_at desc);

alter table public.portal_agent_assignments enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'portal_agent_assignments'
  loop
    execute format('drop policy if exists %I on public.portal_agent_assignments', p.policyname);
  end loop;
end
$$;

create policy "Public read agent assignments"
on public.portal_agent_assignments
for select
to anon, authenticated
using (true);

create policy "Public insert agent assignments"
on public.portal_agent_assignments
for insert
to anon, authenticated
with check (true);
