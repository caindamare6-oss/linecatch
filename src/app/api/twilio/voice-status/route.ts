import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS, validateTwilioRequest } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";

const COOLDOWN_HOURS = 3;

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  const signature = request.headers.get("x-twilio-signature") || "";
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice-status`;

  if (!validateTwilioRequest(signature, url, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const dialCallStatus = params.DialCallStatus || params.CallStatus;
  const to = params.To;
  const from = params.From;
  const callSid = params.CallSid || null;

  if (!["no-answer", "busy", "failed", "canceled"].includes(dialCallStatus)) {
    return new NextResponse("OK", { status: 200 });
  }

  const supabase = createAdminClient();

  try {
    const { data: barber, error: barberError } = await supabase
      .from("users")
      .select(
        "user_id, phone_number, booking_link, is_active, business_name, is_locked_out, feature_autotext"
      )
      .eq("phone_number", to)
      .single();

    if (barberError || !barber || !barber.is_active) {
      return new NextResponse("OK", { status: 200 });
    }

    if (barber.feature_autotext === false) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "autotext_disabled");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return new NextResponse("OK", { status: 200 });
    }

    // Trial lockout — log but don't text
    if (barber.is_locked_out) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "trial_locked");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return new NextResponse("OK", { status: 200 });
    }

    // Check consent in vip_clients
    const { data: vipClient } = await supabase
      .from("vip_clients")
      .select("id, is_opted_in, opted_out_at")
      .eq("user_id", barber.user_id)
      .eq("phone_number", from)
      .single();

    if (!vipClient || !vipClient.is_opted_in) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "no_consent");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return new NextResponse("OK", { status: 200 });
    }

    if (vipClient.opted_out_at) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "opted_out");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return new NextResponse("OK", { status: 200 });
    }

    // Check opt_outs table too
    const { data: optOut } = await supabase
      .from("opt_outs")
      .select("caller_phone")
      .eq("user_id", barber.user_id)
      .eq("caller_phone", from)
      .single();

    if (optOut) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "opted_out");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return new NextResponse("OK", { status: 200 });
    }

    // Cooldown check
    const cooldownTime = new Date(
      Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: recentSend } = await supabase
      .from("missed_calls_log")
      .select("call_id")
      .eq("user_id", barber.user_id)
      .eq("caller_phone", from)
      .eq("status", "sms_sent")
      .gte("timestamp", cooldownTime)
      .limit(1)
      .single();

    if (recentSend) {
      await logMissedCall(supabase, barber.user_id, from, callSid, true, null);
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return new NextResponse("OK", { status: 200 });
    }

    const { data: callLog } = await logCallLegacy(
      supabase,
      barber.user_id,
      from,
      to,
      "logged"
    );

    const shopName = barber.business_name || "your barber";
    const trackingUrl = callLog?.call_id
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/track/${callLog.call_id}`
      : barber.booking_link || "";

    const msg = await buildSMS({
      userId: barber.user_id,
      templateKey: "missed_call",
      clientPhone: from,
      vars: { shop_name: shopName, link: trackingUrl },
    });

    if (!msg) {
      return new NextResponse("OK", { status: 200 });
    }

    await sendSMS(from, barber.phone_number, msg);
    await markFirstMessageSent(barber.user_id, from);
    await logMissedCall(supabase, barber.user_id, from, callSid, true, null);

    // Get client name for activity feed
    const { data: vipForActivity } = await supabase
      .from("vip_clients")
      .select("first_name")
      .eq("user_id", barber.user_id)
      .eq("phone_number", from)
      .single();

    await supabase.from("activity_feed").insert({
      user_id: barber.user_id,
      event_type: "missed_call_caught",
      client_name: vipForActivity?.first_name || null,
      client_phone: from,
      description: `Missed call from ${vipForActivity?.first_name || "client"} — auto-text sent`,
      metadata: { call_sid: callSid },
    });

    if (callLog) {
      await supabase
        .from("missed_calls_log")
        .update({
          status: "sms_sent",
          last_message_at: new Date().toISOString(),
        })
        .eq("call_id", callLog.call_id);
    }
  } catch (error) {
    console.error("Voice status handler error:", error);
    await logCallLegacy(supabase, params.user_id || "", from, to, "failed");
  }

  return new NextResponse("OK", { status: 200 });
}

async function logMissedCall(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  fromNumber: string,
  callSid: string | null,
  smsDispatched: boolean,
  suppressedReason: string | null
) {
  await supabase.from("missed_calls").insert({
    user_id: userId,
    from_number: fromNumber,
    was_opted_in: !suppressedReason,
    sms_dispatched: smsDispatched,
    suppressed_reason: suppressedReason,
    call_sid: callSid,
  });
}

async function logCallLegacy(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  callerPhone: string,
  barberPhone: string,
  status: string
) {
  const { data } = await supabase
    .from("missed_calls_log")
    .insert({
      user_id: userId,
      caller_phone: callerPhone,
      barber_phone: barberPhone,
      status,
      timestamp: new Date().toISOString(),
    })
    .select("call_id")
    .single();

  return { data };
}
