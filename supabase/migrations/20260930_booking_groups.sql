-- Group bookings: one row per person, linked by group_id.
alter table bookings add column if not exists group_id uuid;
create index if not exists bookings_group_id_idx on bookings(group_id) where group_id is not null;

-- "You're in, party of 3." in the default confirmation text.
update message_templates
set custom_message = replace(custom_message, 'You''re in.', 'You''re in{party}.')
where user_id is null and template_key = 'booking_confirm' and custom_message not like '%{party}%';

update message_templates
set custom_message_es = replace(custom_message_es, 'Listo.', 'Listo{party_es}.')
where user_id is null and template_key = 'booking_confirm' and custom_message_es not like '%{party_es}%';
