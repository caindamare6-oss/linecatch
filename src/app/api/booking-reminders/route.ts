import { NextResponse } from "next/server";
import { getMarketingState } from "@/lib/marketing";
import { cronNow } from "@/lib/retention";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { formatCasualTime } from "@/lib/format";
import { projectVisit, rewardVars, REWARD_CENTS } from "@/lib/loyalty";
import { DEFAULT_TZ, appUrl } from "@/lib/config";

const REVIEW_DELAY_HOURS = 2;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = cronNow(request);
  let sent = 0;

  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id, group_id")
    .eq("status", "confirmed")
    .gte("booking_time", now.toISOString())
    .lte("booking_time", horizon.toISOString());

  // No early return when nothing is coming up: review requests below still need to go out.
  for (const booking of upcomingBookings || []) {
    // One reminder per group, keyed to the first person's slot.
    if (booking.group_id) {
      const { data: earlier } = await supabase
        .from("bookings")
        .select("id")
        .eq("group_id", booking.group_id)
        .lt("booking_time", booking.booking_time)
        .limit(1)
        .maybeSingle();
      if (earlier) continue;
    }

    const bookingTime = new Date(booking.booking_time);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    let reminderType: string | null = null;
    if (hoursUntil <= 2.5 && hoursUntil > 1.5) {
      reminderType = "2h";
    } else if (hoursUntil <= 24.5 && hoursUntil > 23.5) {
      reminderType = "24h";
    }

    if (!reminderType) continue;

    // Re-check booking status
    const { data: freshBooking } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", booking.id)
      .single();

    if (!freshBooking || freshBooking.status !== "confirmed") continue;

    // Check if already sent
    const { data: existing } = await supabase
      .from("booking_reminders")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("reminder_type", reminderType)
      .single();

    if (existing) continue;

    // Check vip_clients consent
    const { data: vipClient } = await supabase
      .from("vip_clients")
      .select("is_opted_in, opted_out_at")
      .eq("user_id", booking.user_id)
      .eq("phone_number", booking.customer_phone)
      .single();

    if (!vipClient || !vipClient.is_opted_in || vipClient.opted_out_at) continue;

    // Check opt_outs table
    const { data: optOut } = await supabase
      .from("opt_outs")
      .select("caller_phone")
      .eq("user_id", booking.user_id)
      .eq("caller_phone", booking.customer_phone)
      .single();

    if (optOut) continue;

    const { data: barber } = await supabase
      .from("users")
      .select("phone_number, business_name, first_name, timezone")
      .eq("user_id", booking.user_id)
      .single();

    if (!barber) continue;

    const tz = barber.timezone || DEFAULT_TZ;
    const timeStr = formatCasualTime(bookingTime, tz);
    const shopName = barber.business_name?.trim() || barber.first_name?.trim() || "your barber";
    const templateKey = reminderType === "24h" ? "reminder_24h" : "reminder_2h";
    const loyalty = reminderType === "2h" ? await projectVisit(supabase, booking.id) : null;

    const sms = await buildSMS({
      userId: booking.user_id,
      templateKey,
      clientPhone: booking.customer_phone,
      vars: {
        shop_name: shopName,
        time: timeStr,
        link: `${appUrl()}/manage/${booking.id}`,
        ...rewardVars(!!loyalty?.due, loyalty?.loyalty.cents ?? REWARD_CENTS),
      },
    });

    if (!sms) continue;

    // Claim the reminder before sending (booking_id + reminder_type is unique), so two
    // overlapping runs can't both text the client. If the text doesn't go out, release the claim.
    const { error: claimError } = await supabase.from("booking_reminders").insert({
      booking_id: booking.id,
      reminder_type: reminderType,
    });
    if (claimError) continue;
    const release = () => supabase.from("booking_reminders").delete().eq("booking_id", booking.id).eq("reminder_type", reminderType);

    try {
      const ok = await sendSMS({ to: booking.customer_phone, from: barber.phone_number, body: sms.body, userId: booking.user_id, templateKey, language: sms.language });
      if (!ok) {
        await release();
        continue;
      }
      await markFirstMessageSent(booking.user_id, booking.customer_phone);
      sent++;
    } catch (err) {
      console.error(`Reminder failed for booking ${booking.id}:`, err);
      await release();
    }
  }

  // Delayed review requests: 2 hours after the visit is marked done (cron runs every 15 min, so 2–2¼h).
  const { data: pendingReviews } = await supabase
    .from("booking_reminders")
    .select("booking_id")
    .eq("reminder_type", "review");

  let reviewsSent = 0;

  if (pendingReviews && pendingReviews.length > 0) {
    const reviewAfter = new Date(now.getTime() - REVIEW_DELAY_HOURS * 60 * 60 * 1000);

    for (const pr of pendingReviews) {
      const { data: completionEvent } = await supabase
        .from("activity_feed")
        .select("created_at, user_id, client_phone, client_name")
        .eq("event_type", "booking_completed")
        .eq("metadata->>booking_id", pr.booking_id)
        .single();

      if (!completionEvent || new Date(completionEvent.created_at) > reviewAfter) continue;

      const { data: barber } = await supabase
        .from("users")
        .select("phone_number, business_name, first_name, google_review_url, feature_reviews")
        .eq("user_id", completionEvent.user_id)
        .single();

      if (!barber?.google_review_url || barber.feature_reviews === false || (await getMarketingState(supabase, completionEvent.user_id)) !== "on") {
        await supabase.from("booking_reminders").delete()
          .eq("booking_id", pr.booking_id).eq("reminder_type", "review");
        continue;
      }

      const { data: vipClient } = await supabase
        .from("vip_clients")
        .select("id, is_opted_in, opted_out_at")
        .eq("user_id", completionEvent.user_id)
        .eq("phone_number", completionEvent.client_phone)
        .single();

      if (!vipClient || !vipClient.is_opted_in || vipClient.opted_out_at) {
        await supabase.from("booking_reminders").delete()
          .eq("booking_id", pr.booking_id).eq("reminder_type", "review");
        continue;
      }

      const shopName = barber.business_name?.trim() || barber.first_name?.trim() || "your barber";

      const reviewSms = await buildSMS({
        userId: completionEvent.user_id,
        templateKey: "review_request",
        clientPhone: completionEvent.client_phone,
        // {link} too, so a custom template written with {link} still carries the review link.
        vars: { shop_name: shopName, review_url: barber.google_review_url, link: barber.google_review_url },
      });

      if (reviewSms) {
        try {
          await sendSMS({ to: completionEvent.client_phone, from: barber.phone_number, body: reviewSms.body, userId: completionEvent.user_id, templateKey: "review_request", language: reviewSms.language });
          await markFirstMessageSent(completionEvent.user_id, completionEvent.client_phone);
          await supabase
            .from("vip_clients")
            .update({ last_review_request_at: now.toISOString() })
            .eq("id", vipClient.id);
          await supabase.from("activity_feed").insert({
            user_id: completionEvent.user_id,
            event_type: "review_sent",
            client_name: completionEvent.client_name,
            client_phone: completionEvent.client_phone,
            description: `Google review request sent to ${completionEvent.client_name || "client"}`,
            metadata: {},
          });
          reviewsSent++;
        } catch (err) {
          console.error(`Review SMS failed for booking ${pr.booking_id}:`, err);
        }
      }

      await supabase.from("booking_reminders").delete()
        .eq("booking_id", pr.booking_id).eq("reminder_type", "review");
    }
  }

  return NextResponse.json({ sent, reviewsSent, checked: upcomingBookings?.length ?? 0 });
}
