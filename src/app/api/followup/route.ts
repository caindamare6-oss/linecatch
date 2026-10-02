import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { appUrl } from "@/lib/config";

const FOLLOWUP_DELAY_HOURS = 2;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(
    Date.now() - FOLLOWUP_DELAY_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Find calls that were sms_sent, not yet followed up, sent more than 2 hours ago
  const { data: candidates } = await supabase
    .from("missed_calls_log")
    .select("call_id, user_id, caller_phone, barber_phone, last_message_at")
    .eq("status", "sms_sent")
    .eq("followed_up", false)
    .lt("last_message_at", cutoff)
    .order("last_message_at", { ascending: true })
    .limit(50);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const call of candidates) {
    // Re-check opt-outs before each followup
    const { data: optOut } = await supabase
      .from("opt_outs")
      .select("caller_phone")
      .eq("user_id", call.user_id)
      .eq("caller_phone", call.caller_phone)
      .single();

    if (optOut) {
      await supabase
        .from("missed_calls_log")
        .update({ followed_up: true })
        .eq("call_id", call.call_id);
      continue;
    }

    // No second text if they already acted on the first: replied, tapped the link, or booked.
    const since = call.last_message_at;
    const [{ count: replied }, { count: clicked }, { count: booked }] = await Promise.all([
      supabase.from("sms_log").select("id", { count: "exact", head: true }).eq("user_id", call.user_id).eq("direction", "inbound").eq("from_number", call.caller_phone).gt("created_at", since),
      supabase.from("link_clicks").select("click_id", { count: "exact", head: true }).eq("call_id", call.call_id),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", call.user_id).eq("customer_phone", call.caller_phone).gt("created_at", since),
    ]);
    if ((replied ?? 0) > 0 || (clicked ?? 0) > 0 || (booked ?? 0) > 0) {
      await supabase.from("missed_calls_log").update({ followed_up: true }).eq("call_id", call.call_id);
      continue;
    }

    // A newer missed-call text to this caller starts a fresh cycle; skip this old one.
    const { data: newerCall } = await supabase
      .from("missed_calls_log")
      .select("call_id")
      .eq("user_id", call.user_id)
      .eq("caller_phone", call.caller_phone)
      .eq("status", "sms_sent")
      .gt("timestamp", call.last_message_at)
      .limit(1)
      .single();

    if (newerCall) {
      await supabase
        .from("missed_calls_log")
        .update({ followed_up: true })
        .eq("call_id", call.call_id);
      continue;
    }

    const { data: barber } = await supabase
      .from("users")
      .select("phone_number, booking_link, business_name, is_active, is_locked_out, feature_autotext")
      .eq("user_id", call.user_id)
      .single();

    if (!barber || !barber.is_active || barber.is_locked_out || barber.feature_autotext === false) {
      await supabase
        .from("missed_calls_log")
        .update({ followed_up: true })
        .eq("call_id", call.call_id);
      continue;
    }

    const { data: vipClient } = await supabase
      .from("vip_clients")
      .select("is_opted_in, opted_out_at")
      .eq("user_id", call.user_id)
      .eq("phone_number", call.caller_phone)
      .single();

    if (!vipClient || !vipClient.is_opted_in || vipClient.opted_out_at) {
      await supabase
        .from("missed_calls_log")
        .update({ followed_up: true })
        .eq("call_id", call.call_id);
      continue;
    }

    try {
      // Always the tracked link: it forwards to the barber's booking page or their outside booking site.
      const trackingUrl = `${appUrl()}/api/track/${call.call_id}`;

      const sms = await buildSMS({
        userId: call.user_id,
        templateKey: "missed_call",
        clientPhone: call.caller_phone,
        vars: {
          shop_name: barber.business_name?.trim() || "",
          link: trackingUrl,
        },
      });

      if (!sms) {
        await supabase
          .from("missed_calls_log")
          .update({ followed_up: true })
          .eq("call_id", call.call_id);
        continue;
      }

      await sendSMS({ to: call.caller_phone, from: barber.phone_number, body: sms.body, userId: call.user_id, templateKey: "missed_call", language: sms.language });
      await markFirstMessageSent(call.user_id, call.caller_phone);

      await supabase
        .from("missed_calls_log")
        .update({
          followed_up: true,
          last_message_at: new Date().toISOString(),
        })
        .eq("call_id", call.call_id);

      sent++;
    } catch (error) {
      console.error(`Followup failed for call ${call.call_id}:`, error);
      await supabase
        .from("missed_calls_log")
        .update({ followed_up: true })
        .eq("call_id", call.call_id);
    }
  }

  return NextResponse.json({ sent, checked: candidates.length });
}
