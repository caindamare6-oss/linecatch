# PROGRESS.md — Stripe billing for LineCatch

Notes from each chat, newest at the bottom. The builder writes what it changed and how to test it. The planner writes review results and any fixes the builder needs to make.

---

## 2026-10-09 — Setup
- Created the `stripe-billing` branch from `staging`.
- Added PLAN.md and this file.
- **Next task:** Damare creates the Stripe account (test mode) using the EIN and adds the test keys to Vercel's preview environment variables. The builder can't do this one. Once done, the builder starts on "Install Stripe in the app."

## 2026-10-09 — Stripe keys added (Damare)
- Damare says the Stripe test keys are in Vercel's preview environment variables as `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. The builder can't see Vercel, so this is Damare's confirmation, not a check.

## 2026-10-09 — Install Stripe (builder)
**What changed**
- Added the `stripe` package (v23.0.0).
- New `src/lib/stripe.ts`: `getStripeClient()` sets up Stripe from `STRIPE_SECRET_KEY`. The key is checked only the first time the app actually talks to Stripe, not at startup or build, so a missing key can't break non-billing pages.
- **Test-mode safety lock:** only keys starting with `sk_test_` or `rk_test_` are accepted. A live key, any other kind of key, or a missing key throws an error that goes to the server logs only. Barbers never see it.
- **Phase 5: this lock must be removed on purpose** (the `TEST_KEY_PREFIXES` check in `src/lib/stripe.ts`) when switching to live keys. Until then, a live key will be refused. That's expected, not a bug.
- `.env.example`: added the two Stripe variable names (no values).
- New test `src/__tests__/stripe-key.test.ts`: test keys accepted, live and other keys refused, missing key refused.
- Nothing calls Stripe yet, so barbers see no change.

**How to test**
- Unit tests: `npx vitest run` → 24 test files, 238 tests, all passed (includes the 3 new Stripe lock tests).
- Type check: `npx tsc --noEmit` → no errors.
- Build: `npm run build` → succeeded.

**Anything that broke**
- Nothing in the app. The first build failed because the local `.next` cache folder had leftover files from another branch (missing routes like `api/followup`). Moving that cache aside and rebuilding fixed it. It wasn't related to Stripe.
- `.env.local` has no Stripe keys, so the app can't talk to Stripe locally yet. That doesn't matter for this task. The next task (creating the product) will need the keys locally or on the Vercel preview.

**Next task:** Create the product "LineCatch Solo" with a $49/month price in Stripe (test mode).

## 2026-10-12 — Caught up with staging, plan rewritten (planner)
- Merged `staging` into `stripe-billing`: spec phase 1 (14-day trial from sign-up, 60-second sign-up, no QR stickers, no reviews, no portfolio photos) and the 10-cut loyalty card. 224 tests pass, type check clean.
- PLAN.md rewritten for the new spec: Part A (barbers pay $49/month after 14 days) and Part B (Stripe Connect: clients' saved cards, charge on done, no-show/late-cancel fees, instant cash-out 1.75% min $0.50). The 10th-cut reward comes off the charge automatically.
- Open questions for Damare are listed under "Still to decide" in PLAN.md.
- **Next task:** Damare turns on Connect in the Stripe dashboard (test mode) and adds the test keys to `.env.development.local`.

## 2026-10-12 — Stripe Part A + Part B built (builder)
**What changed**
- `supabase/migrations/20261012c_stripe.sql`: barber billing + Connect fields on `users`; new tables `booking_payments` (one row per booking with a saved card; barbers read-only), `payouts`, `stripe_events` (webhook de-dupe). Only Stripe IDs are stored, never card numbers. **Written, not applied yet.**
- `src/lib/billing-rules.ts` (pure, tested): trial/grace/pause logic, cut charge minus loyalty reward, no-show fee %, late cancel = under 2 hours, instant cash-out 1.75% (min $0.50).
- Part A: `src/lib/stripe-billing.ts` + `/api/billing/checkout`, `/api/billing/portal`. The $49 price is found or created by lookup key. Adding a card during the trial keeps the trial (first charge at trial end).
- Part B: `src/lib/stripe-connect.ts` + `/api/connect/onboard|status|cashout|dashboard`, `/api/bookings/card-setup`. Express accounts, direct charges on the barber's account (barber pays Stripe's card fee; no LineCatch cut). Instant cash-out takes LineCatch's fee by account debit, then pays out.
- `/api/stripe/webhook`: subscription + account + payout events, de-duplicated.
- `/api/cron/billing` (hourly, in vercel.json): trial texts at 10 AM on days 10/13/14, pauses after the 7-day grace.
- Booking page: Stripe card form when protection is on; booking API refuses without a saved card. Manage page: late cancel allowed with a saved card, with the fee shown first.
- Done → charge (minus 10th-cut reward). No-show → fee (refund first if it was charged). Client late cancel → fee.
- Settings: Billing and Payments sections. Home: trial / add card / past due / paused banner. EN + ES text.

**How to test**
- `npx vitest run` → all pass (13 new billing tests). `npx tsc --noEmit` clean. `npm run build` OK.
- End-to-end needs: the migration on staging, Connect turned on, test keys in `.env.development.local`, and the two webhook secrets.

**Next task:** Damare approves the staging migration, turns on Connect, adds the webhook endpoints. Then Phase 5 testing with Stripe test cards.
