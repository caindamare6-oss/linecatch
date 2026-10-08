import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findToken, greeting, issueToken, revokeToken, touchToken } from "@/lib/client-session";

// Token goes in the body, not the query string, so it never lands in access logs.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { barberId, token } = body as { barberId?: string; token?: string };
  if (!barberId) {
    return NextResponse.json({ error: "Missing barberId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const row = await findToken(supabase, barberId, token);
  if (!row) {
    return NextResponse.json({ recognized: false });
  }

  const { data: vip } = await supabase
    .from("vip_clients")
    .select("first_name, cut_count, is_opted_in, opted_out_at")
    .eq("user_id", barberId)
    .eq("phone_number", row.phone_number)
    .maybeSingle();

  // An unverified token came from a typed-in phone number, so it only ever shows back
  // what that device typed — never the name or history on file for that number.
  const firstName = row.verified ? vip?.first_name || row.display_name : row.display_name;

  let lastServiceId: string | null = null;
  if (row.verified) {
    const { data: last } = await supabase
      .from("bookings")
      .select("service_id")
      .eq("user_id", barberId)
      .eq("customer_phone", row.phone_number)
      .in("status", ["confirmed", "completed"])
      .order("booking_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastServiceId = last?.service_id ?? null;
  }

  // A missed-call link is exchanged for a long-lived session the PWA keeps.
  let sessionToken: string | null = null;
  if (row.kind === "link") {
    sessionToken = await issueToken(supabase, {
      userId: barberId,
      phone: row.phone_number,
      kind: "session",
      verified: true,
      displayName: firstName,
    });
  }
  await touchToken(supabase, row.id);

  return NextResponse.json({
    recognized: true,
    client: {
      firstName: firstName || null,
      phoneLast4: row.phone_number.slice(-4),
      smsOptedIn: !!vip?.is_opted_in && !vip?.opted_out_at,
      stampCount: row.verified ? vip?.cut_count ?? 0 : null,
      lastServiceId,
    },
    uiGreeting: greeting(firstName),
    sessionToken,
  });
}

// "Not you?" — forget this device.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { barberId, token } = body as { barberId?: string; token?: string };
  if (barberId) await revokeToken(createAdminClient(), barberId, token);
  return NextResponse.json({ success: true });
}
