create table if not exists public.digital_business_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text unique not null,
  template_id text not null default 'insurepro-classic',
  status text not null default 'draft' check (status in ('draft', 'published')),
  image_path text null,
  full_name text not null,
  title text not null default '',
  company text not null,
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  bio text not null default '' check (char_length(bio) <= 240),
  service_area text not null default '',
  primary_action text not null default 'quote' check (primary_action in ('quote', 'call', 'email')),
  primary_color text not null default '#0B5B47' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  cslb_license_number text not null default '',
  license_classification text not null default '',
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.digital_business_cards
  add column if not exists primary_color text not null default '#0B5B47'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.digital_business_cards
  add column if not exists cslb_license_number text not null default '';

alter table public.digital_business_cards
  add column if not exists license_classification text not null default '';

create unique index if not exists digital_business_cards_one_per_owner
  on public.digital_business_cards(owner_id);

alter table public.digital_business_cards enable row level security;

drop policy if exists "Owners can read their digital card" on public.digital_business_cards;
create policy "Owners can read their digital card"
  on public.digital_business_cards
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Owners can insert their digital card" on public.digital_business_cards;
create policy "Owners can insert their digital card"
  on public.digital_business_cards
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their digital card" on public.digital_business_cards;
create policy "Owners can update their digital card"
  on public.digital_business_cards
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Published cards are public" on public.digital_business_cards;
create policy "Published cards are public"
  on public.digital_business_cards
  for select
  to anon, authenticated
  using (status = 'published');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-card-media',
  'digital-card-media',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Owners can upload digital card media" on storage.objects;
create policy "Owners can upload digital card media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'digital-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owners can update digital card media" on storage.objects;
create policy "Owners can update digital card media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'digital-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'digital-card-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Published digital card media is public" on storage.objects;
create policy "Published digital card media is public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'digital-card-media');
