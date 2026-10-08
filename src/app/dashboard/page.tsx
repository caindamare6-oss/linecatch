import { createClient } from "@/lib/supabase/server";
import { monthBounds, monthRevenue, greetingFor } from "@/lib/revenue";
import { HomeClient } from "@/app/dashboard/home-client";
import { marketingState } from "@/lib/marketing";
import { wednesdayText, nextWednesdayNoon } from "@/lib/retention";
import { getT } from "@/lib/i18n-server";
import { appUrl, DEFAULT_TZ } from "@/lib/config";
import { assignNumberSoon } from "@/lib/phone-numbers";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: barber } = await supabase
    .from("users")
    .select("first_name, business_name, timezone, google_review_url, feature_wednesday, feature_autotext, feature_marketing, is_locked_out, winback_offer, sticker_requested_at, phone_number")
    .eq("user_id", user.id)
    .single();
  // No LineCatch number yet: assign one as soon as their setup is complete (checked after the page renders).
  if (!barber?.phone_number) assignNumberSoon(user.id);

  const tz = barber?.timezone || DEFAULT_TZ;
  const { t, tag } = await getT();
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
      .select("phone_number, last_cut_date, reengagement_index, last_reengagement_sent_at, has_claimed_winback")
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
  // Who gets a text at the coming Wednesday noon (same rules as the cron).
  const wed = nextWednesdayNoon(now, tz);
  const wednesdayTargeted = (wedCandidates.data || []).filter((c) =>
    wednesdayText(
      {
        lastCutDate: c.last_cut_date,
        lastSentAt: c.last_reengagement_sent_at,
        variantIndex: c.reengagement_index ?? 0,
        claimedOffer: !!c.has_claimed_winback,
        optedOut: false,
        hasFutureBooking: booked.has(c.phone_number),
        lastInboundAt: null,
      },
      { now: wed, offer: barber?.winback_offer ?? null }
    )
  ).length;

  const firstName = barber?.first_name?.trim() || "";
  const dateLine = now.toLocaleDateString(tag, { weekday: "long", month: "short", day: "numeric", timeZone: tz });

  return (
    <HomeClient
      greeting={`${t(`home.${greetingFor(now, tz)}`)}${firstName ? `, ${firstName}` : ""}`}
      dateLine={dateLine}
      paused={!!barber?.is_locked_out}
      hasActiveSticker={!!sticker.data}
      bookingLink={`${appUrl()}/book/${user.id}`}
      revenue={revenue}
      vips={vipCount.count || 0}
      callsCaught={caughtThisWeek.count || 0}
      autotextOn={barber?.feature_autotext !== false}
      marketing={marketingState(barber?.feature_marketing)}
      stickerOrdered={!!barber?.sticker_requested_at}
      wednesdayOn={barber?.feature_wednesday !== false}
      wednesdayTargeted={wednesdayTargeted}
      reviewsOn={!!barber?.google_review_url}
      feed={feed.data || []}
      suppressed={suppressed.data || []}
      timezone={tz}
    />
  );
}
