import { createAdminClient } from "@/lib/supabase/admin";
import { barberLocalToUTC } from "@/lib/format";

type Admin = ReturnType<typeof createAdminClient>;
type Hours = Record<string, { open: string; close: string } | null> | null | undefined;

const MINUTE = 60 * 1000;
export const STEP_MINUTES = 30;

/** "2026-10-07" → "wednesday", for the barber's business_hours keys. */
const dayNameOf = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();

/** Today's date in the barber's timezone, plus `offset` days ("YYYY-MM-DD"). */
export function localDate(tz: string, offset = 0, from = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(from);
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Free start times ("HH:MM", barber's wall clock) on one day for an appointment of `totalMinutes`:
 * inside business hours, in the future, every 30 minutes, not overlapping a confirmed booking.
 */
export async function daySlots(db: Admin, opts: { userId: string; date: string; totalMinutes: number; hours: Hours; tz: string; now?: number }): Promise<string[]> {
  const { userId, date, totalMinutes, tz } = opts;
  const day = opts.hours?.[dayNameOf(date)];
  if (!day) return [];

  const [openH, openM] = day.open.split(":").map(Number);
  const [closeH, closeM] = day.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const dayStart = barberLocalToUTC(date, "00:00", tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MINUTE);

  const { data: existing } = await db
    .from("bookings")
    .select("booking_time, service_id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("booking_time", new Date(dayStart.getTime() - 12 * 60 * MINUTE).toISOString())
    .lt("booking_time", dayEnd.toISOString());

  const serviceIds = [...new Set((existing || []).map((b) => b.service_id))];
  const { data: durations } = serviceIds.length
    ? await db.from("services").select("id, duration_minutes").in("id", serviceIds)
    : { data: [] as { id: string; duration_minutes: number }[] };
  const durMap = new Map((durations || []).map((s) => [s.id, s.duration_minutes as number]));

  const booked = (existing || []).map((b) => {
    const start = new Date(b.booking_time).getTime();
    return { start, end: start + (durMap.get(b.service_id) || 30) * MINUTE };
  });

  const now = opts.now ?? Date.now();
  const slots: string[] = [];
  for (let m = openMinutes; m + totalMinutes <= closeMinutes; m += STEP_MINUTES) {
    const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const start = barberLocalToUTC(date, hhmm, tz).getTime();
    if (start <= now) continue;
    const end = start + totalMinutes * MINUTE;
    if (!booked.some((b) => start < b.end && end > b.start)) slots.push(hhmm);
  }
  return slots;
}

/** The next few open start times, looking up to `days` days ahead (for "Next opening" on the portfolio). */
export async function nextOpenings(
  db: Admin,
  opts: { userId: string; totalMinutes: number; hours: Hours; tz: string; days?: number; count?: number; now?: number },
): Promise<{ date: string; time: string; dayOffset: number }[]> {
  const found: { date: string; time: string; dayOffset: number }[] = [];
  const days = opts.days ?? 14;
  const count = opts.count ?? 3;
  for (let offset = 0; offset < days && found.length < count; offset++) {
    const date = localDate(opts.tz, offset, opts.now ? new Date(opts.now) : undefined);
    if (!opts.hours?.[dayNameOf(date)]) continue;
    const slots = await daySlots(db, { ...opts, date });
    for (const time of slots) {
      found.push({ date, time, dayOffset: offset });
      if (found.length >= count) break;
    }
    // "Then 4:15 and 5:00" only makes sense on the same day.
    if (found.length) break;
  }
  return found;
}
