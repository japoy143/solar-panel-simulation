-- Clients (one per email address, created automatically from bookings) and the email
-- conversation with each client. Run after 0001_init.sql, in the Supabase SQL editor
-- (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null check (length(name) between 1 and 200),
  email       text not null check (length(email) between 3 and 320),
  phone       text,
  address     text,
  notes       text check (length(notes) <= 5000),
  status      text not null default 'lead'
              check (status in ('lead', 'assessment', 'installing', 'completed', 'maintenance', 'inactive'))
);

-- One client per email address, whatever its letter case.
create unique index clients_email_key on public.clients (lower(email));

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;

create policy "Admin can read clients" on public.clients
  for select using (public.is_admin());
create policy "Admin can insert clients" on public.clients
  for insert with check (public.is_admin());
create policy "Admin can update clients" on public.clients
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete clients" on public.clients
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Bookings → clients
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column client_id uuid references public.clients (id) on delete set null,
  -- When the admin first opened the booking; unseen new bookings show in the notification bell.
  add column seen_at timestamptz;

create index bookings_client_id_idx on public.bookings (client_id);

-- Backfill: one client per existing email (latest contact details, earliest booking date).
insert into public.clients (name, email, phone, address, created_at)
select distinct on (lower(b.email))
  b.name, b.email, b.phone, b.address,
  (select min(b2.created_at) from public.bookings b2 where lower(b2.email) = lower(b.email))
from public.bookings b
order by lower(b.email), b.created_at desc
on conflict do nothing;

update public.bookings b
set client_id = c.id
from public.clients c
where lower(c.email) = lower(b.email) and b.client_id is null;

-- Existing bookings that were already handled shouldn't light up the bell.
update public.bookings set seen_at = now() where status <> 'new';

-- Every new booking is linked to its client, creating the client on first contact.
-- SECURITY DEFINER: guests may insert bookings but must never read or write clients directly;
-- the trigger does it for them, and only this. A repeat booking only fills in contact details
-- the client record is missing, so a guest can't overwrite an existing client's data.
create or replace function public.link_booking_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.clients (name, email, phone, address)
  values (new.name, new.email, new.phone, new.address)
  on conflict ((lower(email))) do update
    set phone   = coalesce(public.clients.phone, excluded.phone),
        address = coalesce(public.clients.address, excluded.address)
  returning id into new.client_id;
  return new;
end;
$$;

create trigger bookings_link_client before insert on public.bookings
  for each row execute function public.link_booking_client();

-- ---------------------------------------------------------------------------
-- Messages: every email to or from a client.
-- ---------------------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete set null,
  direction   text not null check (direction in ('outbound', 'inbound')),
  kind        text not null default 'manual'
              check (kind in ('manual', 'booking_received', 'booking_confirmed', 'reply')),
  subject     text not null default '' check (length(subject) <= 500),
  body_text   text not null default '' check (length(body_text) <= 100000),
  from_email  text,
  to_email    text,
  status      text not null check (status in ('sent', 'delivered', 'bounced', 'failed', 'received')),
  error       text,
  -- Resend's email id: dedupes webhook retries and links delivery/bounce events to the message.
  resend_id   text unique,
  -- When the admin saw it. Unread inbound replies and failed sends drive the notification bell.
  read_at     timestamptz
);

create index messages_client_created_idx on public.messages (client_id, created_at);
create index messages_unread_idx on public.messages (created_at desc) where read_at is null;

alter table public.messages enable row level security;

create policy "Admin can read messages" on public.messages
  for select using (public.is_admin());
create policy "Admin can insert messages" on public.messages
  for insert with check (public.is_admin());
create policy "Admin can update messages" on public.messages
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete messages" on public.messages
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Client list with activity figures. security_invoker: the caller's RLS applies (admin only).
-- ---------------------------------------------------------------------------
create view public.client_overview with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.bookings b where b.client_id = c.id) as booking_count,
  (select max(m.created_at) from public.messages m where m.client_id = c.id) as last_message_at,
  (select count(*) from public.messages m
     where m.client_id = c.id and m.read_at is null
       and (m.direction = 'inbound' or m.status in ('bounced', 'failed'))) as unread_count,
  greatest(c.created_at, (select max(m.created_at) from public.messages m where m.client_id = c.id))
    as last_activity_at
from public.clients c;
