-- Loyalty v3: a 10-cut punch card. Every 10th cut is 50% off (default) or free, the barber's pick.
-- Clients get one text, after their 9th cut. Cut counts carry over.
alter table public.users add column if not exists loyalty_reward_type text not null default 'half';
do $$ begin
  alter table public.users add constraint users_loyalty_reward_type_check check (loyalty_reward_type in ('half', 'free'));
exception when duplicate_object then null; end $$;
-- loyalty_reward_cents (the old dollars-off amount) is left in place, unused.

-- The one loyalty text: "your next cut is 50% off / free".
update public.message_templates
set custom_message = 'Thanks for coming in. Your next cut at {shop_name} is {amount}. Book it here: {link}',
    custom_message_es = 'Gracias por venir. Tu próximo corte en {shop_name} va {amount_es}. Resérvalo aquí: {link}'
where user_id is null and template_key = 'loyalty_progress';
-- A barber's own copy of it: the fill-in is now the whole reward ("50% off"), not a dollar amount.
update public.message_templates
set custom_message = replace(custom_message, '{amount} off', '{amount}'),
    custom_message_es = replace(replace(custom_message_es, '{amount} de descuento', '{amount_es}'), '{amount}', '{amount_es}')
where user_id is not null and template_key = 'loyalty_progress';
-- No more "reward used" text.
delete from public.message_templates where template_key = 'loyalty_earned';
