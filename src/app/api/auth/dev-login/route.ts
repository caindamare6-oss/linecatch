import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// DEV ONLY — remove before deploying to production
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not available", { status: 404 });
  }

  const { origin } = new URL(request.url);
  const admin = createAdminClient();

  // Get the existing barber user
  const { data: barber } = await admin
    .from("users")
    .select("user_id, email, phone_number")
    .limit(1)
    .single();

  if (!barber) {
    return NextResponse.json({ error: "No user found" }, { status: 404 });
  }

  // Check if an auth user exists for this email
  const email = barber.email || "dev@linecatch.local";

  // Try to find or create auth user
  const { data: authUsers } = await admin.auth.admin.listUsers();
  let authUser = authUsers?.users?.find((u) => u.email === email);

  if (!authUser) {
    const { data } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { dev: true },
    });
    authUser = data.user!;

    // Link the barber profile to this auth user
    await admin
      .from("users")
      .update({ user_id: authUser.id, email })
      .eq("user_id", barber.user_id);
  }

  // Generate a magic link to sign them in
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkData?.properties?.hashed_token) {
    const supabase = await createClient();
    await supabase.auth.verifyOtp({
      type: "email",
      token_hash: linkData.properties.hashed_token,
    });
  }

  // Mark onboarding complete for dev testing
  await admin
    .from("users")
    .update({ onboarding_completed: true })
    .eq("user_id", authUser.id);

  return NextResponse.redirect(`${origin}/dashboard`);
}
