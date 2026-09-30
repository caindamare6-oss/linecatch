import { createAdminClient } from "@/lib/supabase/admin";
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

  let visitFinished = true;
  if (row.group_id) {
    const { count } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("group_id", row.group_id)
      .eq("status", "confirmed");
    visitFinished = !count;
  }

  let visitRewarded = rewardedNow;
  if (!visitRewarded && projection) {
    const { data: existing } = await db.from("loyalty_rewards").select("id").eq("visit_key", projection.visitKey).maybeSingle();
    visitRewarded = !!existing;
  }

  const plan = projection?.plan ?? "full";
  return {
    projection,
    newCutCount,
    rewardedNow,
    visitFinished,
    visitRewarded,
    nextCut: newCutCount !== null ? nextRewardCut(newCutCount, plan) : null,
  };
}

export function rewardVars(due: boolean) {
  return {
    reward: due ? " $5 off this visit." : "",
    reward_es: due ? " $5 de descuento en esta visita." : "",
  };
}
