import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTemplate } from "@/lib/messages";
import { cookies } from "next/headers";
import { ensureReferralCode } from "@/lib/referrals";
import { LANG_COOKIE } from "@/lib/i18n-shared";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

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

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
