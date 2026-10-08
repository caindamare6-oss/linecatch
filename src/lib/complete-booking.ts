import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { DEFAULT_TZ, appUrl, money } from "@/lib/config";
import { completeBookingLoyalty, closeVisitIfResolved, localDate } from "@/lib/loyalty";
import { hasTextConsent } from "@/lib/opt-out";
import { AUTO_COMPLETE_AFTER_HOURS, UNDO_WINDOW_HOURS } from "@/lib/complete-booking-rules";

type Admin = ReturnType<typeof createAdminClient>;

export { AUTO_COMPLETE_AFTER_HOURS, UNDO_WINDOW_HOURS };

export type CompleteResult = { ok: true } | { ok: false; error: "not_found" | "not_active" | "failed" };

/**
 * Marks one booking done, by the barber's tap or automatically: a loyalty stamp, the reward
 * when it's due, the activity feed, and once the whole visit is settled, one loyalty text and
 * (if it's due) a review request.
 */
export async function completeBooking(db: Admin, bookingId: string, by: "barber" | "auto"): Promise<CompleteResult> {
  const { data: booking } = await db.from("bookings").select("id, user_id, customer_phone, service_id, status").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };
  if (booking.status !== "confirmed") return { ok: false, error: "not_active" };

  const [{ data: barber }, { data: service }, { data: vip }] = await Promise.all([
    db.from("users").select("timezone").eq("user_id", booking.user_id).maybeSingle(),
    db.from("services").select("name").eq("id", booking.service_id).maybeSingle(),
    db.from("vip_clients").select("first_name").eq("user_id", booking.user_id).eq("phone_number", booking.customer_phone).maybeSingle(),
  ]);

  let result: Awaited<ReturnType<typeof completeBookingLoyalty>>;
  try {
    result = await completeBookingLoyalty(db, bookingId, barber?.timezone || DEFAULT_TZ);
  } catch (err) {
    console.error("[completeBooking]", err);
    return { ok: false, error: "failed" };
  }
  if (!result) return { ok: false, error: "not_active" };
  const { projection, rewardedNow } = result;
  const name = vip?.first_name || null;

  await db.from("activity_feed").insert({
    user_id: booking.user_id,
    event_type: "booking_completed",
    client_name: name,
    client_phone: booking.customer_phone,
    description: `${name || "Client"}'s ${service?.name || "cut"} completed`,
    metadata: { booking_id: bookingId, service_name: service?.name || null, auto: by === "auto" },
  });
  await db.from("booking_reminders").delete().eq("booking_id", bookingId).in("reminder_type", ["24h", "2h"]);

  if (rewardedNow && projection) {
    await db.from("activity_feed").insert({
      user_id: booking.user_id,
      event_type: "loyalty_claimed",
      client_name: name,
      client_phone: booking.customer_phone,
      description: `${name || "Client"} got ${money(projection.loyalty.cents)} off (cut #${projection.rewardCut})`,
      metadata: { booking_id: bookingId, visit_key: projection.visitKey, cut_count: projection.rewardCut, amount_cents: projection.loyalty.cents },
    });
  }

  await closeOutVisit(db, bookingId);
  return { ok: true };
}

/**
 * Once every person in the visit is done, cancelled or a no-show: one loyalty text (to a client
 * who agreed to texts) and the review request, if one is due. Happens once per visit.
 */
export async function closeOutVisit(db: Admin, bookingId: string) {
  const closeout = await closeVisitIfResolved(db, bookingId);
  // Loyalty off: no loyalty text (the review request was already decided above).
  if (!closeout || !closeout.loyalty.enabled || closeout.cutCount === null || closeout.nextCut === null) return;
  const { data: booking } = await db.from("bookings").select("user_id, customer_phone").eq("id", bookingId).maybeSingle();
  if (!booking) return;
  const { data: barber } = await db
    .from("users")
    .select("phone_number, business_name, first_name, booking_link")
    .eq("user_id", booking.user_id)
    .maybeSingle();
  if (!barber?.phone_number) return;
  if (!(await hasTextConsent(db as unknown as Parameters<typeof hasTextConsent>[0], booking.user_id, booking.customer_phone))) return;

  const templateKey = closeout.visitRewarded ? "loyalty_earned" : "loyalty_progress";
  const sms = await buildSMS({
    userId: booking.user_id,
    templateKey,
    clientPhone: booking.customer_phone,
    vars: {
      shop_name: barber.business_name?.trim() || barber.first_name?.trim() || "your barber",
      link: barber.booking_link || `${appUrl()}/book/${booking.user_id}`,
      cuts: String(closeout.cutCount),
      next_cut: String(closeout.nextCut),
      cuts_left: String(closeout.nextCut - closeout.cutCount),
      amount: money(closeout.loyalty.cents),
    },
  });
  if (!sms) return;
  try {
    await sendSMS({ to: booking.customer_phone, from: barber.phone_number, body: sms.body, userId: booking.user_id, templateKey, language: sms.language });
    await markFirstMessageSent(booking.user_id, booking.customer_phone);
  } catch (err) {
    console.error("Loyalty SMS failed:", err);
  }
}

export type NoShowResult = { ok: true } | { ok: false; error: "not_found" | "too_early" | "too_late" | "not_active" | "failed" };

/**
 * The client never came. Works on a booking still waiting, and on one already marked done
 * (by the barber or automatically) up to 24 hours after the appointment: the stamp, the $5
 * reward and the pending review request are taken back.
 */
export async function markNoShow(db: Admin, bookingId: string): Promise<NoShowResult> {
  const { data: booking } = await db
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, status, group_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };
  const start = new Date(booking.booking_time).getTime();
  if (start > Date.now()) return { ok: false, error: "too_early" };

  if (booking.status === "confirmed") {
    const { error } = await db.from("bookings").update({ status: "no_show" }).eq("id", bookingId).eq("status", "confirmed");
    if (error) {
      console.error("[markNoShow]", error);
      return { ok: false, error: "failed" };
    }
    await db.from("booking_reminders").delete().eq("booking_id", bookingId).in("reminder_type", ["24h", "2h"]);
    await closeOutVisit(db, bookingId);
    return { ok: true };
  }

  if (booking.status !== "completed") return { ok: false, error: "not_active" };
  if (Date.now() - start > UNDO_WINDOW_HOURS * 3_600_000) return { ok: false, error: "too_late" };

  const { data: flipped } = await db
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (!flipped) return { ok: false, error: "not_active" };

  // Is anyone else in this party still done? Then the visit (and its one stamp) still happened.
  const visitKey = booking.group_id || booking.id;
  const { count: stillDone } = booking.group_id
    ? await db.from("bookings").select("id", { count: "exact", head: true }).eq("group_id", booking.group_id).eq("status", "completed")
    : { count: 0 };

  if (!stillDone) {
    // Take the visit's stamp back, and put "last cut" back on their previous real cut.
    const { data: barber } = await db.from("users").select("timezone").eq("user_id", booking.user_id).maybeSingle();
    const tz = barber?.timezone || DEFAULT_TZ;
    const [{ data: vip }, { data: prev }] = await Promise.all([
      db.from("vip_clients").select("cut_count").eq("user_id", booking.user_id).eq("phone_number", booking.customer_phone).maybeSingle(),
      db
        .from("bookings")
        .select("booking_time")
        .eq("user_id", booking.user_id)
        .eq("customer_phone", booking.customer_phone)
        .eq("status", "completed")
        .order("booking_time", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (vip) {
      await db
        .from("vip_clients")
        .update({ cut_count: Math.max((vip.cut_count || 0) - 1, 0), last_cut_date: prev ? localDate(prev.booking_time, tz) : null })
        .eq("user_id", booking.user_id)
        .eq("phone_number", booking.customer_phone);
    }
    // Nobody in the visit was actually cut: no reward, no review request.
    await db.from("loyalty_rewards").delete().eq("visit_key", visitKey);
    const { data: group } = booking.group_id ? await db.from("bookings").select("id").eq("group_id", booking.group_id) : { data: [{ id: booking.id }] };
    await db.from("booking_reminders").delete().in("booking_id", (group || []).map((g) => g.id)).eq("reminder_type", "review");
  }
  await db.from("activity_feed").delete().eq("user_id", booking.user_id).in("event_type", ["booking_completed", "loyalty_claimed"]).eq("metadata->>booking_id", bookingId);
  return { ok: true };
}
