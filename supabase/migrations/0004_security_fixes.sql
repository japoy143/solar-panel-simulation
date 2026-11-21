-- Security hardening from the pre-deployment audit. Run after 0003_clients_messages.sql, in the
-- Supabase SQL editor (or `supabase db push`). Safe to run once on a database with data.

-- ---------------------------------------------------------------------------
-- Guests (anon key) may only fill in the booking form's own fields.
--
-- The insert policy only checked `status = 'new'`, so anyone calling the REST API directly with
-- the public key could also set created_at (backdate), seen_at (hide a booking from the admin's
-- notification bell) or client_id (overwritten by the trigger today, but not by design).
-- Column privileges limit inserts to the fields the booking form sends; everything else takes
-- its default (status 'new', created_at now(), seen_at null) or is set by the trigger.
-- The admin never inserts bookings, and the service role is unaffected.
-- ---------------------------------------------------------------------------
revoke insert on public.bookings from anon, authenticated;
grant insert (id, name, email, phone, preferred_date, address, notes, layout)
  on public.bookings to anon, authenticated;

-- Limits the app already enforces, now also enforced for direct API calls. NOT VALID: checked for
-- new and updated rows only, so existing rows can't make this migration fail.
alter table public.bookings
  add constraint bookings_phone_length check (phone is null or length(phone) <= 50) not valid,
  add constraint bookings_email_format
    check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid,
  -- The simulator layout is a small JSON document; this caps abuse of the public insert.
  add constraint bookings_layout_size check (layout is null or octet_length(layout::text) <= 200000) not valid;

-- ---------------------------------------------------------------------------
-- Pin search_path on the remaining functions (Supabase linter: function_search_path_mutable).
-- Both only use schema-qualified or pg_catalog objects, so behaviour doesn't change.
-- ---------------------------------------------------------------------------
alter function public.is_admin() set search_path = '';
alter function public.touch_updated_at() set search_path = '';
