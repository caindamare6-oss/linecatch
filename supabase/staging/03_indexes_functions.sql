CREATE INDEX bookings_group_id_idx ON public.bookings USING btree (group_id) WHERE (group_id IS NOT NULL);
CREATE INDEX bookings_service_id_idx ON public.bookings USING btree (service_id);
CREATE UNIQUE INDEX bookings_user_time_confirmed_uniq ON public.bookings USING btree (user_id, booking_time) WHERE (status = 'confirmed'::text);
CREATE INDEX bookings_user_time_idx ON public.bookings USING btree (user_id, booking_time);
CREATE INDEX client_sessions_client_idx ON public.client_sessions USING btree (user_id, phone_number);
CREATE INDEX client_sessions_expires_idx ON public.client_sessions USING btree (expires_at);
CREATE INDEX idx_activity_feed_user_created ON public.activity_feed USING btree (user_id, created_at DESC);
CREATE INDEX idx_missed_calls_user_time ON public.missed_calls USING btree (user_id, received_at DESC);
CREATE INDEX idx_sms_log_to_number ON public.sms_log USING btree (to_number, created_at DESC);
CREATE INDEX idx_sms_log_user_created ON public.sms_log USING btree (user_id, created_at DESC);
CREATE INDEX idx_sms_log_user_from ON public.sms_log USING btree (user_id, from_number, created_at DESC) WHERE (direction = 'inbound'::text);
CREATE INDEX idx_sticker_codes_owner ON public.sticker_codes USING btree (owner_user_id) WHERE (owner_user_id IS NOT NULL);
CREATE INDEX idx_sticker_codes_status ON public.sticker_codes USING btree (status);
CREATE INDEX idx_sticker_scans_code ON public.sticker_scans USING btree (code);
CREATE INDEX idx_users_tracking ON public.users USING btree (tracking_number) WHERE (tracking_number IS NOT NULL);
CREATE INDEX idx_vip_clients_phone_optin ON public.vip_clients USING btree (phone_number, is_opted_in);
CREATE INDEX loyalty_rewards_user_idx ON public.loyalty_rewards USING btree (user_id, created_at);
CREATE INDEX phone_numbers_free_idx ON public.phone_numbers USING btree (area_code) WHERE (assigned_user_id IS NULL);
CREATE INDEX portfolio_photos_user_idx ON public.portfolio_photos USING btree (user_id, sort_order);
CREATE INDEX referrals_referrer_idx ON public.referrals USING btree (referrer_user_id);
CREATE INDEX services_user_id_idx ON public.services USING btree (user_id);
CREATE INDEX sticker_codes_handed_out_idx ON public.sticker_codes USING btree (handed_out_at) WHERE (handed_out_at IS NOT NULL);
CREATE UNIQUE INDEX users_referral_code_key ON public.users USING btree (upper(referral_code)) WHERE (referral_code IS NOT NULL);
CREATE UNIQUE INDEX users_slug_key ON public.users USING btree (slug) WHERE (slug IS NOT NULL);

CREATE OR REPLACE FUNCTION public.start_trial_from_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.delivered_at is not null and old.delivered_at is null then
    new.trial_starts_at := new.delivered_at + interval '24 hours';
    new.trial_ends_at   := new.delivered_at + interval '24 hours' + interval '14 days';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.loyalty_cuts_until_next(p_cut_count integer, p_claimed boolean)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT p_claimed AND p_cut_count < 1 THEN RETURN 1 - p_cut_count; END IF;
  IF p_cut_count < 4 THEN RETURN 4 - p_cut_count; END IF;
  RETURN (3 - ((p_cut_count - 1) % 3)) % 3;
END;
$function$;

CREATE OR REPLACE FUNCTION public.loyalty_add_stamp(p_user_id uuid, p_phone text, p_date date)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update vip_clients
  set cut_count = coalesce(cut_count, 0) + 1,
      last_cut_date = p_date
  where user_id = p_user_id and phone_number = p_phone
  returning cut_count;
$function$;

CREATE OR REPLACE FUNCTION public.loyalty_discount_due(p_cut_count integer, p_claimed boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_cut_count = 1 AND NOT p_claimed THEN RETURN true; END IF;
  IF p_cut_count >= 4 AND (p_cut_count - 1) % 3 = 0 THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

CREATE TRIGGER trg_start_trial_from_delivery BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.start_trial_from_delivery();
