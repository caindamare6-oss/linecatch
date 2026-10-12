import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { balance, refreshAccount } from "@/lib/stripe-connect";
import { signedInBarber } from "@/lib/stripe-route";
import { billingState } from "@/lib/billing-rules";

/** Everything Settings → Payments and the billing banner need, fresh from Stripe when possible. */
export async function GET() {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  const db = createAdminClient();
  const { data: u } = await db
    .from("users")
    .select("billing_status, trial_ends_at, billing_grace_until, stripe_subscription_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, protection_enabled, no_show_fee_percent")
    .eq("user_id", me.userId)
    .single();
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let charges = u.stripe_charges_enabled;
  let payouts = u.stripe_payouts_enabled;
  let money: Awaited<ReturnType<typeof balance>> | null = null;
  let stripeOk = true;
  if (u.stripe_account_id) {
    try {
      const account = await refreshAccount(db, u.stripe_account_id);
      charges = !!account.charges_enabled;
      payouts = !!account.payouts_enabled;
      if (charges) money = await balance(u.stripe_account_id);
    } catch (err) {
      console.error("[stripe:status]", err);
      stripeOk = false;
    }
  }

  const { data: recent } = await db
    .from("booking_payments")
    .select("booking_id, status, amount_cents, reward_cents, card_brand, card_last4, charged_at, failure_message")
    .eq("user_id", me.userId)
    .neq("status", "card_saved")
    .order("updated_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    billing: { ...billingState(u), hasCard: !!u.stripe_subscription_id },
    connect: {
      started: !!u.stripe_account_id,
      chargesEnabled: charges,
      payoutsEnabled: payouts,
      protectionEnabled: u.protection_enabled && charges,
      feePercent: u.no_show_fee_percent,
      balance: money,
      stripeOk,
    },
    recent: recent || [],
  });
}
