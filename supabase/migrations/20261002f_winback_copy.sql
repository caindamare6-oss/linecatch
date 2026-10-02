-- Re-engagement now continues every 4 weeks until the client opts out, so the last rung of the
-- ladder can't say "Last one from me". Only the shared defaults are updated (barber overrides stay).
update message_templates
set custom_message = '{shop_name}. Door''s always open. Grab a spot whenever you''re ready: {link}',
    custom_message_es = '{shop_name}. Aquí estamos cuando quieras. Reserva tu turno: {link}',
    updated_at = now()
where user_id is null and template_key = 'winback_final';

update message_templates
set custom_message = '{shop_name}. {offer} on your next cut if you want back in: {link}',
    custom_message_es = '{shop_name}. {offer} en tu próximo corte si quieres volver: {link}',
    updated_at = now()
where user_id is null and template_key = 'winback_final_offer';

-- "That's 1 cuts." after a first visit: wording that reads right for any count.
update message_templates
set custom_message = 'Cuts so far: {cuts}. Cut #{next_cut} is $5 off.',
    custom_message_es = 'Cortes hasta ahora: {cuts}. El corte #{next_cut} lleva $5 de descuento.',
    updated_at = now()
where user_id is null and template_key = 'loyalty_progress';
