import Stripe from "stripe";

// Test mode only until Phase 5 of PLAN.md. Going live means removing this lock on purpose.
const TEST_KEY_PREFIXES = ["sk_test_", "rk_test_"];

/** Throws (for the server logs) unless the key is a Stripe test key. Never shown to barbers. */
export function assertTestKey(key: string | undefined): string {
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!TEST_KEY_PREFIXES.some((p) => key.startsWith(p))) {
    throw new Error("STRIPE_SECRET_KEY is not a Stripe test key (sk_test_ or rk_test_). Live keys are refused until Phase 5.");
  }
  return key;
}

let client: Stripe | null = null;

/** Checked on first use, not at startup or build, so a missing key only affects billing. */
export function getStripeClient(): Stripe {
  if (!client) client = new Stripe(assertTestKey(process.env.STRIPE_SECRET_KEY));
  return client;
}
