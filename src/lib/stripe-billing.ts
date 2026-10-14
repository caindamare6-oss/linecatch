import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERRAL_PERCENT_OFF, appUrl } from "@/lib/config";
import { SOLO_PRICE_CENTS, SOLO_PRICE_LOOKUP_KEY, fromStripeStatus, GRACE_DAYS, type BillingStatus } from "@/lib/billing-rules";

type Admin = ReturnType<typeof createAdminClient>;

/** The $49/month Solo price. Made in Stripe the first time it's needed, then found by lookup key. */
export async function soloPriceId(stripe: Stripe = getStripeClient()): Promise<string> {
  const found = await stripe.prices.list({ lookup_keys: [SOLO_PRICE_LOOKUP_KEY], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const product = await stripe.products.create({ name: "LineCatch Solo", description: "Missed-call texts, booking link, reminders and loyalty for one barber." });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: SOLO_PRICE_CENTS,
    recurring: { interval: "month" },
    lookup_key: SOLO_PRICE_LOOKUP_KEY,
  });
  return price.id;
}

const REFERRAL_COUPON_ID = "lc-referral-50";

/** "50% off one month": made in Stripe the first time it's needed. */
async function referralCouponId(stripe: Stripe = getStripeClient()): Promise<string> {
  try {
    return (await stripe.coupons.retrieve(REFERRAL_COUPON_ID)).id;
  } catch {
    const c = await stripe.coupons.create({ id: REFERRAL_COUPON_ID, percent_off: REFERRAL_PERCENT_OFF, duration: "once", name: `Referral: ${REFERRAL_PERCENT_OFF}% off a month` });
    return c.id;
  }
}

/** The barber's Stripe customer, made once and saved. */
export async function ensureCustomer(db: Admin, userId: string): Promise<string> {
  const { data: u } = await db.from("users").select("stripe_customer_id, email, business_name, first_name, forwarding_number").eq("user_id", userId).single();
  if (!u) throw new Error("Barber not found");
  if (u.stripe_customer_id) return u.stripe_customer_id;
  const customer = await getStripeClient().customers.create(
    {
      email: u.email || undefined,
      name: u.business_name || u.first_name || undefined,
      phone: u.forwarding_number || undefined,
      metadata: { user_id: userId },
    },
    { idempotencyKey: `customer-${userId}` }
  );
  await db.from("users").update({ stripe_customer_id: customer.id }).eq("user_id", userId);
  return customer.id;
}

/**
 * Stripe's hosted page where the barber adds their card. During the trial, the first $49 isn't
 * charged until the trial ends; after it, it's charged right away.
 */
export async function checkoutUrl(db: Admin, userId: string): Promise<string> {
  const { data: u } = await db.from("users").select("trial_ends_at, billing_status").eq("user_id", userId).single();
  const customer = await ensureCustomer(db, userId);
  // Referred and not paid yet: their first month is discounted right on Stripe's page.
  const { data: ref } = await db.from("referrals").select("id").eq("referred_user_id", userId).eq("status", "signed_up").maybeSingle();
  const trialEnd = u?.trial_ends_at ? Math.floor(new Date(u.trial_ends_at).getTime() / 1000) : 0;
  // Stripe needs a trial end at least 48 hours away.
  const keepTrial = trialEnd > Math.floor(Date.now() / 1000) + 48 * 3600;
  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: await soloPriceId(), quantity: 1 }],
    subscription_data: { metadata: { user_id: userId }, ...(keepTrial ? { trial_end: trialEnd } : {}) },
    payment_method_collection: "always",
    ...(ref ? { discounts: [{ coupon: await referralCouponId() }] } : {}),
    client_reference_id: userId,
    success_url: `${appUrl()}/dashboard/settings?billing=added#billing`,
    cancel_url: `${appUrl()}/dashboard/settings#billing`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link");
  return session.url;
}

/** Stripe's customer portal: update card, see invoices, cancel. */
export async function portalUrl(db: Admin, userId: string): Promise<string> {
  const customer = await ensureCustomer(db, userId);
  const session = await getStripeClient().billingPortal.sessions.create({ customer, return_url: `${appUrl()}/dashboard/settings#billing` });
  return session.url;
}

/**
 * Copies a subscription's state onto the barber. Active turns texting back on; past due starts
 * the 7-day grace; canceled pauses.
 */
export async function syncSubscription(db: Admin, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data: u } = await db
    .from("users")
    .select("user_id, billing_status, billing_grace_until")
    .or(`stripe_customer_id.eq.${customerId}${sub.metadata?.user_id ? `,user_id.eq.${sub.metadata.user_id}` : ""}`)
    .limit(1)
    .maybeSingle();
  if (!u) return null;

  const status: BillingStatus = fromStripeStatus(sub.status);
  const update: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: status === "canceled" ? null : sub.id,
    billing_status: status,
  };
  if (status === "active" || status === "trialing") {
    update.billing_grace_until = null;
    update.is_locked_out = false;
  } else if (status === "past_due") {
    if (u.billing_status !== "past_due" || !u.billing_grace_until) update.billing_grace_until = new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString();
  } else {
    update.is_locked_out = true;
  }
  await db.from("users").update(update).eq("user_id", u.user_id);
  return { userId: u.user_id, status };
}

/**
 * A referred barber paid their first month: the barber who sent them gets 50% off a month, as a
 * credit Stripe takes off their next bill. Runs once per referral (Stripe retries are safe).
 */
export async function rewardReferral(db: Admin, referredId: string) {
  const { data: ref } = await db.from("referrals").select("id, referrer_user_id").eq("referred_user_id", referredId).eq("status", "signed_up").maybeSingle();
  if (!ref) return null;
  const customer = await ensureCustomer(db, ref.referrer_user_id);
  await getStripeClient().customers.createBalanceTransaction(
    customer,
    { amount: -Math.round((SOLO_PRICE_CENTS * REFERRAL_PERCENT_OFF) / 100), currency: "usd", description: `Referral reward: ${REFERRAL_PERCENT_OFF}% off a month` },
    { idempotencyKey: `referral-reward-${ref.id}` }
  );
  await db.from("referrals").update({ status: "qualified", qualified_at: new Date().toISOString() }).eq("id", ref.id);
  await db.from("activity_feed").insert({
    user_id: ref.referrer_user_id,
    event_type: "referral_qualified",
    description: `A barber you referred paid their first month. You get ${REFERRAL_PERCENT_OFF}% off your next month.`,
    metadata: { referral_id: ref.id },
  });
  return ref.id;
}
