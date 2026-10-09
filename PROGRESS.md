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
