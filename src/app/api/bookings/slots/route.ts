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

  if (!userId || !date || (!serviceId && !searchParams.get("serviceIds")) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // One cut per person ("serviceIds=a,b"), or the same cut for everyone (older pages).
  const ids = (searchParams.get("serviceIds") || "").split(",").filter(Boolean).slice(0, MAX_PARTY_SIZE);
  const party = ids.length ? ids : Array(partySize).fill(serviceId);
  const { data: found } = await supabase
    .from("services")
    .select("id, duration_minutes")
    .in("id", [...new Set(party)])
    .eq("user_id", userId);
  const minutes = new Map((found || []).map((s) => [s.id, s.duration_minutes]));
  if (party.some((id) => !minutes.has(id))) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const { data: barber } = await supabase
    .from("users")
    .select("business_hours, timezone")
    .eq("user_id", userId)
    .single();

  const tz = barber?.timezone || "America/New_York";
  const slots = await daySlots(supabase, { userId, date, totalMinutes: party.reduce((m, id) => m + (minutes.get(id) ?? 0), 0), hours: barber?.business_hours, tz });
  return NextResponse.json({ slots, timezone: tz });
}
