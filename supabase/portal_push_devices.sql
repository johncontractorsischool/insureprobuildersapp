create table if not exists public.portal_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  login_email text not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  project_id text not null,
  device_name text null,
  device_model text null,
  os_version text null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint portal_push_devices_user_token_key unique (user_id, expo_push_token)
);

create index if not exists portal_push_devices_user_id_idx
on public.portal_push_devices (user_id);

create index if not exists portal_push_devices_active_email_idx
on public.portal_push_devices (lower(login_email), is_active);

alter table public.portal_push_devices enable row level security;

drop policy if exists "Authenticated read own push devices" on public.portal_push_devices;
drop policy if exists "Authenticated insert own push devices" on public.portal_push_devices;
drop policy if exists "Authenticated update own push devices" on public.portal_push_devices;
drop policy if exists "Authenticated delete own push devices" on public.portal_push_devices;

create policy "Authenticated read own push devices"
on public.portal_push_devices
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

create policy "Authenticated insert own push devices"
on public.portal_push_devices
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and lower(login_email) = lower(auth.jwt() ->> 'email')
);

create policy "Authenticated update own push devices"
on public.portal_push_devices
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and lower(login_email) = lower(auth.jwt() ->> 'email')
);

create policy "Authenticated delete own push devices"
on public.portal_push_devices
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);
