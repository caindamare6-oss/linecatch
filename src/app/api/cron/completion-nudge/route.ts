import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  let sent = 0;

  // Find confirmed bookings whose end time was 10–70 minutes ago (one-hour cron window)
  const windowEnd = new Date(now.getTime() - 10 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 70 * 60 * 1000);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id, status")
    .eq("status", "confirmed")
    .gte("booking_time", new Date(windowStart.getTime() - 4 * 60 * 60 * 1000).toISOString())
    .lte("booking_time", windowEnd.toISOString());

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
  const { data: services } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .in("id", serviceIds);

  const durationMap: Record<string, number> = {};
  for (const s of services || []) {
    durationMap[s.id] = s.duration_minutes;
  }

  const barberIds = [...new Set(bookings.map((b) => b.user_id))];
  const { data: barbers } = await supabase
    .from("users")
    .select("user_id, phone_number, is_locked_out, is_active")
    .in("user_id", barberIds);

  const barberMap: Record<string, { phone_number: string; is_locked_out: boolean; is_active: boolean }> = {};
  for (const b of barbers || []) {
    barberMap[b.user_id] = { phone_number: b.phone_number, is_locked_out: b.is_locked_out, is_active: b.is_active };
  }

  for (const booking of bookings) {
    const duration = durationMap[booking.service_id] || 30;
    const endTime = new Date(new Date(booking.booking_time).getTime() + duration * 60 * 1000);
    const minutesSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60);

    if (minutesSinceEnd < 10 || minutesSinceEnd > 70) continue;

    const barber = barberMap[booking.user_id];
    if (!barber || barber.is_locked_out || !barber.is_active) continue;

    const { data: vip } = await supabase
      .from("vip_clients")
      .select("first_name")
      .eq("user_id", booking.user_id)
      .eq("phone_number", booking.customer_phone)
      .single();

    const clientName = vip?.first_name || "your client";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.linecatch.app";
    const link = `${appUrl}/dashboard/schedule?highlight=${booking.id}`;

    const msg = `Done with ${clientName}? Tap to complete: ${link}`;

    try {
      await sendSMS(barber.phone_number, barber.phone_number, msg);
      sent++;
    } catch (err) {
      console.error(`Completion nudge failed for booking ${booking.id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
