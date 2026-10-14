import { createClient } from "@/lib/supabase/server";
import { monthBounds, monthRevenue, greetingFor } from "@/lib/revenue";
import { HomeClient } from "@/app/dashboard/home-client";
import { getT } from "@/lib/i18n-server";
import { appUrl, DEFAULT_TZ } from "@/lib/config";
import { assignNumberSoon } from "@/lib/phone-numbers";
import { ensureSlug } from "@/lib/portfolio";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingState, type BillingStatus } from "@/lib/billing-rules";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: barber } = await supabase
    .from("users")
    .select("first_name, business_name, timezone, feature_autotext, is_locked_out, phone_number, cover_url, billing_status, trial_ends_at, billing_grace_until, stripe_subscription_id")
    .eq("user_id", user.id)
    .single();
  // No LineCatch number yet: assign one as soon as their setup is complete (checked after the page renders).
  if (!barber?.phone_number) assignNumberSoon(user.id);

  const tz = barber?.timezone || DEFAULT_TZ;
  const { t, tag } = await getT();
  const now = new Date();
  const bounds = monthBounds(now, tz);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [slug, services, completed, caughtThisWeek, feed, suppressed] = await Promise.all([
    // Their page link, for "Share your page".
    ensureSlug(createAdminClient(), user.id),
    supabase.from("services").select("id, price").eq("user_id", user.id),
    supabase
      .from("bookings")
      .select("booking_time, service_id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("booking_time", bounds.prevStart.toISOString())
      .lt("booking_time", bounds.end.toISOString()),
    supabase.from("missed_calls").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("sms_dispatched", true).gte("received_at", weekAgo),
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

  const firstName = barber?.first_name?.trim() || "";
  const dateLine = now.toLocaleDateString(tag, { weekday: "long", month: "short", day: "numeric", timeZone: tz });

  return (
    <HomeClient
      greeting={`${t(`home.${greetingFor(now, tz)}`)}${firstName ? `, ${firstName}` : ""}`}
      dateLine={dateLine}
      paused={!!barber?.is_locked_out}
      billing={
        barber
          ? (({ banner, daysLeft }) => ({ banner, daysLeft }))(
              billingState({ billing_status: (barber.billing_status || "trialing") as BillingStatus, trial_ends_at: barber.trial_ends_at, billing_grace_until: barber.billing_grace_until, stripe_subscription_id: barber.stripe_subscription_id })
            )
          : { banner: null, daysLeft: null }
      }
      pageUrl={slug ? `${appUrl()}/${slug}` : `${appUrl()}/book/${user.id}`}
      shopName={barber?.business_name?.trim() || barber?.first_name?.trim() || "LineCatch"}
      coverUrl={barber?.cover_url ?? null}
      revenue={revenue}
      callsCaught={caughtThisWeek.count || 0}
      autotextOn={barber?.feature_autotext !== false}
      feed={feed.data || []}
      suppressed={suppressed.data || []}
      timezone={tz}
    />
  );
}
