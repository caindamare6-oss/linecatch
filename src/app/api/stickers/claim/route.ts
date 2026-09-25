import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const normalized = code.trim().toUpperCase();
  const admin = createAdminClient();

  // Atomic claim: only succeeds if status is still 'unclaimed'
  const { data, error } = await admin
    .from("sticker_codes")
    .update({
      owner_user_id: user.id,
      status: "active",
      claimed_at: new Date().toISOString(),
    })
    .eq("code", normalized)
    .eq("status", "unclaimed")
    .select("code")
    .single();

  if (error || !data) {
    // Check why it failed
    const { data: existing } = await admin
      .from("sticker_codes")
      .select("status, owner_user_id")
      .eq("code", normalized)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Code not found" }, { status: 404 });
    }
    if (existing.status === "active") {
      if (existing.owner_user_id === user.id) {
        return NextResponse.json({ error: "You already own this code" }, { status: 409 });
      }
      return NextResponse.json({ error: "This code has already been claimed" }, { status: 409 });
    }
    if (existing.status === "retired") {
      return NextResponse.json({ error: "This code has been retired" }, { status: 410 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to claim code" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, code: data.code });
}
