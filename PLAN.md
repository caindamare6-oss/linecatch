# PLAN.md — Stripe for LineCatch

Two jobs, one Stripe account:
- **Part A — Barbers pay LineCatch:** $49/month after a 14-day free trial.
- **Part B — Clients pay barbers (Stripe Connect):** saved card at booking, charged when the cut is done, no-show and late-cancel fees, cash-out. The 10th-cut loyalty reward comes off automatically.

## Decisions (locked)
**From the product spec (Oct 12, 2026)**
- **14-day free trial from sign-up.** No card, no SSN, no EIN to start. (Replaces the old 30-day trial that started at QR activation; QR stickers are gone.)
- Launch with the **$49/month Solo Barber plan only**. The $199 Multi-Chair Shop plan comes later.
- LineCatch **never stores card numbers**. Stripe holds every card; the app only keeps Stripe IDs.
- Clients' cards are saved at booking (Stripe SetupIntent) **only after the barber turns on no-show protection**. Barbers with it off: booking works exactly like today, no card asked.
- Cards are charged **when the cut is marked done**, or for a **no-show / late-cancel fee**.
- **Instant cash-out: 1.75% (minimum $0.50).** Standard payouts (1–2 business days) are free.
- Barbers verify their identity once, with Stripe (Connect Express onboarding), only when they turn on protection.

**Loyalty at checkout (Oct 12, 2026)**
- On a client's 10th cut, the charge is the cut price minus the reward: 50% off → half price; free → no charge at all.
- No-show and late-cancel fees never get the loyalty discount.
- The reward amount comes from `projectVisit().rewardCents` (already in the app).

**Carried over from the first plan (day numbers moved from 30 to 14)**
- Barber card is collected through a **Stripe-hosted checkout link**.
- **Trial ends with no card:** missed-call texts keep running 7 more days with an "Add your card to keep your clients" banner, then the account pauses.
- **Failed payment:** 7-day grace (Stripe retries), then pause.
- Damare can text a barber their pay link in person.
- Stripe's built-in emails on: trial ending, receipts, failed payments.

**Still to decide (ask Damare before building that task)**
- No-show fee and late-cancel fee: fixed amount, % of the cut, or the barber picks? How late is "late" (e.g. under 2 hours)?
- Who pays Stripe's card fee on client charges (barber, or added to the client's total)?
- Does LineCatch take any cut of client payments besides the 1.75% instant cash-out fee?

## Rules for every chat working on this plan
- **Test mode only** until the go-live phase. Never use or ask for live Stripe keys.
- Stripe keys and secrets live in environment variables only. Never print them, commit them, or paste them into chat or files.
- Work on the `stripe-billing` branch and deploy to a **Vercel preview only**. Never push to `main`.
- Database changes go to the **staging** Supabase project only until Damare approves going live.
- Do **one task at a time**, check it off here, and write a note in PROGRESS.md.
- If something is unclear or a decision isn't covered above, **stop and ask Damare.** Don't guess.

---

## Phase 1: Setup
- [x] Create the `stripe-billing` branch
- [x] Damare: Stripe account (test mode, EIN), test keys in Vercel preview environment variables
- [x] Install Stripe in the app with the test-keys-only lock
- [x] Bring the branch up to date with staging (14-day trial, no QR, 10-cut loyalty)
- [ ] Damare: turn on **Connect** in the Stripe dashboard (test mode, Express accounts) and set the platform branding
- [ ] Damare: add the test keys to `.env.development.local` on this computer too (so it can be tested locally)
- [ ] Create the product "LineCatch Solo" with a $49/month price (test mode)
- [ ] Database (staging): barber billing fields (Stripe customer ID, subscription ID, billing status, trial end) and Connect fields (connected account ID, payouts on, protection on)

## Phase 2 (Part A): Barber trial and paying
- [ ] At sign-up: create the barber's Stripe customer, status "trialing", trial end = sign-up + 14 days
- [ ] "Add card" flow: Stripe-hosted checkout for the $49/month plan
- [ ] Webhook: payments succeed / fail, subscription changes → barber status updates automatically
- [ ] "Manage billing" in Settings → Stripe customer portal (update card, cancel)
- [ ] Turn on Stripe's built-in emails

## Phase 3 (Part A): Reminders and pausing
- [ ] Text the pay link on trial day 10, day 13 and day 14
- [ ] Dashboard banner: "X days left in your free trial — Add card"
- [ ] Day 14 with no card: texts keep running, "Add your card to keep your clients" banner
- [ ] Day 21 with no card: pause (no outgoing texts, dashboard shows "Add card to turn LineCatch back on")
- [ ] Failed payment: 7-day grace with banner, then pause the same way
- [ ] Paused barber adds a card → everything turns back on automatically

## Phase 4 (Part B): Barbers get paid
- [ ] Settings → "No-show protection": turning it on starts Stripe Connect Express onboarding (identity + bank/debit card, done on Stripe's pages)
- [ ] Webhook: connected account updates → protection is only "on" once Stripe says the account can take charges
- [ ] Booking page: when protection is on, the client saves a card (SetupIntent, Stripe's card form) before confirming. Clear note: "You won't be charged until your cut is done."
- [ ] Mark done → charge the saved card: cut price minus the 10th-cut reward (free → no charge)
- [ ] No-show / late-cancel → charge the fee (no loyalty discount)
- [ ] Receipts by text, and payments listed on the barber's dashboard
- [ ] Payouts: standard (free) by default; "Cash out now" = instant payout, 1.75% (min $0.50)
- [ ] Landing page: take "Coming soon" off "Get paid"

## Phase 5: Test, then go live
- [ ] Test every case with Stripe test cards: trial, card added, declined, failed renewal, cancel, pause, un-pause, saved card, charge on done, 10th cut 50% and free, no-show fee, late cancel, instant cash-out
- [ ] Damare reviews the preview and approves
- [ ] Merge into `staging` and try it on a phone on the staging site
- [ ] Damare switches to live Stripe keys, database changes go to live, then merge to `main`

---

## Later (not part of this plan)
- $199/month Multi-Chair Shop plan
- Email plan (EMAIL-PLAN.md)
