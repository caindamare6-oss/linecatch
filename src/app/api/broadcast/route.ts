import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message } = await request.json();
  if (!message || typeof message !== "string" || message.length > 320) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: barber } = await admin
    .from("users")
    .select("phone_number")
    .eq("user_id", user.id)
    .single();

  if (!barber?.phone_number) {
    return NextResponse.json({ error: "No phone number configured" }, { status: 400 });
  }

  // Get all opted-in VIP clients (includes booking signups, QR signups, and missed-call contacts)
  const { data: vipClients } = await admin
    .from("vip_clients")
    .select("phone_number")
    .eq("user_id", user.id)
    .eq("is_opted_in", true)
    .is("opted_out_at", null);

  const vipPhones = new Set((vipClients || []).map((c) => c.phone_number));

  // Also include missed-call contacts not yet in vip_clients
  const { data: calls } = await admin
    .from("missed_calls_log")
    .select("caller_phone")
    .eq("user_id", user.id);

  for (const call of calls || []) {
    vipPhones.add(call.caller_phone);
  }

  // Remove opted-out numbers
  const { data: optOuts } = await admin
    .from("opt_outs")
    .select("caller_phone")
    .eq("user_id", user.id);

  const optedOut = new Set((optOuts || []).map((o) => o.caller_phone));
  const recipients = [...vipPhones].filter((p) => !optedOut.has(p));

  let sent = 0;
  for (const phone of recipients) {
    try {
      await sendSMS(phone, barber.phone_number, message);
      sent++;
    } catch {
      // skip failed sends
    }
  }

  return NextResponse.json({ sent, total: recipients.length });
}
