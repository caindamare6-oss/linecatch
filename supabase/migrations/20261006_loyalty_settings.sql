-- Loyalty v2: the same schedule for every client (1st cut full price, 2nd cut off, then every
-- 3rd: 2, 5, 8, 11…), one stamp per visit, and each barber's own on/off switch and amount.
alter table public.users add column if not exists loyalty_enabled boolean not null default true;
alter table public.users add column if not exists loyalty_reward_cents integer not null default 500;
do $$ begin
  alter table public.users add constraint users_loyalty_reward_cents_check check (loyalty_reward_cents between 100 and 5000);
exception when duplicate_object then null; end $$;

-- Loyalty texts name the barber's amount instead of a fixed $5.
update public.message_templates set
  custom_message = replace(custom_message, '$5', '{amount}'),
  custom_message_es = replace(custom_message_es, '$5', '{amount}')
where template_key in ('loyalty_progress', 'loyalty_earned') and (custom_message like '%$5%' or custom_message_es like '%$5%');
