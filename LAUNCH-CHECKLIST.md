# LineCatch launch checklist

Do these in order. Nothing goes live until step 4, when you say "merge staging into main".

## 1. Before launch (you)

- [ ] **Call forwarding on your phone (T-Mobile).** Dial `**004*18575052551**10#` and press call.
  Check it anytime with `*#004#`. It stays on until you dial `##004#`, reset network settings,
  or change SIM/eSIM. Test: have someone call your cell, decline, and you should get the text within seconds.
- [x] **A2P texting registration:** approved. Check the campaign's use case covers marketing
  ("Mixed" or "Marketing") since broadcasts send openings and deals. If it's only customer care /
  notifications, add a marketing campaign or skip broadcasts at launch. If Twilio lets you edit the
  opt-in description, use the wording below (booking line + optional box, no review requests).
- [ ] **Twilio:** turn on auto-recharge (each new barber's number is about $1.15/month).
  Make sure `TWILIO_MESSAGING_SERVICE_SID` is set in Vercel (Production) so new numbers join your A2P campaign.
- [ ] **Vercel env:** live Supabase keys are set for "Production and Preview". Set them for Production only,
  and give Preview the staging keys, so test builds never touch live data or send real texts.
- [ ] **Stripe:**
  - Billing webhook (`linecatch-billing-preview`): add the event `invoice.paid` (referral rewards need it).
  - Settings → Business → Public details: change "Damare Cain" to **LineCatch**, add your logo.

## 2. Test on staging (you + me)

- [ ] Sign up a new test barber: shop name + cell → number assigned → forwarding screen.
- [ ] Book from the shop page: 1 person, then a group of 2 with different cuts.
- [ ] Optional "openings and deals" box: ticked once, unticked once. Broadcast count should only include the ticked one.
- [ ] Manage link: reschedule, then cancel.
- [ ] Mark a booking done from the schedule.
- [ ] Billing: add card (Stripe test card 4242 4242 4242 4242), then Manage billing.
- [ ] Referral: open your `/join/CODE` link logged out, see the 50% banner, sign up a second test barber,
  add a card, and check Stripe shows 50% off their first month.

(Staging uses fake 555 numbers, so real texts are only tested on live.)

## 3. Switch to live keys (you)

- [ ] Stripe live keys in Vercel (Production), and remove the test-key lock.
- [ ] Two Stripe live webhooks pointing at `https://www.linecatch.app/api/stripe/webhook`:
  billing (checkout, subscription, `invoice.paid`) and Connect (account, payout).

## 4. Go live (me, when you say "merge staging into main")

- [ ] Apply the 3 database updates to live: `20261012_spec_phase1.sql`, `20261012b_loyalty_ten_cut_card.sql`, `20261012c_stripe.sql`.
- [ ] Exempt current live barbers from the new 14-day trial and pause rules.
- [ ] Merge staging into main.
- [ ] Real test: call your cell from another phone, decline, get the text, book through the link,
  get the confirmation text.

## Not needed for launch

Card on file / no-show protection is built but switched off (`CLIENT_PAYMENTS` in `src/lib/config.ts`).
Turning it on later is one line plus the Connect webhook.

---

## A2P campaign wording (paste into Twilio)

**Campaign description**
LineCatch texts customers of independent barbershops. When a shop misses a customer's call, the
customer gets one text with a link to book. Customers who book get a confirmation and appointment
reminders. Customers can optionally tick a box when booking to get occasional openings and deals.

**How customers opt in**
1. A customer calls the barbershop's number and the call goes unanswered; they get one reply text with a booking link (customer-initiated).
2. On the booking page, next to the Book button: "By booking, you agree to get texts from this shop
   about your appointments (confirmations and reminders). Msg frequency varies. Msg & data rates may
   apply. Reply STOP to opt out, HELP for help." with links to the Privacy Policy and Terms.
3. Openings and deals: a separate, unticked, optional checkbox: "Also text me openings and deals from
   this shop (optional). Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out."

Privacy policy: https://www.linecatch.app/privacy · Terms: https://www.linecatch.app/terms

**Sample messages**
1. FREELY SHOP: Hey, sorry I missed you! I'm with a client right now. Grab a spot here: https://www.linecatch.app/c/abc123 Reply STOP to opt out.
2. FREELY SHOP: You're booked for Full Service on Friday at 3:30 PM. Need to change it? https://www.linecatch.app/manage/abc123
3. FREELY SHOP: Reminder: your appointment is tomorrow at 3:30 PM. See you then!
4. FREELY SHOP: Openings today at 2 PM and 4:30 PM. Book here: https://www.linecatch.app/freely-shop Reply STOP to opt out.
