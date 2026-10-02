import { createClient } from "@/lib/supabase/server";
import { monthBounds, monthRevenue, greetingFor } from "@/lib/revenue";
import { HomeClient } from "@/app/dashboard/home-client";
import { marketingState } from "@/lib/marketing";
import { nextRung } from "@/lib/retention";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: barber } = await supabase
    .from("users")
    .select("first_name, business_name, timezone, google_review_url, feature_wednesday, feature_autotext, feature_marketing, is_locked_out, rebook_interval_days")
    .eq("user_id", user.id)
    .single();

  const tz = barber?.timezone || "America/New_York";
  const now = new Date();
  const bounds = monthBounds(now, tz);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

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
    // Same rules as the Wednesday cron (lib/retention).
    supabase
      .from("vip_clients")
      .select("phone_number, last_cut_date, reengagement_stage, reengagement_index, last_reengagement_sent_at, has_claimed_winback")
      .eq("user_id", user.id)
      .eq("is_opted_in", true)
      .is("opted_out_at", null)
      .not("last_cut_date", "is", null),
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
  const wednesdayTargeted = (wedCandidates.data || []).filter((c) =>
    nextRung(
      {
        lastCutDate: c.last_cut_date,
        stage: c.reengagement_stage ?? 0,
        lastSentAt: c.last_reengagement_sent_at,
        variantIndex: c.reengagement_index ?? 0,
        claimedOffer: !!c.has_claimed_winback,
        optedOut: false,
        hasFutureBooking: booked.has(c.phone_number),
        lastInboundAt: null,
      },
      { now, rebookDays: barber?.rebook_interval_days || 18, offer: null }
    )
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
      marketing={marketingState(barber?.feature_marketing, !!sticker.data)}
      wednesdayOn={barber?.feature_wednesday !== false}
      wednesdayTargeted={wednesdayTargeted}
      reviewsOn={!!barber?.google_review_url}
      feed={feed.data || []}
      suppressed={suppressed.data || []}
      timezone={tz}
    />
  );
}
