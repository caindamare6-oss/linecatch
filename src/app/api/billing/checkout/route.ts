import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutUrl } from "@/lib/stripe-billing";
import { signedInBarber, stripeFailed } from "@/lib/stripe-route";

/** "Add card": a Stripe-hosted page for the $49/month plan. */
export async function POST() {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  try {
    return NextResponse.json({ url: await checkoutUrl(createAdminClient(), me.userId) });
  } catch (err) {
    return stripeFailed("checkout", err);
  }
}
