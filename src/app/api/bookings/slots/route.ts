import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PARTY_SIZE } from "@/lib/availability";
import { daySlots } from "@/lib/slots";

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
  const slots = await daySlots(supabase, { userId, date, totalMinutes: service.duration_minutes * partySize, hours: barber?.business_hours, tz });
  return NextResponse.json({ slots, timezone: tz });
}
