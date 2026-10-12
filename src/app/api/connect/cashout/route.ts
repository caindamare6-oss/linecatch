import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { instantCashOut } from "@/lib/stripe-connect";
import { signedInBarber, stripeFailed } from "@/lib/stripe-route";

/** "Cash out now": instant payout to their debit card, 1.75% (min $0.50). */
export async function POST() {
  const me = await signedInBarber();
  if ("response" in me) return me.response;
  try {
    const r = await instantCashOut(createAdminClient(), me.userId);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  } catch (err) {
    return stripeFailed("cashout", err);
  }
}
