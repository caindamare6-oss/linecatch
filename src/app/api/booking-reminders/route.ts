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

  return NextResponse.json({ sent, checked: upcomingBookings.length });
}
