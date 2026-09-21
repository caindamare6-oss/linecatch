import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { resolveTemplate, interpolateTemplate } from "@/lib/messages";

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
    .select("user_id, phone_number, business_name, timezone, is_locked_out, is_active, avg_booking_value")
    .eq("is_active", true)
    .eq("is_locked_out", false);

  if (!barbers || barbers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  for (const barber of barbers) {
    const tz = barber.timezone || "America/New_York";
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    if (localTime.getDay() !== 0 || localTime.getHours() !== 9) continue;

    const weekStart = new Date(localTime);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(localTime);
    weekEnd.setHours(0, 0, 0, 0);

    const { count: cutsCount } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", barber.user_id)
      .eq("status", "completed")
      .gte("booking_time", weekStart.toISOString())
      .lt("booking_time", weekEnd.toISOString());

    const cuts = cutsCount || 0;
    if (cuts === 0) continue;

    const avgValue = barber.avg_booking_value || 35;
    const revenue = (cuts * avgValue).toFixed(0);

    const { count: newVips } = await supabase
      .from("vip_clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", barber.user_id)
      .gte("opted_in_at", weekStart.toISOString())
      .lt("opted_in_at", weekEnd.toISOString());

    const { count: missedCaught } = await supabase
      .from("missed_calls_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", barber.user_id)
      .eq("status", "sms_sent")
      .gte("timestamp", weekStart.toISOString())
      .lt("timestamp", weekEnd.toISOString());

    const { count: reviewsSent } = await supabase
      .from("vip_clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", barber.user_id)
      .gte("last_review_request_at", weekStart.toISOString())
      .lt("last_review_request_at", weekEnd.toISOString());

    const { data: barberProfile } = await supabase
      .from("users")
      .select("first_name")
      .eq("user_id", barber.user_id)
      .single();

    const barberName = barberProfile?.first_name || barber.business_name || "Boss";

    const template = await resolveTemplate(barber.user_id, "weekly_report", "en");
    const msg = template
      ? interpolateTemplate(template, {
          barber_name: barberName,
          cuts: String(cuts),
          revenue,
          new_vips: String(newVips || 0),
          missed_caught: String(missedCaught || 0),
          reviews_sent: String(reviewsSent || 0),
        })
      : `Weekly recap for ${barberName}: ${cuts} cuts, $${revenue} earned, ${newVips || 0} new VIPs, ${missedCaught || 0} missed calls caught, ${reviewsSent || 0} review requests sent.`;

    try {
      await sendSMS(barber.phone_number, barber.phone_number, msg);
      sent++;
    } catch (err) {
      console.error(`Weekly report failed for ${barber.user_id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
