import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { barberLocalToUTC, formatCasualTime } from "@/lib/format";
import { projectVisit, REWARD_CENTS } from "@/lib/loyalty";
import { DEFAULT_TZ, money } from "@/lib/config";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  let sent = 0;

  // Housekeeping: client recognition tokens past their expiry are useless; drop them.
  await supabase.from("client_sessions").delete().lt("expires_at", new Date().toISOString());

  const { data: barbers } = await supabase
    .from("users")
    .select("user_id, phone_number, forwarding_number, business_name, timezone, is_locked_out, is_active, barber_language")
    .eq("is_active", true)
    .eq("is_locked_out", false);

  if (!barbers || barbers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  for (const barber of barbers) {
    const tz = barber.timezone || DEFAULT_TZ;
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    if (localTime.getHours() !== 8) continue;

    // Midnight to midnight on the barber's wall clock (the server runs in UTC).
    const today = now.toLocaleDateString("en-CA", { timeZone: tz });
    const dayStart = barberLocalToUTC(today, "00:00", tz);
    const dayEnd = new Date(barberLocalToUTC(new Date(dayStart.getTime() + 36 * 3_600_000).toLocaleDateString("en-CA", { timeZone: tz }), "00:00", tz).getTime() - 1);

    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("id, customer_phone, booking_time, group_id")
      .eq("user_id", barber.user_id)
      .eq("status", "confirmed")
      .gte("booking_time", dayStart.toISOString())
      .lte("booking_time", dayEnd.toISOString())
      .order("booking_time", { ascending: true });

    if (!todayBookings || todayBookings.length === 0) continue;

    const cutsToday = todayBookings.length;
    const firstBookingTime = new Date(todayBookings[0].booking_time);
    const firstTime = formatCasualTime(firstBookingTime, tz);

    const visitKeys = new Set<string>();
    let rewardsDue = 0;
    let rewardCents = REWARD_CENTS;
    for (const b of todayBookings) {
      const key = b.group_id || b.id;
      if (visitKeys.has(key)) continue;
      visitKeys.add(key);
      const p = await projectVisit(supabase, b.id);
      if (p) rewardCents = p.loyalty.cents;
      if (p?.due && !p.alreadyRewarded) rewardsDue++;
    }

    const es = barber.barber_language === "es";
    const rewardLine = !rewardsDue
      ? ""
      : es
        ? `${rewardsDue} ${rewardsDue === 1 ? "tiene" : "tienen"} ${money(rewardCents)} de descuento (mira la insignia).`
        : `${rewardsDue} get${rewardsDue === 1 ? "s" : ""} ${money(rewardCents)} off (check the badge).`;

    const msg = (es
      ? `${cutsToday} ${cutsToday > 1 ? "cortes" : "corte"} hoy, el primero a las ${firstTime}. ${rewardLine}`
      : `${cutsToday} cut${cutsToday > 1 ? "s" : ""} today, first at ${firstTime}. ${rewardLine}`).trim();

    try {
      if (!barber.forwarding_number) continue;
      await sendSMS({ to: barber.forwarding_number, from: barber.phone_number, body: msg, userId: barber.user_id, templateKey: "morning_summary", language: barber.barber_language || "en", audience: "barber" });
      sent++;
    } catch (err) {
      console.error(`Morning summary failed for ${barber.user_id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
