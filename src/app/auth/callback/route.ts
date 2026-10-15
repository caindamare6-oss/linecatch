import { NextResponse } from "next/server";
import { safeNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTemplate } from "@/lib/messages";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "@/lib/i18n-shared";
import { ensureReferralCode, normalizeCode, REF_COOKIE } from "@/lib/referrals";

const OTP_TYPES = ["email", "magiclink", "signup", "invite", "recovery", "email_change"] as const;
type OtpType = (typeof OTP_TYPES)[number];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Email links carry a token_hash (see the Supabase email templates), which works in any browser.
  // A ?code= link only works in the browser that asked for it, so a barber who signs up on a laptop
  // and taps the email on their phone would bounce back to sign-in.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as OtpType | null;

  if (code || (tokenHash && type && OTP_TYPES.includes(type))) {
    const supabase = await createClient();
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

    if (!error && data.user) {
      const admin = createAdminClient();

      // Check if this user already has a profile by user_id
      const { data: existingById } = await admin
        .from("users")
        .select("user_id")
        .eq("user_id", data.user.id)
        .single();

      if (!existingById) {
        // Check if there's an existing profile by email (for linking pre-existing accounts)
        const { data: existingByEmail } = await admin
          .from("users")
          .select("user_id")
          .eq("email", data.user.email)
          .single();

        if (existingByEmail) {
          // Link existing profile to auth user
          await admin
            .from("users")
            .update({ user_id: data.user.id })
            .eq("email", data.user.email);
        } else {
          const lang = (await cookies()).get(LANG_COOKIE)?.value === "es" ? "es" : "en";
          const defaultMsg = await resolveTemplate(data.user.id, "missed_call", lang)
            || "Hey! Sorry I missed your call. Book your next appointment here: {link}";
          await admin.from("users").insert({
            user_id: data.user.id,
            email: data.user.email,
            is_active: true,
            custom_message: defaultMsg,
            barber_language: lang,
          });
          await ensureReferralCode(admin, data.user.id);
        }
      }

      return carryCodes(NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`), searchParams);
    }
  }

  return carryCodes(NextResponse.redirect(`${origin}/login?error=auth`), searchParams);
}

/** A referral code passed through the sign-in link becomes a cookie again (see /join/CODE). */
function carryCodes(res: NextResponse, params: URLSearchParams) {
  const ref = normalizeCode(params.get("ref"));
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const };
  if (ref) res.cookies.set(REF_COOKIE, ref, opts);
  return res;
}
