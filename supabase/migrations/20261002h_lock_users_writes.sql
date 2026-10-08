-- Barbers could edit their own users row straight through the public API (anon key + their session):
-- plan, trial dates, lockout, their LineCatch number, referral fields. Every legitimate write goes
-- through the server with the service role, so the browser keeps read access only.
revoke insert, update, delete on table public.users from anon, authenticated;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;

-- Same for the sticker, referral and credit tables: read your own, never write from the browser.
revoke insert, update, delete on table public.sticker_codes from anon, authenticated;
revoke insert, update, delete on table public.referrals from anon, authenticated;
revoke insert, update, delete on table public.billing_credits from anon, authenticated;
