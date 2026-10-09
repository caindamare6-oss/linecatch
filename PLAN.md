# PLAN.md — Stripe billing for LineCatch

## Goal
Barbers can pay for LineCatch by card after their 30-day free trial, and the app always knows who has paid.

## Decisions (locked)
- Launch with the **$49/month solo plan only**. The $199 shop plan comes later, once shop features exist.
- **30-day free trial, no card at signup.** The trial starts when the barber activates (scans and claims) their QR sticker while signed in.
- Card is collected near the end of the trial through a **Stripe-hosted checkout link** (Stripe handles all card data; the app never sees card numbers).
- **Trial ends with no card:** missed-call texts keep running for 7 more days with a "Add your card to keep your clients" banner, then the account pauses.
- **Failed payment:** 7-day grace period (Stripe retries the card), then the account pauses.
- **In person:** Damare can text the barber their pay link on the spot so they enter their card while he's there.
- Stripe's built-in emails are turned on: trial-ending reminders, receipts, failed-payment notices.

## Rules for every chat working on this plan
- **Test mode only** until Phase 5. Never use or ask for live Stripe keys.
- Stripe keys and secrets live in environment variables only. Never print them, commit them, or paste them into files.
- Work on the `stripe-billing` branch (made from `staging`) and deploy to a **Vercel preview only**. Never push to `main` or the live site (www.linecatch.app). Follow docs/STAGING.md for how changes go out.
- Database changes go to the **staging** Supabase project (`linecatch-staging`) only. Never change the live database until Damare approves in Phase 5.
- Do **one task at a time**, check it off here, and write a note in PROGRESS.md.
- If something is unclear or a decision isn't covered above, **stop and ask Damare.** Don't guess.

---

## Phase 1: Setup
- [x] Create a new branch: `stripe-billing` (made from `staging`)
- [ ] Damare: create Stripe account using the EIN, stay in test mode, add test keys to Vercel preview environment variables
- [ ] Install Stripe in the app and connect it with the test keys
- [ ] Create the product "LineCatch Solo" with a $49/month price in Stripe (test mode)
- [ ] Add billing fields to each barber in Supabase: Stripe customer ID, subscription ID, billing status (trialing / active / past_due / paused / canceled), trial end date

## Phase 2: Trial
- [ ] When a barber activates their QR, create their Stripe customer and start a 30-day trial with no card required
- [ ] Save the trial end date and set status to "trialing"

## Phase 3: Paying
- [ ] Build the "Add card" flow: opens Stripe's hosted checkout page for that barber
- [ ] Set up the Stripe webhook so Stripe tells the app when payments succeed, fail, or subscriptions change, and the barber's status updates automatically
- [ ] Add "Manage billing" in Settings that opens Stripe's customer portal (update card, cancel)
- [ ] Turn on Stripe's built-in emails (trial ending, receipts, failed payments)

## Phase 4: Reminders and pausing
- [ ] Text the pay link on trial day 23, day 28, and day 30
- [ ] Dashboard banner: "X days left in your free trial — Add card"
- [ ] Day 30 with no card: keep missed-call texts running, show "Add your card to keep your clients" banner
- [ ] Day 37 with no card: pause the account (no outgoing texts, dashboard shows "Add card to turn LineCatch back on")
- [ ] Failed payment: 7-day grace with banner, then pause the same way
- [ ] When a paused barber adds a card, turn everything back on automatically

## Phase 5: Test, then go live
- [ ] Test every case with Stripe test cards: trial start, card added, card declined, failed renewal, cancel, pause, un-pause
- [ ] Damare reviews the preview and approves
- [ ] Merge into `staging` and try it on a phone on the staging site
- [ ] Damare switches to live Stripe keys, database change goes to live, then merge to `main`

---

## Later (not part of this plan)
- $199/month shop plan
- Email plan (EMAIL-PLAN.md)
