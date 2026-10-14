import { NextResponse } from "next/server";
import { cronNow } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { formatCasualTime } from "@/lib/format";
import { projectVisit, rewardVars, DEFAULT_LOYALTY } from "@/lib/loyalty";
import { DEFAULT_TZ, appUrl } from "@/lib/config";


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

    // Every client gets reminders unless they replied STOP
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
        ...rewardVars(!!loyalty?.due, loyalty?.loyalty ?? DEFAULT_LOYALTY, loyalty?.rewardCents ?? 0),
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

  return NextResponse.json({ sent, checked: upcomingBookings?.length ?? 0 });
}
