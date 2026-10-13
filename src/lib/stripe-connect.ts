import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/config";
import { cutChargeCents, noShowFeeCents } from "@/lib/billing-rules";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Part B of PLAN.md. Every barber with no-show protection has a Stripe connected account that
 * lives entirely inside LineCatch (no Stripe dashboard login): balance, payments and cash-out are
 * in Settings → Payments. Clients' cards are saved on (and charged from) the barber's own account;
 * Stripe takes its card fee from the barber and covers negative balances. LineCatch takes nothing.
 */

// ── The barber's payout account ──

export async function ensureConnectedAccount(db: Admin, userId: string): Promise<string> {
  const { data: u } = await db.from("users").select("stripe_account_id, email, business_name, first_name, slug").eq("user_id", userId).single();
  if (!u) throw new Error("Barber not found");
  if (u.stripe_account_id) return u.stripe_account_id;
  // Accounts v2 (Stripe no longer allows v1 accounts for new Connect platforms). No Stripe
  // dashboard: everything is in LineCatch. Stripe collects its fees from the barber and is
  // responsible for negative balances, so LineCatch carries no risk.
  const account = await getStripeClient().v2.core.accounts.create(
    {
      display_name: u.business_name || u.first_name || undefined,
      contact_email: u.email || undefined,
      // Shortest onboarding without filling in anyone's personal details: they're a barber
      // working as an individual, and their LineCatch page is their website.
      identity: { country: "us", entity_type: "individual" },
      dashboard: "none",
      defaults: {
        profile: {
          product_description: "Haircuts and barber services",
          ...(u.slug ? { business_url: `${appUrl()}/${u.slug}` } : {}),
        },
        responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
      configuration: {
        merchant: {
          mcc: "7241", // Barber and beauty shops
          // Clients see the shop's name on their card statement (fewer "what's this?" disputes).
          ...(statementName(u.business_name) ? { statement_descriptor: { descriptor: statementName(u.business_name)! } } : {}),
          capabilities: { card_payments: { requested: true } },
        },
      },
      metadata: { user_id: userId },
    },
    { idempotencyKey: `connect-v2-short-${userId}` }
  );
  await db.from("users").update({ stripe_account_id: account.id }).eq("user_id", userId);
  return account.id;
}

/** Stripe's own pages where the barber verifies who they are and adds their bank or debit card. */
export async function onboardingUrl(db: Admin, userId: string): Promise<string> {
  const account = await ensureConnectedAccount(db, userId);
  const link = await getStripeClient().v2.core.accountLinks.create({
    account,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        // Only what Stripe needs right now, nothing it might want later.
        collection_options: { fields: "currently_due", future_requirements: "omit" },
        refresh_url: `${appUrl()}/api/connect/onboard?again=1`,
        return_url: `${appUrl()}/dashboard/settings?connect=done#payments`,
      },
    },
  });
  return link.url;
}

/** Copies Stripe's verdict onto the barber. Protection only works once cards can be charged. */
export async function syncAccountStatus(db: Admin, accountId: string, chargesEnabled: boolean, payoutsEnabled: boolean) {
  const update: Record<string, unknown> = { stripe_charges_enabled: chargesEnabled, stripe_payouts_enabled: payoutsEnabled };
  if (!chargesEnabled) update.protection_enabled = false;
  await db.from("users").update(update).eq("stripe_account_id", accountId);
}

/** Older v1-style account.updated events still carry the two flags. */
export async function syncAccount(db: Admin, account: Stripe.Account) {
  await syncAccountStatus(db, account.id, !!account.charges_enabled, !!account.payouts_enabled);
}

/** Asks Stripe (Accounts v2) whether the barber can take cards and get paid yet. */
export async function refreshAccount(db: Admin, accountId: string) {
  const account = await getStripeClient().v2.core.accounts.retrieve(accountId, { include: ["configuration.merchant", "requirements"] });
  const caps = account.configuration?.merchant?.capabilities;
  const chargesEnabled = caps?.card_payments?.status === "active";
  const payoutsEnabled = caps?.stripe_balance?.payouts?.status === "active";
  await syncAccountStatus(db, accountId, chargesEnabled, payoutsEnabled);
  return { chargesEnabled, payoutsEnabled };
}

/**
 * A card statement name from the shop name: 5–22 characters, no < > \ ' " *, at least one
 * letter. Null when the name can't make a valid one (Stripe then asks during setup).
 */
export function statementName(name: string | null | undefined): string | null {
  const clean = (name || "").replace(/[<>\\'"*]/g, "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 22).trim();
  return clean.length >= 5 && /[A-Z]/.test(clean) ? clean : null;
}

// ── Where the barber's money goes ──

export type PayoutMethod = { id: string; kind: "card" | "bank"; label: string; last4: string; instant: boolean; isDefault: boolean };

/** Their debit cards and bank accounts, newest default first. */
export async function payoutMethods(accountId: string): Promise<PayoutMethod[]> {
  const list = await getStripeClient().accounts.listExternalAccounts(accountId, { limit: 10 });
  return list.data.map((x) => {
    const card = x.object === "card";
    const xx = x as unknown as { id: string; brand?: string; bank_name?: string | null; last4: string; available_payout_methods?: string[] | null; default_for_currency?: boolean | null };
    return {
      id: xx.id,
      kind: card ? "card" : "bank",
      label: (card ? xx.brand : xx.bank_name) || (card ? "Card" : "Bank"),
      last4: xx.last4,
      instant: (xx.available_payout_methods || []).includes("instant"),
      isDefault: !!xx.default_for_currency,
    };
  });
}

/**
 * Adds a debit card (tokenized by Stripe's card form; LineCatch never sees the number) and makes
 * it where payouts go. Stripe refuses credit cards and cards that can't receive payouts.
 */
export async function addDebitCard(db: Admin, userId: string, token: string) {
  const { data: u } = await db.from("users").select("stripe_account_id").eq("user_id", userId).single();
  if (!u?.stripe_account_id) return { ok: false as const, error: "payouts.not_ready" };
  try {
    await getStripeClient().accounts.createExternalAccount(u.stripe_account_id, { external_account: token, default_for_currency: true });
    return { ok: true as const };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[stripe:debit-card]", e.code, e.message);
    return { ok: false as const, error: e.code === "card_declined" || /debit/i.test(e.message || "") ? "payouts.err_not_debit" : "payouts.err_card" };
  }
}

// ── Saving a client's card at booking ──

/** Started before the client confirms: Stripe's card form fills this in. */
export async function createCardSetup(accountId: string, phone: string) {
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ phone, metadata: { phone } }, { stripeAccount: accountId });
  const intent = await stripe.setupIntents.create(
    { customer: customer.id, usage: "off_session", metadata: { phone } },
    { stripeAccount: accountId }
  );
  return { clientSecret: intent.client_secret!, setupIntentId: intent.id };
}

/**
 * After booking: checks the card really was saved on this barber's account, for this client,
 * and remembers it on each booking in the visit.
 */
export async function attachCardToBookings(db: Admin, opts: { userId: string; accountId: string; setupIntentId: string; phone: string; bookingIds: string[] }) {
  const stripe = getStripeClient();
  const intent = await stripe.setupIntents.retrieve(opts.setupIntentId, { expand: ["payment_method"] }, { stripeAccount: opts.accountId });
  if (intent.status !== "succeeded" || intent.metadata?.phone !== opts.phone) return false;
  const pm = intent.payment_method as Stripe.PaymentMethod | null;
  const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
  if (!pm || !customer) return false;
  await db.from("booking_payments").upsert(
    opts.bookingIds.map((id) => ({
      booking_id: id,
      user_id: opts.userId,
      stripe_account_id: opts.accountId,
      stripe_customer_id: customer,
      stripe_payment_method_id: pm.id,
      card_brand: pm.card?.brand ?? null,
      card_last4: pm.card?.last4 ?? null,
      status: "card_saved",
    }))
  );
  return true;
}

// ── Charging ──

type Payment = {
  booking_id: string;
  user_id: string;
  stripe_account_id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  status: string;
  amount_cents: number | null;
  stripe_payment_intent_id: string | null;
};

async function chargeSaved(db: Admin, p: Payment, amount: number, kind: "cut" | "no_show" | "late_cancel", rewardCents = 0) {
  const done = kind === "cut" ? "paid" : "fee_charged";
  if (amount <= 0) {
    // A free 10th cut (or a fee too small for Stripe): nothing to charge.
    await db.from("booking_payments").update({ status: kind === "cut" ? "paid" : "waived", amount_cents: 0, reward_cents: rewardCents, charged_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("booking_id", p.booking_id);
    return { ok: true as const, amount: 0 };
  }
  try {
    const intent = await getStripeClient().paymentIntents.create(
      {
        amount,
        currency: "usd",
        customer: p.stripe_customer_id,
        payment_method: p.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: kind === "cut" ? "Haircut" : kind === "no_show" ? "No-show fee" : "Late cancellation fee",
        metadata: { booking_id: p.booking_id, kind },
      },
      { stripeAccount: p.stripe_account_id, idempotencyKey: `${kind}-${p.booking_id}` }
    );
    const ok = intent.status === "succeeded";
    await db
      .from("booking_payments")
      .update({ status: ok ? done : "failed", amount_cents: amount, reward_cents: rewardCents, stripe_payment_intent_id: intent.id, failure_message: ok ? null : intent.status, charged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("booking_id", p.booking_id);
    return ok ? { ok: true as const, amount } : { ok: false as const, error: intent.status };
  } catch (err) {
    const message = (err as { message?: string }).message || "Card was declined";
    await db.from("booking_payments").update({ status: "failed", amount_cents: amount, failure_message: message.slice(0, 200), updated_at: new Date().toISOString() }).eq("booking_id", p.booking_id);
    return { ok: false as const, error: message };
  }
}

async function savedCard(db: Admin, bookingId: string): Promise<Payment | null> {
  const { data } = await db.from("booking_payments").select("*").eq("booking_id", bookingId).maybeSingle();
  return (data as Payment | null) ?? null;
}

async function priceCents(db: Admin, bookingId: string): Promise<number> {
  const { data: b } = await db.from("bookings").select("service_id").eq("id", bookingId).maybeSingle();
  if (!b?.service_id) return 0;
  const { data: s } = await db.from("services").select("price").eq("id", b.service_id).maybeSingle();
  return Math.round(Number(s?.price ?? 0) * 100);
}

/** The cut is done: charge the saved card the price minus any 10th-cut reward. */
export async function chargeForCut(db: Admin, bookingId: string, rewardCents: number) {
  const p = await savedCard(db, bookingId);
  if (!p || p.status !== "card_saved") return null;
  return chargeSaved(db, p, cutChargeCents(await priceCents(db, bookingId), rewardCents), "cut", rewardCents);
}

/**
 * No-show or late cancel: the barber's % of the cut price (no loyalty discount). A cut that was
 * already charged (marked done by mistake) is refunded first.
 */
export async function chargeFee(db: Admin, bookingId: string, kind: "no_show" | "late_cancel") {
  const p = await savedCard(db, bookingId);
  if (!p) return null;
  const { data: barber } = await db.from("users").select("no_show_fee_percent, protection_enabled").eq("user_id", p.user_id).single();
  if (!barber?.protection_enabled) return null;
  if (p.status === "paid" && p.stripe_payment_intent_id && (p.amount_cents ?? 0) > 0) {
    await getStripeClient().refunds.create({ payment_intent: p.stripe_payment_intent_id }, { stripeAccount: p.stripe_account_id, idempotencyKey: `refund-${p.booking_id}` });
  }
  if (p.status !== "card_saved" && p.status !== "paid") return null;
  return chargeSaved(db, { ...p, status: "card_saved" }, noShowFeeCents(await priceCents(db, bookingId), barber.no_show_fee_percent ?? 50), kind);
}

/** The barber took back a no-show or done: give back whatever was charged. */
export async function refundBooking(db: Admin, bookingId: string) {
  const p = await savedCard(db, bookingId);
  if (!p?.stripe_payment_intent_id || !(p.status === "paid" || p.status === "fee_charged") || !(p.amount_cents ?? 0)) return null;
  await getStripeClient().refunds.create({ payment_intent: p.stripe_payment_intent_id }, { stripeAccount: p.stripe_account_id, idempotencyKey: `refund-${p.booking_id}-${p.stripe_payment_intent_id}` });
  await db.from("booking_payments").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("booking_id", bookingId);
  return true;
}

// ── Getting paid ──

export async function balance(accountId: string) {
  const b = await getStripeClient().balance.retrieve({}, { stripeAccount: accountId });
  const usd = (list?: { amount: number; currency: string }[]) => (list || []).filter((x) => x.currency === "usd").reduce((n, x) => n + x.amount, 0);
  return { available: usd(b.available), pending: usd(b.pending), instant: usd(b.instant_available) };
}

/**
 * Cash out now: the barber's whole instant-available balance goes to their debit card in about
 * 30 minutes. Stripe's own instant payout fee applies; LineCatch adds nothing.
 */
export async function instantCashOut(db: Admin, userId: string) {
  const { data: u } = await db.from("users").select("stripe_account_id, stripe_payouts_enabled").eq("user_id", userId).single();
  if (!u?.stripe_account_id || !u.stripe_payouts_enabled) return { ok: false as const, error: "payouts.not_ready" };
  const { instant } = await balance(u.stripe_account_id);
  if (instant <= 0) return { ok: false as const, error: "payouts.nothing" };
  const payout = await getStripeClient().payouts.create(
    { amount: instant, currency: "usd", method: "instant" },
    { stripeAccount: u.stripe_account_id, idempotencyKey: `cashout-${userId}-${instant}-${new Date().toISOString().slice(0, 13)}` }
  );
  await db.from("payouts").insert({ user_id: userId, stripe_payout_id: payout.id, amount_cents: instant, fee_cents: 0, method: "instant", status: payout.status });
  return { ok: true as const, amount: instant };
}
