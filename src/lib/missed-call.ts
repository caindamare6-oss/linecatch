import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { issueToken } from "@/lib/client-session";
import { appUrl } from "@/lib/config";

type Admin = ReturnType<typeof createAdminClient>;

// Two calls inside 15 minutes get one text; a call after that gets another.
const COOLDOWN_MINUTES = 15;

export type MissedCallOutcome =
  | "texted"
  | "no_barber"
  | "autotext_disabled"
  | "trial_locked"
  | "opted_out"
  | "cooldown"
  | "no_template"
  | "send_failed"
  | "error";

/**
 * A call to a barber's LineCatch number went unanswered: text the caller the booking link.
 * Used both when we rang the barber and nobody picked up (direct mode) and when the carrier
 * forwarded an unanswered call to us (forwarded mode).
 *
 * Rules: every missed caller gets the link, opted in or not, as a reply to their own call; STOP and
 * opt-outs are respected; one text per caller every 15 minutes; the link recognizes the caller;
 * every call is logged in missed_calls, and a sent text shows in the activity feed.
 */
export async function handleMissedCall(
  supabase: Admin,
  { to, from, callSid }: { to: string; from: string; callSid: string | null }
): Promise<MissedCallOutcome> {
  try {
    const { data: barber, error: barberError } = await supabase
      .from("users")
      .select("user_id, phone_number, booking_link, is_active, business_name, first_name, is_locked_out, feature_autotext")
      .eq("phone_number", to)
      .single();

    if (barberError || !barber || !barber.is_active) return "no_barber";

    if (barber.feature_autotext === false) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "autotext_disabled");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return "autotext_disabled";
    }

    // Trial lockout — log but don't text
    if (barber.is_locked_out) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "trial_locked");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return "trial_locked";
    }

    const { data: vipClient } = await supabase
      .from("vip_clients")
      .select("id, is_opted_in, opted_out_at, first_name")
      .eq("user_id", barber.user_id)
      .eq("phone_number", from)
      .maybeSingle();

    const { data: optOut } = await supabase
      .from("opt_outs")
      .select("caller_phone")
      .eq("user_id", barber.user_id)
      .eq("caller_phone", from)
      .maybeSingle();

    if (vipClient?.opted_out_at || optOut) {
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "opted_out");
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return "opted_out";
    }

    const cooldownTime = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
    const { data: recentSend } = await supabase
      .from("missed_calls_log")
      .select("call_id")
      .eq("user_id", barber.user_id)
      .eq("caller_phone", from)
      .eq("status", "sms_sent")
      .gte("timestamp", cooldownTime)
      .limit(1)
      .maybeSingle();

    if (recentSend) {
      await logMissedCall(supabase, barber.user_id, from, callSid, true, null);
      await logCallLegacy(supabase, barber.user_id, from, to, "logged");
      return "cooldown";
    }

    const { data: callLog } = await logCallLegacy(supabase, barber.user_id, from, to, "logged");

    const shopName = barber.business_name?.trim() || barber.first_name?.trim() || "your barber";
    // Phone-mapped link token: opening the text recognizes the caller, no typing needed.
    const linkToken = await issueToken(supabase, { userId: barber.user_id, phone: from, kind: "link", verified: true });
    const tokenParam = linkToken ? `t=${linkToken}` : "";
    const trackingUrl = callLog?.call_id
      ? `${appUrl()}/api/track/${callLog.call_id}${tokenParam ? `?${tokenParam}` : ""}`
      : barber.booking_link || `${appUrl()}/book/${barber.user_id}?src=missed_call${tokenParam ? `&${tokenParam}` : ""}`;

    const sms = await buildSMS({
      userId: barber.user_id,
      templateKey: "missed_call",
      clientPhone: from,
      vars: { shop_name: shopName, link: trackingUrl },
    });
    if (!sms) return "no_template";

    const sent = await sendSMS({ to: from, from: barber.phone_number, body: sms.body, userId: barber.user_id, templateKey: "missed_call", language: sms.language });
    if (!sent) {
      // Landline, invalid number, Twilio down: don't count it as caught or claim a text went out.
      await logMissedCall(supabase, barber.user_id, from, callSid, false, "send_failed");
      return "send_failed";
    }
    await markFirstMessageSent(barber.user_id, from);
    await logMissedCall(supabase, barber.user_id, from, callSid, true, null);

    await supabase.from("activity_feed").insert({
      user_id: barber.user_id,
      event_type: "missed_call_caught",
      client_name: vipClient?.first_name || null,
      client_phone: from,
      description: `Missed call from ${vipClient?.first_name || "client"}, auto-text sent`,
      metadata: { call_sid: callSid },
    });

    if (callLog) {
      await supabase
        .from("missed_calls_log")
        .update({ status: "sms_sent", last_message_at: new Date().toISOString() })
        .eq("call_id", callLog.call_id);
    }
    return "texted";
  } catch (error) {
    console.error("Missed call handler error:", error);
    return "error";
  }
}

async function logMissedCall(supabase: Admin, userId: string, fromNumber: string, callSid: string | null, smsDispatched: boolean, suppressedReason: string | null) {
  await supabase.from("missed_calls").insert({
    user_id: userId,
    from_number: fromNumber,
    was_opted_in: !suppressedReason,
    sms_dispatched: smsDispatched,
    suppressed_reason: suppressedReason,
    call_sid: callSid,
  });
}

async function logCallLegacy(supabase: Admin, userId: string, callerPhone: string, barberPhone: string, status: string) {
  const { data } = await supabase
    .from("missed_calls_log")
    .insert({ user_id: userId, caller_phone: callerPhone, barber_phone: barberPhone, status, timestamp: new Date().toISOString() })
    .select("call_id")
    .single();
  return { data };
}
