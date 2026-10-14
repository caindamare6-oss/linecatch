import Stripe from "stripe";

// Live keys only on the live site (Vercel production). Staging, previews and local dev only
// ever take test keys, so testing can never charge a real card.
const TEST_KEY_PREFIXES = ["sk_test_", "rk_test_"];
const LIVE_KEY_PREFIXES = ["sk_live_", "rk_live_"];

/** Throws (for the server logs) unless the key fits where the app is running. Never shown to barbers. */
export function assertStripeKey(key: string | undefined, live = process.env.VERCEL_ENV === "production"): string {
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (TEST_KEY_PREFIXES.some((p) => key.startsWith(p))) return key;
  if (LIVE_KEY_PREFIXES.some((p) => key.startsWith(p))) {
    if (live) return key;
    throw new Error("A live Stripe key is only allowed on the live site. Use a test key (sk_test_ or rk_test_) here.");
  }
  throw new Error("STRIPE_SECRET_KEY is not a Stripe secret key (sk_ or rk_).");
}

let client: Stripe | null = null;

/** Checked on first use, not at startup or build, so a missing key only affects billing. */
export function getStripeClient(): Stripe {
  // SECRET_STRIPE_KEY is the name it was first saved under in Vercel.
  if (!client) client = new Stripe(assertStripeKey(process.env.STRIPE_SECRET_KEY || process.env.SECRET_STRIPE_KEY));
  return client;
}
