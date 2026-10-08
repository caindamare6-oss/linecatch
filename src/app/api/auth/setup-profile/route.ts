import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTemplate } from "@/lib/messages";
import { cookies } from "next/headers";
import { ensureReferralCode } from "@/lib/referrals";
import { LANG_COOKIE } from "@/lib/i18n-shared";
import { claimOnSignIn, STICKER_COOKIE } from "@/lib/sticker-claim";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Check if this auth user already has a profile
  const { data: existingById } = await admin
    .from("users")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (existingById) {
    const jar = await cookies();
    const pending = jar.get(STICKER_COOKIE)?.value;
    const claimed = await claimOnSignIn(admin, user.id, pending);
    if (claimed) jar.delete(STICKER_COOKIE);
    return NextResponse.json({ status: "exists", sticker: claimed?.ok ? claimed.code : null });
  }

  // users.phone_number is each barber's LineCatch (Twilio) number, never their login phone,
  // so a new login is never matched to an existing account by phone.
  const phone = user.phone;
  const lang = (await cookies()).get(LANG_COOKIE)?.value === "es" ? "es" : "en";

  const defaultMsg = await resolveTemplate(user.id, "missed_call", lang)
    || "Hey! Sorry I missed your call. Book your next appointment here: {link}";
  const { error: insertError } = await admin.from("users").insert({
    user_id: user.id,
    phone_number: null,
    forwarding_number: null,
    is_active: true,
    custom_message: defaultMsg,
    barber_language: lang,
  });

  if (insertError) {
    console.error("Profile creation error:", insertError);
    return NextResponse.json(
      { error: `Failed to create profile: ${insertError.message}` },
      { status: 500 }
    );
  }

  await ensureReferralCode(admin, user.id);
  return NextResponse.json({ status: "created", loginPhone: phone || null });
}
