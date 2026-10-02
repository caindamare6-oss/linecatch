-- Referrals: every barber has a code and a share link (/join/CODE).
-- A new barber enters a code (or arrives through the link) during signup.
-- When they finish onboarding the referral "qualifies": the referrer earns 1 free month,
-- the new barber gets 50% off their first month. Credits are recorded here and applied by billing.
alter table users add column if not exists referral_code text;
alter table users add column if not exists referred_by uuid references users(user_id) on delete set null;
alter table users add column if not exists referral_source text;
create unique index if not exists users_referral_code_key on users (upper(referral_code)) where referral_code is not null;

do $$
declare r record; base text; candidate text;
begin
  for r in select user_id, business_name, first_name from users where referral_code is null loop
    base := upper(left(regexp_replace(coalesce(nullif(trim(r.business_name), ''), nullif(trim(r.first_name), ''), 'LC'), '[^A-Za-z0-9]', '', 'g'), 6));
    if length(base) < 2 then base := 'LC'; end if;
    loop
      candidate := base || lpad((floor(random() * 1000))::int::text, 3, '0');
      exit when not exists (select 1 from users where upper(referral_code) = candidate);
    end loop;
    update users set referral_code = candidate where user_id = r.user_id;
  end loop;
end $$;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references users(user_id) on delete cascade,
  referred_user_id uuid not null unique references users(user_id) on delete cascade,
  code text not null,
  status text not null default 'signed_up' check (status in ('signed_up', 'qualified')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_user_id <> referred_user_id)
);
create index if not exists referrals_referrer_idx on referrals (referrer_user_id);
alter table referrals enable row level security;
do $$ begin
  create policy "Barbers see referrals they made" on referrals for select using (auth.uid() = referrer_user_id);
exception when duplicate_object then null; end $$;

create table if not exists billing_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  kind text not null check (kind in ('free_month', 'percent_off')),
  amount integer not null check (amount > 0),
  referral_id uuid references referrals(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (referral_id, user_id)
);
alter table billing_credits enable row level security;
do $$ begin
  create policy "Barbers see own credits" on billing_credits for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Why a number stopped getting texts: client_stop, carrier_stop, not_mobile, invalid_number.
alter table opt_outs add column if not exists reason text;
