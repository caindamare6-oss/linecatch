import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expressDashboardUrl } from "@/lib/stripe-connect";
import { signedInBarber, stripeFailed } from "@/lib/stripe-route";

/** Opens the barber's Stripe Express dashboard (payout history, bank and debit card). */
export async function POST() {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  const { data: u } = await createAdminClient().from("users").select("stripe_account_id").eq("user_id", me.userId).single();
  if (!u?.stripe_account_id) return NextResponse.json({ error: "payouts.not_ready" }, { status: 400 });
  try {
    return NextResponse.json({ url: await expressDashboardUrl(u.stripe_account_id) });
  } catch (err) {
    return stripeFailed("dashboard", err);
  }
}
