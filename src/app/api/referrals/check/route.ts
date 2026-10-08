import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findReferrer, normalizeCode } from "@/lib/referrals";
import { REFERRED_PERCENT_OFF } from "@/lib/config";

/** Public: is this a real code? Shows the inviting shop's name, nothing else. */
export async function GET(request: Request) {
  const code = normalizeCode(new URL(request.url).searchParams.get("code"));
  if (!code) return NextResponse.json({ valid: false });
  const referrer = await findReferrer(createAdminClient(), code);
  if (!referrer) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, code, name: referrer.business_name || referrer.first_name || null, percentOff: REFERRED_PERCENT_OFF });
}
