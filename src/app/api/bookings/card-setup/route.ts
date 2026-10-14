import { NextResponse } from "next/server";
import { CLIENT_PAYMENTS } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { findToken } from "@/lib/client-session";
import { createCardSetup } from "@/lib/stripe-connect";
import { getT } from "@/lib/i18n-server";

/**
 * Booking page, barbers with no-show protection on: starts saving the client's card on the
 * barber's Stripe account. Stripe's card form (on the page) finishes it; nothing is charged now.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { t } = await getT();
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: t("book.err_missing") }, { status: 400 });

  const db = createAdminClient();
  const { data: barber } = await db.from("users").select("stripe_account_id, protection_enabled, stripe_charges_enabled").eq("user_id", userId).maybeSingle();
  if (!CLIENT_PAYMENTS || !barber?.stripe_account_id || !barber.protection_enabled || !barber.stripe_charges_enabled) {
    return NextResponse.json({ required: false });
  }

  let phone: string | null = null;
  if (body.customerPhone) {
    const p = normalizePhone(String(body.customerPhone));
    if (!p.valid) return NextResponse.json({ error: t("book.err_phone") }, { status: 400 });
    phone = p.e164;
  } else if (body.sessionToken) {
    phone = (await findToken(db, userId, String(body.sessionToken)))?.phone_number ?? null;
  }
  if (!phone) return NextResponse.json({ error: t("book.err_phone") }, { status: 400 });

  try {
    const { clientSecret } = await createCardSetup(barber.stripe_account_id, phone);
    return NextResponse.json({ required: true, clientSecret, account: barber.stripe_account_id });
  } catch (err) {
    console.error("[stripe:card-setup]", err);
    return NextResponse.json({ error: t("pay.card_unavailable") }, { status: 503 });
  }
}
