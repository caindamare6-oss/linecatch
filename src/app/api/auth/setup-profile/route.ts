import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    return NextResponse.json({ status: "exists" });
  }

  // Check for existing profile by phone number (link pre-existing account)
  const phone = user.phone;
  if (phone) {
    const { data: existingByPhone } = await admin
      .from("users")
      .select("user_id")
      .eq("phone_number", phone)
      .single();

    if (existingByPhone) {
      await admin
        .from("users")
        .update({ user_id: user.id })
        .eq("phone_number", phone);

      return NextResponse.json({ status: "linked" });
    }
  }

  // Brand new user — create profile
  const { error: insertError } = await admin.from("users").insert({
    user_id: user.id,
    phone_number: phone || null,
    forwarding_number: null,
    is_active: true,
    custom_message:
      "Hey! Sorry I missed your call. Book your next appointment here: {link}\nReply STOP to opt out.",
  });

  if (insertError) {
    console.error("Profile creation error:", insertError);
    return NextResponse.json(
      { error: `Failed to create profile: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "created" });
}
