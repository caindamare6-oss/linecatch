import { createClient } from "@/lib/supabase/server";
import { StatsClient } from "@/app/dashboard/stats-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const weekAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: weekCalls } = await supabase
    .from("missed_calls_log")
    .select("call_id, caller_phone, status, timestamp")
    .eq("user_id", user.id)
    .gte("timestamp", weekAgo)
    .order("timestamp", { ascending: false });

  const { data: weekClicks } = await supabase
    .from("link_clicks")
    .select("click_id, call_id, clicked_at")
    .gte("clicked_at", weekAgo);

  const userCallIds = new Set(
    (weekCalls || []).map((c) => c.call_id)
  );
  const relevantClicks = (weekClicks || []).filter((c) =>
    userCallIds.has(c.call_id)
  );

  const { data: barber } = await supabase
    .from("users")
    .select("avg_booking_value, timezone, google_review_url")
    .eq("user_id", user.id)
    .single();

  const avgBookingValue = barber?.avg_booking_value || 35;
  const barberTimezone = barber?.timezone || "America/New_York";
  const googleReviewUrl: string | null = barber?.google_review_url || null;

  // Fetch all-time caller phones to determine new vs repeat
  const { data: allTimeCalls } = await supabase
    .from("missed_calls_log")
    .select("caller_phone, timestamp")
    .eq("user_id", user.id)
    .lt("timestamp", weekAgo)
    .order("timestamp", { ascending: true });

  const previousCallers = new Set(
    (allTimeCalls || []).map((c) => c.caller_phone)
  );

  // Total clients = unique phones from missed calls + VIP clients (booking/QR signups)
  const thisWeekPhones = new Set((weekCalls || []).map((c) => c.caller_phone));
  const allClientsSet = new Set([...previousCallers, ...thisWeekPhones]);

  const { data: vipClients } = await supabase
    .from("vip_clients")
    .select("phone_number, first_name")
    .eq("user_id", user.id);

  for (const vip of vipClients || []) {
    allClientsSet.add(vip.phone_number);
  }

  const totalClients = allClientsSet.size;

  // Fetch saved contact names
  const { data: contacts } = await supabase
    .from("contacts")
    .select("caller_phone, name")
    .eq("user_id", user.id);

  const contactMap: Record<string, string> = {};
  // Use VIP first_name as default name
  for (const vip of vipClients || []) {
    if (vip.first_name) contactMap[vip.phone_number] = vip.first_name;
  }
  // Manual contact names override VIP names
  for (const c of contacts || []) {
    if (c.name) contactMap[c.caller_phone] = c.name;
  }

  // Wednesday Engine: count targeted clients (same query as retention-loop cron)
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const twentyEightDaysAgo = new Date(now);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
  const twentyOneDaysAgo = new Date(now);
  twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

  const { data: wednesdayCandidates } = await supabase
    .from("vip_clients")
    .select("id, phone_number, last_reengagement_sent_at")
    .eq("user_id", user.id)
    .eq("is_opted_in", true)
    .is("opted_out_at", null)
    .gte("last_cut_date", twentyEightDaysAgo.toISOString().split("T")[0])
    .lte("last_cut_date", fourteenDaysAgo.toISOString().split("T")[0]);

  let wednesdayTargeted = 0;
  for (const c of wednesdayCandidates || []) {
    if (c.last_reengagement_sent_at && new Date(c.last_reengagement_sent_at) > twentyOneDaysAgo) continue;
    const { data: activeBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", user.id)
      .eq("customer_phone", c.phone_number)
      .eq("status", "confirmed")
      .gt("booking_time", now.toISOString())
      .limit(1)
      .single();
    if (!activeBooking) wednesdayTargeted++;
  }

  // VIPs: count all VIP clients
  const { count: loyaltyActiveClients } = await supabase
    .from("vip_clients")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Missed Call Auto-Respond: calls saved this week
  const { count: callsSavedThisWeek } = await supabase
    .from("missed_calls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("sms_dispatched", true)
    .gte("received_at", weekAgo);

  // Monthly revenue: completed bookings this calendar month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: monthlyCompletedCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("booking_time", monthStart);

  const monthlyRevenue = (monthlyCompletedCount || 0) * avgBookingValue;

  // Mid-week cuts filled: completed bookings from cron_reengagement this month
  const { count: midWeekCutsCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed")
    .eq("source", "cron_reengagement")
    .gte("booking_time", monthStart);

  // Loyalty claims this month from activity_feed
  const { count: loyaltyClaimsCount } = await supabase
    .from("activity_feed")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("event_type", "loyalty_claimed")
    .gte("created_at", monthStart);

  // Activity feed: latest 20 events
  const { data: activityFeed } = await supabase
    .from("activity_feed")
    .select("id, event_type, client_name, client_phone, description, metadata, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch suppressed missed calls (no consent / opted out)
  const { data: suppressedCalls } = await supabase
    .from("missed_calls")
    .select("id, from_number, received_at, suppressed_reason")
    .eq("user_id", user.id)
    .eq("sms_dispatched", false)
    .order("received_at", { ascending: false })
    .limit(10);

  return (
    <StatsClient
      calls={(weekCalls || []).map((c) => ({
        call_id: c.call_id,
        caller_phone: c.caller_phone,
        status: c.status,
        timestamp: c.timestamp,
      }))}
      clicks={relevantClicks.map((c) => ({
        click_id: c.click_id,
        call_id: c.call_id,
        clicked_at: c.clicked_at,
      }))}
      avgBookingValue={avgBookingValue}
      previousCallers={Array.from(previousCallers)}
      totalClients={totalClients}
      allClientPhones={Array.from(allClientsSet)}
      contactNames={contactMap}
      suppressedCalls={(suppressedCalls || []).map((c) => ({
        id: c.id,
        from_number: c.from_number,
        received_at: c.received_at,
        suppressed_reason: c.suppressed_reason,
      }))}
      wednesdayTargeted={wednesdayTargeted}
      timezone={barberTimezone}
      loyaltyActiveClients={loyaltyActiveClients || 0}
      callsSavedThisWeek={callsSavedThisWeek || 0}
      googleReviewUrl={googleReviewUrl}
      monthlyRevenue={monthlyRevenue}
      monthlyCompleted={monthlyCompletedCount || 0}
      midWeekCutsFilled={midWeekCutsCount || 0}
      loyaltyClaims={loyaltyClaimsCount || 0}
      activityFeed={(activityFeed || []).map((e) => ({
        id: e.id,
        event_type: e.event_type,
        client_name: e.client_name,
        description: e.description,
        created_at: e.created_at,
      }))}
    />
  );
}
