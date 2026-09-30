import { createAdminClient } from "@/lib/supabase/admin";
import { minutesInTz } from "@/lib/format";

type Admin = ReturnType<typeof createAdminClient>;
export type BusinessHours = Record<string, { open: string; close: string } | null> | null;

const MINUTE = 60 * 1000;

export function weekdayInTz(date: Date, tz: string): string {
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: tz }).toLowerCase();
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function withinBusinessHours(hours: BusinessHours, start: Date, durationMinutes: number, tz: string): boolean {
  const day = hours?.[weekdayInTz(start, tz)];
  if (!day) return false;
  const startMin = minutesInTz(start, tz);
  return startMin >= toMinutes(day.open) && startMin + durationMinutes <= toMinutes(day.close);
}

export async function isSlotFree(
  db: Admin,
  userId: string,
  start: Date,
  durationMinutes: number,
  excludeBookingIds: string[] = []
): Promise<boolean> {
  const end = new Date(start.getTime() + durationMinutes * MINUTE);
  const { data: nearby } = await db
    .from("bookings")
    .select("id, booking_time, service_id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("booking_time", new Date(start.getTime() - 12 * 60 * MINUTE).toISOString())
    .lt("booking_time", end.toISOString());

  const others = (nearby || []).filter((b) => !excludeBookingIds.includes(b.id));
  if (others.length === 0) return true;

  const serviceIds = [...new Set(others.map((b) => b.service_id))];
  const { data: services } = await db.from("services").select("id, duration_minutes").in("id", serviceIds);
  const dur = new Map((services || []).map((s) => [s.id, s.duration_minutes as number]));

  return !others.some((b) => {
    const bStart = new Date(b.booking_time).getTime();
    const bEnd = bStart + (dur.get(b.service_id) || 30) * MINUTE;
    return start.getTime() < bEnd && end.getTime() > bStart;
  });
}
