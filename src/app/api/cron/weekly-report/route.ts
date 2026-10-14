import { NextResponse } from "next/server";
import { barberLocalToUTC } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { DEFAULT_TZ } from "@/lib/config";
import { hasNews, weeklyNumbers, weeklySummaryEmail } from "@/lib/weekly-summary";

/**
 * Hourly; acts at 8am Monday on each barber's own clock. Emails the barber their week:
 * missed calls caught → booked → money saved. Skips barbers with nothing caught or who turned it off.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const now = new Date();
  let sent = 0;

  const { data: barbers } = await db
    .from("users")
    .select("user_id, email, business_name, timezone")
    .eq("is_active", true)
    .eq("is_locked_out", false)
    .eq("weekly_email", true)
    .not("email", "is", null);

  for (const b of barbers || []) {
    const tz = b.timezone || DEFAULT_TZ;
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    if (local.getDay() !== 1 || local.getHours() !== 8) continue;

    // Last Monday 00:00 to this Monday 00:00, on the barber's wall clock.
    const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
    const end = barberLocalToUTC(ymd(now), "00:00", tz);
    const start = barberLocalToUTC(ymd(new Date(end.getTime() - 6.5 * 86_400_000)), "00:00", tz);

    const numbers = await weeklyNumbers(db, b.user_id, start, end);
    if (!hasNews(numbers)) continue;

    const { subject, html } = weeklySummaryEmail(numbers, b.business_name?.trim() || null);
    if (await sendEmail({ to: b.email!, subject, html, replyTo: "support@linecatch.app" })) sent++;
  }

  return NextResponse.json({ sent });
}
