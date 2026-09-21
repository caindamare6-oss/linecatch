import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");

  if (!userId || !date || !serviceId) {
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

  if (!barber?.business_hours) {
    return NextResponse.json({ slots: [] });
  }

  const dayDate = new Date(date + "T12:00:00");
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[dayDate.getDay()];
  const hours = barber.business_hours[dayName];

  if (!hours) {
    return NextResponse.json({ slots: [] });
  }

  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const duration = service.duration_minutes;

  const startOfDay = new Date(date + "T00:00:00");
  const endOfDay = new Date(date + "T23:59:59");

  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("booking_time, service_id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("booking_time", startOfDay.toISOString())
    .lte("booking_time", endOfDay.toISOString());

  const bookedSlots: { start: number; end: number }[] = [];
  if (existingBookings) {
    for (const b of existingBookings) {
      const { data: bookedService } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", b.service_id)
        .single();
      const bTime = new Date(b.booking_time);
      const bMinutes = bTime.getHours() * 60 + bTime.getMinutes();
      bookedSlots.push({
        start: bMinutes,
        end: bMinutes + (bookedService?.duration_minutes || 30),
      });
    }
  }

  // Get current time in barber's timezone to filter past slots
  const tz = barber.timezone || "America/New_York";
  const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  const todayStr = `${nowLocal.getFullYear()}-${(nowLocal.getMonth() + 1).toString().padStart(2, "0")}-${nowLocal.getDate().toString().padStart(2, "0")}`;
  const isToday = date === todayStr;
  const nowMinutes = nowLocal.getHours() * 60 + nowLocal.getMinutes();

  const slots: string[] = [];
  for (let m = openMinutes; m + duration <= closeMinutes; m += 30) {
    if (isToday && m <= nowMinutes) continue;
    const overlaps = bookedSlots.some(
      (b) => m < b.end && m + duration > b.start
    );
    if (!overlaps) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
    }
  }

  return NextResponse.json({ slots });
}
