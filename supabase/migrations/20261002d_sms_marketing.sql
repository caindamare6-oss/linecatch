-- SMS marketing becomes opt-in for barbers.
-- Service texts (missed-call text, confirmations, reminders, replies) work for every barber.
-- Marketing texts (Wednesday check-ins, win-backs, broadcasts, review requests) need
-- feature_marketing = true AND an active QR sticker, which is what collects client consent at the chair.
alter table users add column if not exists feature_marketing boolean not null default false;
alter table users add column if not exists sticker_requested_at timestamptz;

-- Barbers who already activated a sticker keep marketing on.
update users u set feature_marketing = true
where exists (select 1 from sticker_codes s where s.owner_user_id = u.user_id and s.status = 'active');

-- Onboarding used to lock every new barber until a sticker was claimed. Nothing else sets the lock,
-- so anyone locked without an active sticker was locked only for that: let them use service texts.
update users u set is_locked_out = false
where is_locked_out
  and not exists (select 1 from sticker_codes s where s.owner_user_id = u.user_id and s.status = 'active');
