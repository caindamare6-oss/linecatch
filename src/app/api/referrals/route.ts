import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureReferralCode, referralLink } from "@/lib/referrals";
import { REFERRED_PERCENT_OFF, REFERRER_FREE_MONTHS } from "@/lib/config";

/** The barber's own code, share link and what it has earned. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const code = await ensureReferralCode(admin, user.id);
  const [{ data: refs }, { data: credits }, { data: me }] = await Promise.all([
    admin.from("referrals").select("status").eq("referrer_user_id", user.id),
    admin.from("billing_credits").select("kind, amount, redeemed_at").eq("user_id", user.id),
    admin.from("users").select("referred_by").eq("user_id", user.id).single(),
  ]);
  const freeMonths = (credits || []).filter((c) => c.kind === "free_month" && !c.redeemed_at).reduce((n, c) => n + c.amount, 0);
  const discount = (credits || []).find((c) => c.kind === "percent_off" && !c.redeemed_at)?.amount ?? null;

  return NextResponse.json({
    code,
    link: referralLink(code),
    signedUp: (refs || []).length,
    qualified: (refs || []).filter((r) => r.status === "qualified").length,
    freeMonths,
    discountPercent: discount,
    wasReferred: !!me?.referred_by,
    rewards: { referrerFreeMonths: REFERRER_FREE_MONTHS, referredPercentOff: REFERRED_PERCENT_OFF },
  });
}
