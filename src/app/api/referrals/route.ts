import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyReferral, ensureReferralCode, referralLink } from "@/lib/referrals";
import { REFERRAL_PERCENT_OFF } from "@/lib/config";

/** The barber's own code, share link and how many barbers it brought in. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const code = await ensureReferralCode(admin, user.id);
  const [{ data: refs }, { data: mine }] = await Promise.all([
    admin.from("referrals").select("status").eq("referrer_user_id", user.id),
    admin.from("referrals").select("status").eq("referred_user_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    code,
    link: referralLink(code),
    signedUp: (refs || []).length,
    paid: (refs || []).filter((r) => r.status === "qualified").length,
    // Their own first month is discounted until they pay it.
    discountPending: mine?.status === "signed_up",
    percent: REFERRAL_PERCENT_OFF,
  });
}

/** A friend's code, entered in Settings → Billing before adding a card. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { code } = await request.json().catch(() => ({}));
  const r = await applyReferral(createAdminClient(), user.id, code);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}
