import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
          // Brand new user — create profile
          await admin.from("users").insert({
            user_id: data.user.id,
            email: data.user.email,
            is_active: true,
            custom_message:
              "Hey! Sorry I missed your call. Book your next appointment here: {link}\nReply STOP to opt out.",
          });
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
