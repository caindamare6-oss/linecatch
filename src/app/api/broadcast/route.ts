import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";

async function broadcastRecipients(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const [{ data: vips }, { data: optOuts }] = await Promise.all([
    admin.from("vip_clients").select("phone_number, client_language").eq("user_id", userId).eq("is_opted_in", true).is("opted_out_at", null),
    admin.from("opt_outs").select("caller_phone").eq("user_id", userId),
  ]);
  const optedOut = new Set((optOuts || []).map((o) => o.caller_phone));
  const seen = new Set<string>();
  return (vips || []).filter((v) => !optedOut.has(v.phone_number) && !seen.has(v.phone_number) && !!seen.add(v.phone_number));
}

/** How many people a broadcast would reach right now. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const recipients = await broadcastRecipients(createAdminClient(), user.id);
  return NextResponse.json({ total: recipients.length });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message: raw } = await request.json().catch(() => ({}));
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message || message.length > 320) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: barber } = await admin
    .from("users")
    .select("phone_number, is_locked_out")
    .eq("user_id", user.id)
    .single();

  if (!barber?.phone_number) {
    return NextResponse.json({ error: "No phone number configured" }, { status: 400 });
  }
  if (barber.is_locked_out) {
    return NextResponse.json({ error: "Texting is paused on your account. Contact support." }, { status: 402 });
  }
  // Clients who booked themselves (and agreed to texts doing it). Callers who never booked aren't recipients.
  const recipients = await broadcastRecipients(admin, user.id);
  let sent = 0;
  for (const r of recipients) {
    try {
      // The "Reply STOP" line goes out in the client's language.
      if (await sendSMS({ to: r.phone_number, from: barber.phone_number, body: message, userId: user.id, templateKey: "broadcast", language: r.client_language || "en" })) sent++;
    } catch {
      // skip failed sends
    }
  }

  return NextResponse.json({ sent, total: recipients.length });
}
