import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { barberLocalToUTC } from "@/lib/format";
import { MAX_PARTY_SIZE } from "@/lib/availability";

const MINUTE = 60 * 1000;
const STEP_MINUTES = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  const partySize = Math.min(Math.max(parseInt(searchParams.get("partySize") || "1") || 1, 1), MAX_PARTY_SIZE);

  if (!userId || !date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .eq("user_id", userId)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const { data: barber } = await supabase
    .from("users")
    .select("business_hours, timezone")
    .eq("user_id", userId)
    .single();

  const tz = barber?.timezone || "America/New_York";
  const dayName = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
  const hours = barber?.business_hours?.[dayName];

  if (!hours) {
    return NextResponse.json({ slots: [], timezone: tz });
  }

  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const totalMinutes = service.duration_minutes * partySize;

  const dayStart = barberLocalToUTC(date, "00:00", tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MINUTE);

  const { data: existing } = await supabase
    .from("bookings")
    .select("booking_time, service_id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("booking_time", new Date(dayStart.getTime() - 12 * 60 * MINUTE).toISOString())
    .lt("booking_time", dayEnd.toISOString());

  const serviceIds = [...new Set((existing || []).map((b) => b.service_id))];
  const { data: durations } = serviceIds.length
    ? await supabase.from("services").select("id, duration_minutes").in("id", serviceIds)
    : { data: [] as { id: string; duration_minutes: number }[] };
  const durMap = new Map((durations || []).map((s) => [s.id, s.duration_minutes as number]));

  const booked = (existing || []).map((b) => {
    const start = new Date(b.booking_time).getTime();
    return { start, end: start + (durMap.get(b.service_id) || 30) * MINUTE };
  });

  const now = Date.now();
  const slots: string[] = [];
  for (let m = openMinutes; m + totalMinutes <= closeMinutes; m += STEP_MINUTES) {
    const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const start = barberLocalToUTC(date, hhmm, tz).getTime();
    if (start <= now) continue;
    const end = start + totalMinutes * MINUTE;
    if (!booked.some((b) => start < b.end && end > b.start)) slots.push(hhmm);
  }

  return NextResponse.json({ slots, timezone: tz });
}
