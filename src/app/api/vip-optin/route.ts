import { NextResponse } from "next/server";
import { toLoyalty } from "@/lib/loyalty-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TZ } from "@/lib/config";

/** Shop details for the booking page (name, colors, hours, loyalty). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json({ error: "Missing barberId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: barber } = await supabase
    .from("users")
    .select("business_name, first_name, is_locked_out, theme, accent_color, timezone, business_hours, loyalty_enabled, loyalty_reward_cents")
    .eq("user_id", barberId)
    .single();
  const loyalty = toLoyalty(barber);

  const hours = (barber?.business_hours || {}) as Record<string, unknown>;
  const openDays = Object.keys(hours).filter((d) => !!hours[d]);

  return NextResponse.json({
    businessName: barber?.business_name?.trim() || barber?.first_name?.trim() || null,
    openDays,
    isLockedOut: barber?.is_locked_out || false,
    accentColor: barber?.accent_color || null,
    theme: barber?.theme ?? null,
    timezone: barber?.timezone || DEFAULT_TZ,
    loyalty,
  });
}
