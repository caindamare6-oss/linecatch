import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { caller_phone, name } = await request.json();
  if (!caller_phone || typeof caller_phone !== "string") {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contacts")
    .upsert(
      { user_id: user.id, caller_phone, name: name || null },
      { onConflict: "user_id,caller_phone" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
