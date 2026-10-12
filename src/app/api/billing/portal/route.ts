import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { portalUrl } from "@/lib/stripe-billing";
import { signedInBarber, stripeFailed } from "@/lib/stripe-route";

/** "Manage billing": Stripe's customer portal (update card, invoices, cancel). */
export async function POST() {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  try {
    return NextResponse.json({ url: await portalUrl(createAdminClient(), me.userId) });
  } catch (err) {
    return stripeFailed("portal", err);
  }
}
