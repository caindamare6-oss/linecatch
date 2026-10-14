-- Product spec, phase 1: booking-only texts (no review requests), Instagram/TikTok instead of
-- photo portfolios, and a 14-day free trial that starts at sign-up.

-- 1. The barber's Instagram and TikTok usernames: buttons on their booking page.
alter table public.users add column if not exists instagram_handle text;
alter table public.users add column if not exists tiktok_handle text;
do $$ begin
  alter table public.users add constraint users_instagram_handle_format check (instagram_handle is null or instagram_handle ~ '^[a-z0-9._]{1,30}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.users add constraint users_tiktok_handle_format check (tiktok_handle is null or tiktok_handle ~ '^[a-z0-9._]{1,24}$');
exception when duplicate_object then null; end $$;

-- 2. Free trial: 14 days from sign-up (it used to start when a QR sticker was delivered).
drop trigger if exists trg_start_trial_from_delivery on public.users;
drop function if exists public.start_trial_from_delivery();
alter table public.users alter column trial_starts_at set default now();
alter table public.users alter column trial_ends_at set default (now() + interval '14 days');
-- Barbers whose trial never started get 14 days from today.
update public.users
set trial_starts_at = coalesce(trial_starts_at, now()),
    trial_ends_at = now() + interval '14 days'
where trial_ends_at is null;

-- 3. No more review requests: nothing pending, no default template, recap without the count.
delete from public.booking_reminders where reminder_type = 'review';
delete from public.message_templates where template_key = 'review_request';
update public.message_templates
set custom_message = replace(custom_message, ', {missed_caught} missed calls caught, {reviews_sent} review requests sent.', ', and {missed_caught} missed calls caught.'),
    custom_message_es = replace(custom_message_es, ', {missed_caught} llamadas perdidas recuperadas, {reviews_sent} solicitudes de reseñas enviadas.', ' y {missed_caught} llamadas perdidas recuperadas.')
where template_key = 'weekly_report';
update public.users set feature_reviews = false where feature_reviews is distinct from false;

-- Old portfolio photos, covers and review fields are left in place (unused) until you confirm
-- they can be deleted; deleting them can't be undone.
