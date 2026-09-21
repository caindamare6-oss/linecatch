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

  const { data: barbers } = await supabase
    .from("users")
    .select("user_id, phone_number, business_name, timezone, is_locked_out, is_active")
    .eq("is_active", true)
    .eq("is_locked_out", false);

  if (!barbers || barbers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  for (const barber of barbers) {
    const tz = barber.timezone || "America/New_York";
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    if (localTime.getHours() !== 8) continue;

    const dayStart = new Date(localTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(localTime);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("id, customer_phone, booking_time")
      .eq("user_id", barber.user_id)
      .eq("status", "confirmed")
      .gte("booking_time", dayStart.toISOString())
      .lte("booking_time", dayEnd.toISOString())
      .order("booking_time", { ascending: true });

    if (!todayBookings || todayBookings.length === 0) continue;

    const cutsToday = todayBookings.length;
    const firstBookingTime = new Date(todayBookings[0].booking_time);
    const firstTime = firstBookingTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });

    let vipNote = "";
    for (const b of todayBookings) {
      const { data: vip } = await supabase
        .from("vip_clients")
        .select("cut_count, has_claimed_onboarding_discount")
        .eq("user_id", barber.user_id)
        .eq("phone_number", b.customer_phone)
        .single();

      if (vip && vip.cut_count === 0 && !vip.has_claimed_onboarding_discount) {
        const count = vipNote ? parseInt(vipNote) + 1 : 1;
        vipNote = String(count);
      }
    }

    const vipLine = vipNote
      ? `${vipNote} new VIP${parseInt(vipNote) > 1 ? "s" : ""} — $5 off.`
      : "";

    const msg = `${cutsToday} cut${cutsToday > 1 ? "s" : ""} today, first at ${firstTime}. ${vipLine}`.trim();

    try {
      await sendSMS(barber.phone_number, barber.phone_number, msg);
      sent++;
    } catch (err) {
      console.error(`Morning summary failed for ${barber.user_id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
