import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { recordedConsentText, toOptInSource } from "@/lib/consent";
import { DEFAULT_TZ } from "@/lib/config";
import { getLocale } from "@/lib/i18n-server";
import { isLocale, translate } from "@/lib/i18n-shared";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ error: "Missing barberId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: barber } = await supabase
    .from("users")
    .select("business_name, first_name, is_locked_out, accent_color, timezone, business_hours")
    .eq("user_id", barberId)
    .single();

  const hours = (barber?.business_hours || {}) as Record<string, unknown>;
  const openDays = Object.keys(hours).filter((d) => !!hours[d]);

  return NextResponse.json({
    businessName: barber?.business_name?.trim() || barber?.first_name?.trim() || null,
    openDays,
    isLockedOut: barber?.is_locked_out || false,
    accentColor: barber?.accent_color || null,
    timezone: barber?.timezone || DEFAULT_TZ,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { phone, barberId, firstName, consented, optInSource } = body;
  // The language the visitor saw the form in: their texts and the stored consent wording follow it.
  const language = isLocale(body.language) ? body.language : await getLocale();
  const t = (key: string) => translate(language, `vip.${key}`);

  if (!phone || !barberId) {
    return NextResponse.json(
      { error: t("err_required") },
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
    return NextResponse.json({ error: t("err_not_found") }, { status: 404 });
  }

  if (barber.is_locked_out) {
    return NextResponse.json(
      { error: t("err_offline") },
      { status: 503 }
    );
  }

  const phoneResult = normalizePhone(phone);
  if (!phoneResult.valid) {
    return NextResponse.json({ error: t("err_phone") }, { status: 400 });
  }
  const normalized = phoneResult.e164;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const source = toOptInSource(optInSource, "vip_form");

  const { data: existing } = await supabase
    .from("vip_clients")
    .select("id, is_opted_in, opted_out_at, opted_in_at, consent_text")
    .eq("user_id", barberId)
    .eq("phone_number", normalized)
    .single();

  if (existing) {
    if (existing.opted_out_at) {
      return NextResponse.json(
        { error: t("err_opted_out") },
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
        consent_text: didConsent ? recordedConsentText(body.consentText, language) : null,
        client_language: language,
        first_name: firstName || null,
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("VIP opt-in update error:", updateError);
      return NextResponse.json(
        { error: t("err_save") },
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
    consent_text: didConsent ? recordedConsentText(body.consentText, language) : null,
    client_language: language,
    first_name: firstName || null,
  });

  if (error) {
    console.error("VIP opt-in insert error:", error);
    return NextResponse.json(
      { error: t("err_save") },
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
