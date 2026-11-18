-- Solar Layout Simulator: products, bookings, product images, admin-only access.
-- Run once in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Admin check: the single admin account has app_metadata.role = 'admin'.
-- app_metadata can only be changed with the service role / SQL, never by the user.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (length(name) between 1 and 120),
  category    text not null check (category in ('panel', 'inverter', 'battery')),
  summary     text not null default '',
  specs       jsonb not null default '[]'::jsonb,
  price_cents integer check (price_cents >= 0),
  featured    boolean not null default false,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  -- Simulator
  placement   text not null check (placement in ('roof', 'wall')),
  size_w      numeric not null check (size_w > 0),
  size_h      numeric not null check (size_h > 0),
  size_d      numeric not null check (size_d > 0),
  watts       numeric check (watts > 0),
  kw          numeric check (kw > 0),
  kwh         numeric check (kwh > 0),
  hybrid      boolean not null default false,
  -- Storage paths in the product-images bucket; the first one is the cover.
  images      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

create policy "Anyone can read active products" on public.products
  for select using (active or public.is_admin());
create policy "Admin can insert products" on public.products
  for insert with check (public.is_admin());
create policy "Admin can update products" on public.products
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete products" on public.products
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Bookings: guests can only create; only the admin can read or change.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (length(name) between 1 and 200),
  email          text not null check (length(email) between 3 and 320),
  phone          text,
  preferred_date date not null,
  address        text not null check (length(address) between 1 and 500),
  notes          text check (length(notes) <= 5000),
  layout         jsonb,
  status         text not null default 'new'
                 check (status in ('new', 'confirmed', 'completed', 'cancelled'))
);

alter table public.bookings enable row level security;

create policy "Anyone can request a booking" on public.bookings
  for insert with check (status = 'new');
create policy "Admin can read bookings" on public.bookings
  for select using (public.is_admin());
create policy "Admin can update bookings" on public.bookings
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete bookings" on public.bookings
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Product images bucket: public read, admin write. JPEG/PNG/WebP up to 5 MB.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Admin can upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admin can update product images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "Admin can delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: the original sample catalog (same slugs, so saved simulator layouts still load).
-- ---------------------------------------------------------------------------
insert into public.products
  (slug, name, category, summary, specs, featured, sort_order, placement, size_w, size_h, size_d, watts, kw, kwh, hybrid)
values
  ('mono-410', 'Mono 410 W Panel', 'panel',
   'High-efficiency monocrystalline panel for most residential roofs.',
   '[{"label":"Power","value":"410 W"},{"label":"Efficiency","value":"21.3%"},{"label":"Warranty","value":"25 yr"}]',
   true, 10, 'roof', 1.13, 1.72, 0.04, 410, null, null, false),
  ('black-430', 'All-Black 430 W Panel', 'panel',
   'Black frame and backsheet for a clean, low-profile look.',
   '[{"label":"Power","value":"430 W"},{"label":"Efficiency","value":"22.0%"},{"label":"Warranty","value":"25 yr"}]',
   false, 20, 'roof', 1.13, 1.76, 0.04, 430, null, null, false),
  ('hybrid-5', 'Hybrid Inverter 5 kW', 'inverter',
   'Converts solar power for your home and is ready for a battery.',
   '[{"label":"Output","value":"5 kW"},{"label":"Phase","value":"Single"},{"label":"Battery","value":"Ready"}]',
   true, 30, 'wall', 0.5, 0.6, 0.22, null, 5, null, true),
  ('string-8', 'String Inverter 8 kW', 'inverter',
   'Three-phase inverter for larger homes and small businesses.',
   '[{"label":"Output","value":"8 kW"},{"label":"Phase","value":"Three"},{"label":"MPPT","value":"2"}]',
   false, 40, 'wall', 0.45, 0.55, 0.2, null, 8, null, false),
  ('battery-10', 'Home Battery 10 kWh', 'battery',
   'Stores daytime solar so you can use it in the evening.',
   '[{"label":"Capacity","value":"10 kWh"},{"label":"Power","value":"5 kW"},{"label":"Chemistry","value":"LFP"}]',
   true, 50, 'wall', 0.6, 1.1, 0.25, null, null, 10, false),
  ('battery-5', 'Home Battery 5 kWh', 'battery',
   'Compact battery for smaller systems, expandable later.',
   '[{"label":"Capacity","value":"5 kWh"},{"label":"Power","value":"2.5 kW"},{"label":"Chemistry","value":"LFP"}]',
   false, 60, 'wall', 0.6, 0.65, 0.25, null, null, 5, false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- After creating the admin user in Authentication → Users, run (with their email):
--
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--   where email = 'you@example.com';
--
-- Then sign out/in so the new role is in the session token.
-- ---------------------------------------------------------------------------
