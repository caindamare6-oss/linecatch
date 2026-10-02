import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { barberLocalToUTC } from "@/lib/format";
import { localParts } from "@/lib/revenue";

const DAY = 86_400_000;

/**
 * Bookings for `days` calendar days starting at `from` (YYYY-MM-DD, barber's wall clock; default today).
 * Day edges are computed in the barber's timezone so a 9pm cut never lands on the wrong day.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: barber } = await supabase.from("users").select("timezone, business_hours").eq("user_id", user.id).single();
  const tz = barber?.timezone || "America/New_York";
  const url = new URL(request.url);
  const now = new Date();
  const t = localParts(now, tz);
  const today = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "") ? url.searchParams.get("from")! : today;
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 31);

  const start = barberLocalToUTC(from, "00:00", tz);
  // Walk day by day so DST changes inside the range are respected.
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const p = localParts(new Date(start.getTime() + i * DAY + 12 * 3_600_000), tz);
    dates.push(`${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`);
  }
  const last = localParts(new Date(start.getTime() + days * DAY + 12 * 3_600_000), tz);
  const end = barberLocalToUTC(`${last.year}-${String(last.month).padStart(2, "0")}-${String(last.day).padStart(2, "0")}`, "00:00", tz);

  const [{ data: bookings }, { data: services }, { data: vips }, { data: contacts }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_time, status, customer_phone, service_id, group_id, source")
      .eq("user_id", user.id)
      .in("status", ["confirmed", "completed", "no_show"])
      .gte("booking_time", start.toISOString())
      .lt("booking_time", end.toISOString())
      .order("booking_time", { ascending: true })
      .limit(400),
    supabase.from("services").select("id, name, price, duration_minutes").eq("user_id", user.id),
    supabase.from("vip_clients").select("phone_number, first_name, is_opted_in, opted_out_at").eq("user_id", user.id),
    supabase.from("contacts").select("caller_phone, name").eq("user_id", user.id),
  ]);

  const svc = new Map((services || []).map((s) => [s.id, s]));
  const names = new Map<string, string>();
  for (const v of vips || []) if (v.first_name?.trim()) names.set(v.phone_number, v.first_name.trim());
  for (const c of contacts || []) if (c.name?.trim()) names.set(c.caller_phone, c.name.trim());
  const vipSet = new Set((vips || []).filter((v) => v.is_opted_in && !v.opted_out_at).map((v) => v.phone_number));

  const items = (bookings || []).map((b) => {
    const s = svc.get(b.service_id);
    const p = localParts(new Date(b.booking_time), tz);
    return {
      id: b.id,
      time: b.booking_time,
      date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
      status: b.status as "confirmed" | "completed" | "no_show",
      phone: b.customer_phone,
      name: names.get(b.customer_phone) || null,
      isVip: vipSet.has(b.customer_phone),
      service: s?.name ?? "Service",
      price: Number(s?.price ?? 0),
      minutes: s?.duration_minutes ?? 30,
      groupId: b.group_id,
      source: b.source,
    };
  });

  return NextResponse.json({ timezone: tz, today, dates, hours: barber?.business_hours ?? null, bookings: items, barberId: user.id });
}
