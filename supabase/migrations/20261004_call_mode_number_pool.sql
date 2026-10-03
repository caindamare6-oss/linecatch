-- 1. How missed calls reach each barber's LineCatch number.
--    forwarded: clients call the barber's real number; unanswered calls are carrier-forwarded to
--               LineCatch, which texts the caller (default).
--    direct:    clients call the LineCatch number, which rings the barber's cell first.
alter table public.users add column if not exists call_mode text not null default 'forwarded';
do $$ begin
  alter table public.users add constraint users_call_mode_check check (call_mode in ('forwarded', 'direct'));
exception when duplicate_object then null; end $$;

-- 2. Every LineCatch (Twilio) number we own. Numbers are never released back to Twilio: when a
--    barber leaves, the number is unassigned and, after a 30-day wait, given to the next barber.
create table if not exists public.phone_numbers (
  phone text primary key,                       -- E.164, e.g. +18575052551
  twilio_sid text,                              -- PN… id in Twilio
  area_code text,                               -- e.g. 857
  assigned_user_id uuid unique references public.users(user_id) on delete set null,
  assigned_at timestamptz,
  released_at timestamptz,                      -- when it was last freed; reusable 30 days later
  created_at timestamptz not null default now()
);
create index if not exists phone_numbers_free_idx on public.phone_numbers (area_code) where assigned_user_id is null;

alter table public.phone_numbers enable row level security;
-- Server only: no browser access at all.
revoke all on table public.phone_numbers from anon, authenticated;

-- Numbers barbers already have go into the table as assigned.
insert into public.phone_numbers (phone, area_code, assigned_user_id, assigned_at)
select phone_number, substring(regexp_replace(phone_number, '\D', '', 'g') from 2 for 3), user_id, now()
from public.users
where phone_number is not null
on conflict (phone) do nothing;
