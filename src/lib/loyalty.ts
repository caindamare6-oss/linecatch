import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketingState } from "@/lib/marketing";
import { toPlan, visitReward, nextRewardCut, REWARD_CENTS, type Plan } from "@/lib/loyalty-rules";

export * from "@/lib/loyalty-rules";

type Admin = ReturnType<typeof createAdminClient>;

const NO_SHOW_AFTER_HOURS = 12;

export type VisitProjection = ReturnType<typeof visitReward> & {
  plan: Plan;
  stampsBefore: number;
  partySize: number;
  visitKey: string;
  firstBookingId: string;
  alreadyRewarded: boolean;
};

/**
 * Reward status for the visit a booking belongs to. Stable across the visit:
 * stamps already added by this group's completed rows are subtracted back out,
 * and confirmed bookings earlier than this visit are counted as future stamps.
 */
export async function projectVisit(db: Admin, bookingId: string): Promise<VisitProjection | null> {
  const { data: anchor } = await db
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, group_id")
    .eq("id", bookingId)
    .single();
  if (!anchor) return null;

  let rows = [{ id: anchor.id, booking_time: anchor.booking_time, status: "confirmed" }];
  if (anchor.group_id) {
    const { data: group } = await db
      .from("bookings")
      .select("id, booking_time, status")
      .eq("group_id", anchor.group_id)
      .in("status", ["confirmed", "completed"])
      .order("booking_time", { ascending: true });
    if (group && group.length) rows = group;
  }
  const first = rows[0];
  const completedInVisit = rows.filter((r) => r.status === "completed").length;
  const visitKey = anchor.group_id || anchor.id;

  const [{ data: barber }, { data: vip }, { count: earlierPending }, { data: reward }] = await Promise.all([
    db.from("users").select("plan").eq("user_id", anchor.user_id).single(),
    db.from("vip_clients").select("cut_count").eq("user_id", anchor.user_id).eq("phone_number", anchor.customer_phone).maybeSingle(),
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", anchor.user_id)
      .eq("customer_phone", anchor.customer_phone)
      .eq("status", "confirmed")
      .lt("booking_time", first.booking_time)
      // Older than this, a still-"confirmed" booking is a no-show, not a future stamp.
      .gte("booking_time", new Date(Date.now() - NO_SHOW_AFTER_HOURS * 60 * 60 * 1000).toISOString()),
    db.from("loyalty_rewards").select("id").eq("visit_key", visitKey).maybeSingle(),
  ]);

  const plan = toPlan(barber?.plan);
  const stampsBefore = Math.max((vip?.cut_count || 0) - completedInVisit, 0) + (earlierPending || 0);
  const partySize = rows.length;

  return {
    ...visitReward(stampsBefore, partySize, plan),
    plan,
    stampsBefore,
    partySize,
    visitKey,
    firstBookingId: first.id,
    alreadyRewarded: !!reward,
  };
}

/**
 * Marks one booking completed and settles its loyalty: one stamp per person (atomic),
 * $5 recorded at most once per visit. Returns null if the booking wasn't confirmed.
 */
export async function completeBookingLoyalty(db: Admin, bookingId: string, tz: string) {
  // Project before flipping status so the numbers match the badge the barber just saw.
  const projection = await projectVisit(db, bookingId);

  const { data: row, error } = await db
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id, user_id, customer_phone, group_id")
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data: stamp } = await db.rpc("loyalty_add_stamp", {
    p_user_id: row.user_id,
    p_phone: row.customer_phone,
    p_date: today,
  });
  const newCutCount = typeof stamp === "number" ? stamp : null;

  // visit_key is unique, so a second insert for the same group fails harmlessly.
  let rewardedNow = false;
  if (projection?.due && !projection.alreadyRewarded && projection.rewardCut) {
    const { error: rewardError } = await db.from("loyalty_rewards").insert({
      user_id: row.user_id,
      client_phone: row.customer_phone,
      booking_id: projection.firstBookingId,
      visit_key: projection.visitKey,
      amount_cents: REWARD_CENTS,
      cut_number: projection.rewardCut,
    });
    rewardedNow = !rewardError;
  }

  return { projection, newCutCount, rewardedNow };
}

const REVIEW_COOLDOWN_DAYS = 30;
const REVIEW_MIN_CUTS = 2;

/**
 * Closes out a visit once every person in it is completed or cancelled and at least one
 * was completed. Returns null until then, and null on every later call (visit_closeouts is
 * keyed by visit, so the loyalty text and review request can only happen once).
 * Only completed people added stamps, so cut_count here is already correct.
 */
export async function closeVisitIfResolved(db: Admin, bookingId: string) {
  const { data: row } = await db
    .from("bookings")
    .select("id, user_id, customer_phone, group_id, status, booking_time")
    .eq("id", bookingId)
    .single();
  if (!row) return null;

  let members = [row];
  if (row.group_id) {
    const { data: group } = await db
      .from("bookings")
      .select("id, user_id, customer_phone, group_id, status, booking_time")
      .eq("group_id", row.group_id)
      .order("booking_time", { ascending: true });
    if (group && group.length) members = group;
  }
  if (members.some((m) => m.status === "confirmed")) return null;
  const completed = members.filter((m) => m.status === "completed");
  if (completed.length === 0) return null;

  const visitKey = row.group_id || row.id;
  const { error: claimError } = await db
    .from("visit_closeouts")
    .insert({ visit_key: visitKey, user_id: row.user_id, client_phone: row.customer_phone });
  if (claimError) return null;

  const [{ data: barber }, { data: vip }, { data: reward }] = await Promise.all([
    db.from("users").select("plan, google_review_url, feature_reviews").eq("user_id", row.user_id).single(),
    db
      .from("vip_clients")
      .select("cut_count, is_opted_in, opted_out_at, last_review_request_at")
      .eq("user_id", row.user_id)
      .eq("phone_number", row.customer_phone)
      .maybeSingle(),
    db.from("loyalty_rewards").select("id").eq("visit_key", visitKey).maybeSingle(),
  ]);

  const plan = toPlan(barber?.plan);
  const cutCount = vip?.cut_count ?? null;

  // The review cron keys off the last completed person's booking_completed event.
  const lastCompleted = completed[completed.length - 1];
  const cooldownStart = new Date(Date.now() - REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Review requests are marketing: they need SMS marketing on and an active QR sticker.
  const marketingOn = (await getMarketingState(db, row.user_id)) === "on";
  const reviewDue =
    marketingOn &&
    !!barber?.google_review_url &&
    barber.feature_reviews !== false &&
    !!vip?.is_opted_in &&
    !vip.opted_out_at &&
    (cutCount ?? 0) >= REVIEW_MIN_CUTS &&
    (!vip.last_review_request_at || vip.last_review_request_at < cooldownStart);

  if (reviewDue) {
    await db.from("booking_reminders").insert({ booking_id: lastCompleted.id, reminder_type: "review" });
  }

  return {
    visitKey,
    cutCount,
    nextCut: cutCount !== null ? nextRewardCut(cutCount, plan) : null,
    visitRewarded: !!reward,
    reviewScheduled: reviewDue,
    completedCount: completed.length,
  };
}

export function rewardVars(due: boolean) {
  return {
    reward: due ? " $5 off this visit." : "",
    reward_es: due ? " $5 de descuento en esta visita." : "",
  };
}
