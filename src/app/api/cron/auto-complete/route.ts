import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronNow } from "@/lib/retention";
import { AUTO_COMPLETE_AFTER_HOURS, completeBooking } from "@/lib/complete-booking";

export const maxDuration = 60;

const HOUR = 3_600_000;
/**
 * Only cuts from the last day. Anything older nobody touched is left for the barber, so a
 * loyalty text never goes out days after the visit.
 */
const LOOKBACK_HOURS = 24;
const PER_RUN = 200;

/**
 * Every 15 minutes: a cut that ended 2+ hours ago and wasn't marked done or no-show counts as
 * done, exactly as if the barber had tapped it (stamp, loyalty text, review request).
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const now = cronNow(request).getTime();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, booking_time, service_id")
    .eq("status", "confirmed")
    .gte("booking_time", new Date(now - LOOKBACK_HOURS * HOUR).toISOString())
    .lte("booking_time", new Date(now - AUTO_COMPLETE_AFTER_HOURS * HOUR).toISOString())
    .order("booking_time", { ascending: true })
    .limit(PER_RUN);
  if (!bookings?.length) return NextResponse.json({ completed: 0 });

  const [{ data: services }, { data: barbers }] = await Promise.all([
    supabase.from("services").select("id, duration_minutes").in("id", [...new Set(bookings.map((b) => b.service_id))]),
    supabase.from("users").select("user_id, is_active, is_locked_out").in("user_id", [...new Set(bookings.map((b) => b.user_id))]),
  ]);
  const minutes = new Map((services || []).map((s) => [s.id, s.duration_minutes as number]));
  // A locked or inactive account sends no texts, so its cuts wait for the barber.
  const live = new Set((barbers || []).filter((b) => b.is_active && !b.is_locked_out).map((b) => b.user_id));

  let completed = 0;
  for (const b of bookings) {
    if (!live.has(b.user_id)) continue;
    const end = new Date(b.booking_time).getTime() + (minutes.get(b.service_id) || 30) * 60_000;
    if (end + AUTO_COMPLETE_AFTER_HOURS * HOUR > now) continue;
    const r = await completeBooking(supabase, b.id, "auto");
    if (r.ok) completed++;
    else if (r.error === "failed") console.error(`Auto-complete failed for booking ${b.id}`);
  }
  return NextResponse.json({ completed });
}
