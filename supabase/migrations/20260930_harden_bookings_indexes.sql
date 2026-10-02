-- Applied to production 2026-09-30 via Supabase. Kept here for the record.
create unique index if not exists bookings_user_time_confirmed_uniq
  on public.bookings (user_id, booking_time) where status = 'confirmed';
create index if not exists bookings_user_time_idx on public.bookings (user_id, booking_time);
create index if not exists bookings_service_id_idx on public.bookings (service_id);
create index if not exists services_user_id_idx on public.services (user_id);
alter function public.loyalty_add_stamp(uuid, text, date) set search_path = public, pg_temp;
