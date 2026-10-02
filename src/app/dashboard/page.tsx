import { createClient } from "@/lib/supabase/server";
import { monthBounds, monthRevenue, greetingFor } from "@/lib/revenue";
import { HomeClient } from "@/app/dashboard/home-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: barber } = await supabase
    .from("users")
    .select("first_name, business_name, timezone, google_review_url, feature_wednesday, feature_autotext, is_locked_out")
    .eq("user_id", user.id)
    .single();

  const tz = barber?.timezone || "America/New_York";
  const now = new Date();
  const bounds = monthBounds(now, tz);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const day = 86_400_000;
  const iso = (ms: number) => new Date(ms).toISOString().split("T")[0];

  const [sticker, services, completed, vipCount, caughtThisWeek, wedCandidates, upcoming, feed, suppressed] = await Promise.all([
    supabase.from("sticker_codes").select("code").eq("owner_user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("services").select("id, price").eq("user_id", user.id),
    supabase
      .from("bookings")
      .select("booking_time, service_id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("booking_time", bounds.prevStart.toISOString())
      .lt("booking_time", bounds.end.toISOString()),
    supabase.from("vip_clients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_opted_in", true).is("opted_out_at", null),
    supabase.from("missed_calls").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("sms_dispatched", true).gte("received_at", weekAgo),
    // Same window as the Wednesday cron: last cut 14–28 days ago, not nudged in 21 days.
    supabase
      .from("vip_clients")
      .select("phone_number, last_reengagement_sent_at")
      .eq("user_id", user.id)
      .eq("is_opted_in", true)
      .is("opted_out_at", null)
      .gte("last_cut_date", iso(now.getTime() - 28 * day))
      .lte("last_cut_date", iso(now.getTime() - 14 * day)),
    supabase.from("bookings").select("customer_phone").eq("user_id", user.id).eq("status", "confirmed").gt("booking_time", now.toISOString()),
    supabase
      .from("activity_feed")
      .select("id, event_type, client_name, description, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("missed_calls")
      .select("id, from_number, received_at, suppressed_reason")
      .eq("user_id", user.id)
      .eq("sms_dispatched", false)
      .gte("received_at", weekAgo)
      .order("received_at", { ascending: false })
      .limit(10),
  ]);

  const prices = Object.fromEntries((services.data || []).map((s) => [s.id, Number(s.price)]));
  const revenue = monthRevenue(completed.data || [], prices, tz, now);

  const booked = new Set((upcoming.data || []).map((b) => b.customer_phone));
  const nudgeCutoff = now.getTime() - 21 * day;
  const wednesdayTargeted = (wedCandidates.data || []).filter(
    (c) => !booked.has(c.phone_number) && !(c.last_reengagement_sent_at && new Date(c.last_reengagement_sent_at).getTime() > nudgeCutoff)
  ).length;

  const firstName = barber?.first_name?.trim() || "";
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });

  return (
    <HomeClient
      greeting={`${greetingFor(now, tz)}${firstName ? `, ${firstName}` : ""}`}
      dateLine={dateLine}
      paused={!!barber?.is_locked_out}
      hasActiveSticker={!!sticker.data}
      bookingLink={`${process.env.NEXT_PUBLIC_APP_URL || "https://linecatch.app"}/book/${user.id}`}
      revenue={revenue}
      vips={vipCount.count || 0}
      callsCaught={caughtThisWeek.count || 0}
      autotextOn={barber?.feature_autotext !== false}
      wednesdayOn={barber?.feature_wednesday !== false}
      wednesdayTargeted={wednesdayTargeted}
      reviewsOn={!!barber?.google_review_url}
      feed={feed.data || []}
      suppressed={suppressed.data || []}
      timezone={tz}
    />
  );
}
