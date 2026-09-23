import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ error: "Missing barberId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: barber } = await supabase
    .from("users")
    .select("business_name, is_locked_out, accent_color")
    .eq("user_id", barberId)
    .single();

  return NextResponse.json({
    businessName: barber?.business_name || null,
    isLockedOut: barber?.is_locked_out || false,
    accentColor: barber?.accent_color || null,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { phone, barberId, firstName, consentText, consented, optInSource } = body;

  if (!phone || !barberId) {
    return NextResponse.json(
      { error: "Phone and barberId are required" },
      { status: 400 }
    );
  }

  const didConsent = consented === true;

  const supabase = createAdminClient();

  const { data: barber } = await supabase
    .from("users")
    .select("user_id, is_active, is_locked_out")
    .eq("user_id", barberId)
    .single();

  if (!barber) {
    return NextResponse.json({ error: "Barber not found" }, { status: 404 });
  }

  if (barber.is_locked_out) {
    return NextResponse.json(
      { error: "This business is currently offline." },
      { status: 503 }
    );
  }

  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const source = optInSource || "vip_form";

  const { data: existing } = await supabase
    .from("vip_clients")
    .select("id, is_opted_in, opted_out_at, opted_in_at, consent_text")
    .eq("user_id", barberId)
    .eq("phone_number", normalized)
    .single();

  if (existing) {
    if (existing.opted_out_at) {
      return NextResponse.json(
        { error: "This number has opted out. Reply START to the barber's number to re-subscribe." },
        { status: 403 }
      );
    }
    if (existing.is_opted_in) {
      return NextResponse.json({ success: true, message: "Already opted in" });
    }
    const { error: updateError } = await supabase
      .from("vip_clients")
      .update({
        is_opted_in: didConsent,
        opted_in_at: didConsent ? new Date().toISOString() : null,
        opt_in_source: source,
        opt_in_ip: ip,
        opt_in_user_agent: userAgent,
        consent_text: didConsent ? consentText : null,
        first_name: firstName || null,
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("VIP opt-in update error:", updateError);
      return NextResponse.json(
        { error: `Failed to update opt-in: ${updateError.message}` },
        { status: 500 }
      );
    }

    await supabase.from("activity_feed").insert({
      user_id: barberId,
      event_type: "qr_scan",
      client_name: firstName || null,
      client_phone: normalized,
      description: `${firstName || "New client"} joined your VIP list`,
      metadata: { source },
    });

    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.from("vip_clients").insert({
    user_id: barberId,
    phone_number: normalized,
    opted_in_at: didConsent ? new Date().toISOString() : null,
    is_opted_in: didConsent,
    opt_in_source: source,
    opt_in_ip: ip,
    opt_in_user_agent: userAgent,
    consent_text: didConsent ? consentText : null,
    first_name: firstName || null,
  });

  if (error) {
    console.error("VIP opt-in insert error:", error);
    return NextResponse.json(
      { error: `Failed to save opt-in: ${error.message}` },
      { status: 500 }
    );
  }

  await supabase.from("activity_feed").insert({
    user_id: barberId,
    event_type: "qr_scan",
    client_name: firstName || null,
    client_phone: normalized,
    description: `${firstName || "New client"} joined your VIP list`,
    metadata: { source },
  });

  return NextResponse.json({ success: true });
}
