-- Stripe, test mode first (PLAN.md).
-- Part A: barbers pay LineCatch $49/month after their 14-day trial.
-- Part B: Stripe Connect Express. Clients save a card at booking (only when the barber has
-- no-show protection on); it's charged when the cut is done, or for a no-show / late cancel.
-- LineCatch never stores card numbers: only Stripe IDs live here.

-- ── Part A: the barber's own subscription ──
alter table public.users add column if not exists stripe_customer_id text;
alter table public.users add column if not exists stripe_subscription_id text;
alter table public.users add column if not exists billing_status text not null default 'trialing';
do $$ begin
  alter table public.users add constraint users_billing_status_check
    check (billing_status in ('trialing', 'active', 'past_due', 'paused', 'canceled'));
exception when duplicate_object then null; end $$;
-- When a failed payment's 7-day grace runs out.
alter table public.users add column if not exists billing_grace_until timestamptz;
-- Trial texts already sent ("d10", "d13", "d14"), so each goes out once.
alter table public.users add column if not exists billing_texts_sent text[] not null default '{}';
create unique index if not exists users_stripe_customer_id_key on public.users (stripe_customer_id) where stripe_customer_id is not null;

-- ── Part B: the barber's payout account and no-show protection ──
alter table public.users add column if not exists stripe_account_id text;
alter table public.users add column if not exists stripe_charges_enabled boolean not null default false;
alter table public.users add column if not exists stripe_payouts_enabled boolean not null default false;
alter table public.users add column if not exists protection_enabled boolean not null default false;
alter table public.users add column if not exists no_show_fee_percent integer not null default 50;
do $$ begin
  alter table public.users add constraint users_no_show_fee_percent_check check (no_show_fee_percent between 10 and 100);
exception when duplicate_object then null; end $$;
create unique index if not exists users_stripe_account_id_key on public.users (stripe_account_id) where stripe_account_id is not null;

-- One row per booking that has a saved card. Barbers can read theirs; only the server writes.
create table if not exists public.booking_payments (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  user_id uuid not null,
  stripe_account_id text not null,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  card_brand text,
  card_last4 text,
  -- card_saved → paid | fee_charged | waived | failed; refunded when a charge is taken back.
  status text not null default 'card_saved'
    check (status in ('card_saved', 'paid', 'fee_charged', 'waived', 'failed', 'refunded')),
  amount_cents integer,
  reward_cents integer not null default 0,
  stripe_payment_intent_id text,
  failure_message text,
  charged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_payments_user_id_idx on public.booking_payments (user_id, created_at desc);
alter table public.booking_payments enable row level security;
drop policy if exists booking_payments_select_own on public.booking_payments;
create policy booking_payments_select_own on public.booking_payments for select using (auth.uid() = user_id);

-- Instant cash-outs, with LineCatch's 1.75% (min $0.50) fee.
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  stripe_payout_id text,
  amount_cents integer not null,
  fee_cents integer not null default 0,
  method text not null check (method in ('instant', 'standard')),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists payouts_user_id_idx on public.payouts (user_id, created_at desc);
alter table public.payouts enable row level security;
drop policy if exists payouts_select_own on public.payouts;
create policy payouts_select_own on public.payouts for select using (auth.uid() = user_id);

-- Stripe sends some webhooks more than once; each event is handled once.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
