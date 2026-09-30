-- Run AFTER the code that fills {party}, {reward}, {cuts}, {next_cut} is deployed.

-- "You're in, party of 3." in the default confirmation text.
update message_templates
set custom_message = replace(custom_message, 'You''re in.', 'You''re in{party}.')
where user_id is null and template_key = 'booking_confirm' and custom_message not like '%{party}%';

update message_templates
set custom_message_es = replace(custom_message_es, 'Listo.', 'Listo{party_es}.')
where user_id is null and template_key = 'booking_confirm' and custom_message_es not like '%{party_es}%';

-- Client-facing reward line on confirmation + 2-hour reminder.
update message_templates
set custom_message = replace(custom_message, '{time}. If', '{time}.{reward} If')
where user_id is null and template_key = 'booking_confirm' and custom_message not like '%{reward}%';

update message_templates
set custom_message_es = replace(custom_message_es, '{time}. Si', '{time}.{reward_es} Si')
where user_id is null and template_key = 'booking_confirm' and custom_message_es not like '%{reward_es}%';

update message_templates
set custom_message = replace(custom_message, 'at {time}.', 'at {time}.{reward}')
where user_id is null and template_key = 'reminder_2h' and custom_message not like '%{reward}%';

update message_templates
set custom_message_es = replace(custom_message_es, 'las {time}.', 'las {time}.{reward_es}')
where user_id is null and template_key = 'reminder_2h' and custom_message_es not like '%{reward_es}%';

-- Progress text named the wrong cut ("1 more cuts and the next one's $5 off" pointed one visit late).
update message_templates
set custom_message = 'That''s {cuts} cuts. Cut #{next_cut} is $5 off.',
    custom_message_es = 'Llevas {cuts} cortes. El corte #{next_cut} lleva $5 de descuento.'
where user_id is null and template_key = 'loyalty_progress';

update message_templates
set custom_message = 'Your $5 off was applied today. Cut #{next_cut} is your next one.',
    custom_message_es = 'Hoy se aplicaron tus $5 de descuento. El próximo es en el corte #{next_cut}.'
where user_id is null and template_key = 'loyalty_earned';
