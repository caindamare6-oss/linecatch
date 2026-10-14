import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDebitCard } from "@/lib/stripe-connect";
import { signedInBarber, stripeFailed } from "@/lib/stripe-route";

/** Settings → Payments → Add debit card: the card token from Stripe's form becomes their payout card. */
export async function POST(request: Request) {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  const { token } = await request.json().catch(() => ({}));
  if (typeof token !== "string" || !token.startsWith("tok_")) return NextResponse.json({ error: "payouts.err_card" }, { status: 400 });
  try {
    const r = await addDebitCard(createAdminClient(), me.userId, token);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (err) {
    return stripeFailed("debit-card", err);
  }
}
