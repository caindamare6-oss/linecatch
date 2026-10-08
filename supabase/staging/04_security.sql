alter table public.activity_feed enable row level security;
alter table public.billing_credits enable row level security;
alter table public.booking_reminders enable row level security;
alter table public.bookings enable row level security;
alter table public.client_sessions enable row level security;
alter table public.contacts enable row level security;
alter table public.link_clicks enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.message_templates enable row level security;
alter table public.missed_calls enable row level security;
alter table public.missed_calls_log enable row level security;
alter table public.opt_outs enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.portfolio_photos enable row level security;
alter table public.referrals enable row level security;
alter table public.services enable row level security;
alter table public.short_links enable row level security;
alter table public.sms_log enable row level security;
alter table public.sticker_codes enable row level security;
alter table public.sticker_scans enable row level security;
alter table public.users enable row level security;
alter table public.vip_clients enable row level security;
alter table public.visit_closeouts enable row level security;

create policy "Users see own activity" on public.activity_feed as PERMISSIVE for ALL to public using ((auth.uid() = user_id));
create policy "Barbers see own credits" on public.billing_credits as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy "Barbers view own reminders" on public.booking_reminders as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1 FROM bookings b WHERE ((b.id = booking_reminders.booking_id) AND (b.user_id = auth.uid())))));
create policy "Barbers view own bookings" on public.bookings as PERMISSIVE for ALL to public using ((auth.uid() = user_id));
create policy "Users can delete own contacts" on public.contacts as PERMISSIVE for DELETE to public using ((user_id = auth.uid()));
create policy "Users can insert own contacts" on public.contacts as PERMISSIVE for INSERT to public with check ((user_id = auth.uid()));
create policy "Users can update own contacts" on public.contacts as PERMISSIVE for UPDATE to public using ((user_id = auth.uid()));
create policy "Users can view own contacts" on public.contacts as PERMISSIVE for SELECT to public using ((user_id = auth.uid()));
create policy clicks_select_own on public.link_clicks as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1 FROM missed_calls_log WHERE ((missed_calls_log.call_id = link_clicks.call_id) AND (missed_calls_log.user_id = auth.uid())))));
create policy "Barbers view own loyalty rewards" on public.loyalty_rewards as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy "barber manages own templates" on public.message_templates as PERMISSIVE for ALL to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "barber reads own missed calls" on public.missed_calls as PERMISSIVE for SELECT to public using ((user_id = auth.uid()));
create policy calls_select_own on public.missed_calls_log as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy optouts_select_own on public.opt_outs as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy "Barbers view own portfolio photos" on public.portfolio_photos as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy "Barbers see referrals they made" on public.referrals as PERMISSIVE for SELECT to public using ((auth.uid() = referrer_user_id));
create policy "Barbers manage own services" on public.services as PERMISSIVE for ALL to public using ((auth.uid() = user_id));
create policy "Barbers read own sms log" on public.sms_log as PERMISSIVE for SELECT to public using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Barbers can read their own sticker codes" on public.sticker_codes as PERMISSIVE for SELECT to public using ((owner_user_id = auth.uid()));
create policy "Barbers can read scans for their own codes" on public.sticker_scans as PERMISSIVE for SELECT to public using ((code IN ( SELECT sticker_codes.code FROM sticker_codes WHERE (sticker_codes.owner_user_id = auth.uid()))));
create policy users_select_own on public.users as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy "Barbers can view their own VIP optins" on public.vip_clients as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));

-- Server only, as on live.
revoke all on table public.phone_numbers from anon, authenticated;
revoke all on table public.short_links from anon, authenticated;
revoke execute on function public.loyalty_add_stamp(uuid, text, date) from public, anon, authenticated;

-- The users-table security fix (20261002h_lock_users_writes), which the app expects.
revoke insert, update, delete on table public.users from anon, authenticated;
revoke insert, update, delete on table public.sticker_codes from anon, authenticated;
revoke insert, update, delete on table public.referrals from anon, authenticated;
revoke insert, update, delete on table public.billing_credits from anon, authenticated;
