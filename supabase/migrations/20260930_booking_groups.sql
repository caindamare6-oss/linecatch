-- ─── Phase 2: group bookings ─────────────────────────────────────────────
-- One row per person, linked by group_id.
alter table bookings add column if not exists group_id uuid;
create index if not exists bookings_group_id_idx on bookings(group_id) where group_id is not null;

-- ─── Phase 3: plan-specific loyalty ──────────────────────────────────────
-- Basic rewards cuts 3/6/9…, Full rewards 1/4/7/10…
alter table users add column if not exists plan text not null default 'full';
do $$ begin
  alter table users add constraint users_plan_check check (plan in ('basic', 'full'));
exception when duplicate_object then null; end $$;

-- One row per reward actually given. visit_key = group_id (or booking id for solo),
-- unique so a group can never get the $5 twice.
create table if not exists loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  client_phone text not null,
  booking_id uuid not null references bookings(id) on delete cascade,
  visit_key text not null unique,
  amount_cents integer not null default 500,
  cut_number integer not null,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_rewards_user_idx on loyalty_rewards(user_id, created_at);
alter table loyalty_rewards enable row level security;
do $$ begin
  create policy "Barbers view own loyalty rewards" on loyalty_rewards
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Atomic stamp: two completions at once can't both read N and write N+1.
create or replace function loyalty_add_stamp(p_user_id uuid, p_phone text, p_date date)
returns integer
language sql
as $$
  update vip_clients
  set cut_count = coalesce(cut_count, 0) + 1,
      last_cut_date = p_date
  where user_id = p_user_id and phone_number = p_phone
  returning cut_count;
$$;
revoke execute on function loyalty_add_stamp(uuid, text, date) from public, anon, authenticated;

