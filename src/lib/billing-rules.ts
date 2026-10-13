/**
 * Money rules for Stripe (PLAN.md), kept free of Stripe and the database so they're easy to test.
 */

/** Solo Barber plan. The Stripe price is found (or made) by this lookup key. */
export const SOLO_PRICE_CENTS = 4900;
export const SOLO_PRICE_LOOKUP_KEY = "linecatch_solo_monthly";

export const TRIAL_DAYS = 14;
/** After the trial with no card (or a failed payment), texts keep running this long, then pause. */
export const GRACE_DAYS = 7;
/**
 * Nobody is asked for a card during the trial. Pay-link texts go out once it's over: the day it
 * ends, then 3 and 6 days later (texting pauses on day 7).
 */
export const CARD_TEXT_DAYS = [0, 3, 6] as const;

export type BillingStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";

const DAY = 86_400_000;

/** Whole days left in the trial (0 on the last day, negative once it's over). */
export function trialDaysLeft(trialEndsAt: string | Date | null, now = Date.now()): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt).getTime() - now) / DAY);
}

/** Whole days since the trial ended (0 on the day it ends, negative while it's still running). */
export function daysSinceTrialEnd(trialEndsAt: string | Date, now = Date.now()): number {
  return Math.floor((now - new Date(trialEndsAt).getTime()) / DAY);
}

/**
 * What the barber's account should be right now. A barber with a working card is "active";
 * the trial and grace windows come from the dates; "paused" turns texting off.
 */
export function billingState(
  u: { billing_status: BillingStatus; trial_ends_at: string | null; billing_grace_until: string | null; stripe_subscription_id: string | null },
  now = Date.now()
): { status: BillingStatus; shouldPause: boolean; banner: "trial" | "add_card" | "past_due" | "paused" | null; daysLeft: number | null } {
  const daysLeft = trialDaysLeft(u.trial_ends_at, now);
  if (u.billing_status === "active") return { status: "active", shouldPause: false, banner: null, daysLeft: null };

  if (u.billing_status === "past_due") {
    const graceOver = !!u.billing_grace_until && new Date(u.billing_grace_until).getTime() <= now;
    return { status: graceOver ? "paused" : "past_due", shouldPause: graceOver, banner: graceOver ? "paused" : "past_due", daysLeft };
  }

  if (u.billing_status === "paused" || u.billing_status === "canceled") return { status: u.billing_status, shouldPause: true, banner: "paused", daysLeft };

  // Trialing. A card on file during the trial: the subscription starts itself at trial end.
  if (u.stripe_subscription_id) return { status: "trialing", shouldPause: false, banner: null, daysLeft };
  // During the trial: no card prompts at all.
  if (daysLeft === null || daysLeft > 0) return { status: "trialing", shouldPause: false, banner: null, daysLeft };
  // Trial over, no card: texts keep going for the grace days, then pause.
  const pastTrial = -daysLeft;
  if (pastTrial < GRACE_DAYS) return { status: "trialing", shouldPause: false, banner: "add_card", daysLeft };
  return { status: "paused", shouldPause: true, banner: "paused", daysLeft };
}

/** Maps a Stripe subscription status onto ours. */
export function fromStripeStatus(s: string): BillingStatus {
  if (s === "active") return "active";
  if (s === "trialing") return "trialing";
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "past_due";
  if (s === "paused") return "paused";
  return "canceled";
}

// ── Part B: client payments ──

/** Late cancel: less than this many hours before the appointment. */
export const LATE_CANCEL_HOURS = 2;
export const MIN_FEE_PERCENT = 10;
export const MAX_FEE_PERCENT = 100;
export const DEFAULT_FEE_PERCENT = 50;
/** Stripe can't charge less than 50¢. */
export const MIN_CHARGE_CENTS = 50;

export function isLateCancel(bookingTime: string | Date, now = Date.now()): boolean {
  const start = new Date(bookingTime).getTime();
  return start > now && start - now < LATE_CANCEL_HOURS * 3_600_000;
}

/** The cut price minus the 10th-cut reward. Free (or under Stripe's 50¢) → nothing to charge. */
export function cutChargeCents(priceCents: number, rewardCents: number): number {
  const due = Math.max(Math.round(priceCents) - Math.max(Math.round(rewardCents), 0), 0);
  return due < MIN_CHARGE_CENTS ? 0 : due;
}

/** No-show / late-cancel fee: the barber's % of the cut price, never the loyalty discount. */
export function noShowFeeCents(priceCents: number, percent: number): number {
  const p = Math.min(Math.max(Math.round(percent), MIN_FEE_PERCENT), MAX_FEE_PERCENT);
  const fee = Math.round((Math.max(priceCents, 0) * p) / 100);
  return fee < MIN_CHARGE_CENTS ? 0 : fee;
}

/** Instant cash-out: 1.75%, at least $0.50. Standard payouts are free. */
export const INSTANT_FEE_BPS = 175;
export const INSTANT_FEE_MIN_CENTS = 50;

export function instantPayoutFeeCents(amountCents: number): number {
  return Math.max(Math.round((amountCents * INSTANT_FEE_BPS) / 10_000), INSTANT_FEE_MIN_CENTS);
}

/** What lands on their debit card after the fee (0 if the balance can't cover the fee). */
export function instantPayoutNetCents(availableCents: number): { amount: number; fee: number } {
  if (availableCents <= INSTANT_FEE_MIN_CENTS) return { amount: 0, fee: 0 };
  const fee = instantPayoutFeeCents(availableCents);
  const amount = availableCents - fee;
  return amount > 0 ? { amount, fee } : { amount: 0, fee: 0 };
}
