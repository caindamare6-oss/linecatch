import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_TEXT } from "@/lib/consent";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone, name } = await request.json();

  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("vip_clients")
    .select("id")
    .eq("user_id", user.id)
    .eq("phone_number", phone)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, existed: true });
  }

  const { error } = await supabase.from("vip_clients").insert({
    user_id: user.id,
    phone_number: phone,
    first_name: name || null,
    is_opted_in: true,
    opted_in_at: new Date().toISOString(),
    consent_text: CONSENT_TEXT,
    opt_in_source: "barber_added",
    cut_count: 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (name) {
    await supabase.from("contacts").upsert(
      { user_id: user.id, caller_phone: phone, name },
      { onConflict: "user_id,caller_phone" }
    );
  }

  return NextResponse.json({ ok: true });
}
