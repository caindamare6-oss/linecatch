# Launch checklist

## 1. Database (Supabase SQL editor or `supabase db push`), in order
- `20261002_client_sessions.sql`
- `20261002b_sms_log_inbound.sql`
- `20261002c_contact_notes.sql`
- `20261002d_sms_marketing.sql`
- `20261002e_referrals.sql`
- `20261002f_winback_copy.sql`
- `20261002g_sticker_handout.sql`
- `20261004_call_mode_number_pool.sql`: forwarded-calls mode and the phone-number pool.
- `20261005_missed_call_style_short_links.sql`: missed-call text style and short links.
- `20261005b_carrier.sql`: the barber's cell carrier (one-tap forwarding code).
- `20261006_loyalty_settings.sql`: loyalty on/off and amount per barber.
- `20261002h_lock_users_writes.sql`: security fix, stops barbers editing their own plan,
  trial or lockout from the browser. Run this one even if nothing else ships.

Check afterwards: `select count(*) from information_schema.table_privileges where table_name='users' and grantee='authenticated' and privilege_type='UPDATE';` returns 0.

## 2. Environment (Vercel → Settings → Environment Variables)
Everything in `.env.example`. Must-haves: `NEXT_PUBLIC_APP_URL` (the live domain, it's printed
into every QR sticker), Supabase keys, Twilio SID/token, `CRON_SECRET`, `ADMIN_USER_IDS` (your
own user id, for hand-out mode). `SMS_DEV_MODE` and `ALLOW_TIME_TRAVEL` must be unset.

## 3. Supabase Auth → URL configuration
Redirect URLs: add `https://www.linecatch.app/auth/callback**` (with `**`). Sign-in links carry the
referral code and sticker code as query parameters; without the wildcard they're rejected.

## 4. Vercel cron
`vercel.json` runs crons every 15 minutes and hourly. That needs a paid Vercel plan (Pro).
On the free Hobby plan Vercel **rejects the deploy** when a cron runs more than once a day,
so upgrade before deploying this branch.

## 5. Twilio
- Set `TWILIO_MESSAGING_SERVICE_SID` in Vercel (your A2P Messaging Service, `MG…`). New barber numbers join it.
- In that Messaging Service → Integration, choose **"Defer to sender's webhook"** so texts to each number still reach
  `/api/twilio/sms`.
- Barbers get a number automatically once setup, cell, services, hours and a portfolio photo are done. Freed numbers
  are reused after 30 days, never released (founder page → Twilio → Number pool).
- Each barber's LineCatch number: Messaging webhook `POST https://www.linecatch.app/api/twilio/sms`,
  Voice webhook `POST https://www.linecatch.app/api/twilio/voice`.
- A2P 10DLC registration for the brand/campaign before marketing texts (US carriers block
  unregistered traffic).

## 6. Before going door to door
1. Admin → Stickers → Generate a batch (label it, e.g. "Dorchester run 1"). The page shows the URL the
   QR codes open; it must be the live domain.
2. Download the batch ZIP and print (1800×2400 px, English + Spanish).
3. Scan one printed sticker with your phone before printing the rest: it should open
   "Set up your shop in 2 minutes".
4. In each shop: scan the sticker while signed in as admin, type the shop name, save, hand it over.
   The barber scans it, signs up, enters name + cell, done. Admin → Stickers → "Door to door"
   shows who hasn't finished setup.

## 7. Smoke test after deploy
- Book from `/book/<your id>` with your own phone: confirmation text arrives.
- Call your LineCatch number and don't answer: missed-call text with a booking link arrives.
- Text STOP: no further texts; text START: back on.
