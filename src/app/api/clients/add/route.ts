import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

/**
 * Barber adds someone to their client list by hand.
 * This saves a contact only: it does NOT opt them in to texts. Consent has to come from the client
 * (VIP signup, booking checkbox, QR), so a typed-in number is never marketed to.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone, name } = await request.json().catch(() => ({}));
  const p = normalizePhone(typeof phone === "string" ? phone : "");
  if (!p.valid) {
    return NextResponse.json({ error: p.error }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("contacts")
    .select("caller_phone")
    .eq("user_id", user.id)
    .eq("caller_phone", p.e164)
    .maybeSingle();

  const cleanName = typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : null;
  const { error } = await supabase
    .from("contacts")
    .upsert({ user_id: user.id, caller_phone: p.e164, ...(cleanName ? { name: cleanName } : {}) }, { onConflict: "user_id,caller_phone" });

  if (error) {
    console.error("[clients/add]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, existed: !!existing, phone: p.e164 });
}
