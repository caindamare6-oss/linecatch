-- The missed-call Casual and Professional wording become default texts the founder can edit on
-- Admin → Texts (they were fixed in the code). Same wording as before.
insert into public.message_templates (user_id, template_key, custom_message, custom_message_es)
select null, 'missed_call_casual',
  'Hey, sorry I missed you! I''m with a client right now. Grab a spot here: {link}',
  '¡Hola, perdón que no pude contestar! Estoy con un cliente ahora. Aparta tu cita aquí: {link}'
where not exists (select 1 from public.message_templates where user_id is null and template_key = 'missed_call_casual');

insert into public.message_templates (user_id, template_key, custom_message, custom_message_es)
select null, 'missed_call_professional',
  'Thank you for calling. I''m with a client and can''t answer right now. You can book your appointment here: {link}',
  'Gracias por llamar. Estoy con un cliente y no puedo contestar ahora. Puedes reservar tu cita aquí: {link}'
where not exists (select 1 from public.message_templates where user_id is null and template_key = 'missed_call_professional');
