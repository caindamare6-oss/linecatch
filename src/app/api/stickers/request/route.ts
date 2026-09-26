import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: barber } = await admin
    .from("users")
    .select("business_name, first_name, email")
    .eq("user_id", user.id)
    .single();

  const { data: sticker } = await admin
    .from("sticker_codes")
    .select("code")
    .eq("owner_user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  await admin.from("activity_feed").insert({
    user_id: user.id,
    event_type: "sticker_request",
    description: `${barber?.first_name || "Barber"} (${barber?.business_name || "unknown shop"}) requested more stickers. Code: ${sticker?.code || "none"}. Email: ${barber?.email || user.email || "n/a"}`,
    metadata: { code: sticker?.code, email: barber?.email || user.email },
  });

  return NextResponse.json({ ok: true });
}
