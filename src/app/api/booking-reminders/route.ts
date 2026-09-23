import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  let sent = 0;

  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id")
    .eq("status", "confirmed")
    .gte("booking_time", now.toISOString())
    .lte("booking_time", horizon.toISOString());

  if (!upcomingBookings || upcomingBookings.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  for (const booking of upcomingBookings) {
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
      .select("phone_number, business_name")
      .eq("user_id", booking.user_id)
      .single();

    if (!barber) continue;

    const timeStr = bookingTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const shopName = barber.business_name || "your barber";
    const templateKey = reminderType === "24h" ? "reminder_24h" : "reminder_2h";

    const msg = await buildSMS({
      userId: booking.user_id,
      templateKey,
      clientPhone: booking.customer_phone,
      vars: { shop_name: shopName, time: timeStr },
    });

    if (!msg) continue;

    try {
      await sendSMS(booking.customer_phone, barber.phone_number, msg);
      await markFirstMessageSent(booking.user_id, booking.customer_phone);
      await supabase.from("booking_reminders").insert({
        booking_id: booking.id,
        reminder_type: reminderType,
      });
      sent++;
    } catch (err) {
      console.error(`Reminder failed for booking ${booking.id}:`, err);
    }
  }

  // Delayed review requests: send 3h after booking completion
  const { data: pendingReviews } = await supabase
    .from("booking_reminders")
    .select("booking_id")
    .eq("reminder_type", "review");

  let reviewsSent = 0;

  if (pendingReviews && pendingReviews.length > 0) {
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    for (const pr of pendingReviews) {
      const { data: completionEvent } = await supabase
        .from("activity_feed")
        .select("created_at, user_id, client_phone, client_name")
        .eq("event_type", "booking_completed")
        .eq("metadata->>booking_id", pr.booking_id)
        .single();

      if (!completionEvent || new Date(completionEvent.created_at) > threeHoursAgo) continue;

      const { data: barber } = await supabase
        .from("users")
        .select("phone_number, business_name, google_review_url")
        .eq("user_id", completionEvent.user_id)
        .single();

      if (!barber?.google_review_url) {
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

      const shopName = barber.business_name || "your barber";

      const reviewMsg = await buildSMS({
        userId: completionEvent.user_id,
        templateKey: "review_request",
        clientPhone: completionEvent.client_phone,
        vars: { shop_name: shopName, review_url: barber.google_review_url },
      });

      if (reviewMsg) {
        try {
          await sendSMS(completionEvent.client_phone, barber.phone_number, reviewMsg);
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

  return NextResponse.json({ sent, reviewsSent, checked: upcomingBookings.length });
}
