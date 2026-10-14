import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { onboardingUrl } from "@/lib/stripe-connect";
import { signedInBarber, stripeFailed } from "@/lib/stripe-route";
import { appUrl } from "@/lib/config";

/**
 * Sends the barber to Stripe to verify their identity and add a bank or debit card. Stripe also
 * comes back here (GET) when a link expires, so a fresh one is made.
 */
export async function POST() {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  try {
    return NextResponse.json({ url: await onboardingUrl(createAdminClient(), me.userId) });
  } catch (err) {
    return stripeFailed("onboard", err);
  }
}

export async function GET() {
  const me = await signedInBarber();
  if ("response" in me) return NextResponse.redirect(`${appUrl()}/login`);
  try {
    return NextResponse.redirect(await onboardingUrl(createAdminClient(), me.userId));
  } catch (err) {
    console.error("[stripe:onboard]", err);
    return NextResponse.redirect(`${appUrl()}/dashboard/settings?connect=error#payments`);
  }
}
