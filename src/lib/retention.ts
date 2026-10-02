/**
 * The Wednesday Engine. It only ever texts on Wednesday at noon (barber's time), no matter which
 * day the client last came in or booked:
 *
 *   first text   the first Wednesday at least 2 weeks after their last cut (so 2–3 weeks after it)
 *   then         every 3 weeks, on a Wednesday, until they book or opt out
 *
 * The first text is the "you're about due" check-in; repeats rotate through the win-back copy, and
 * the barber's offer (if they set one) goes out once per client, the first time they've been gone
 * 8+ weeks. It stops for good when the client texts STOP or the carrier reports the number can't
 * get texts. It skips clients with a future booking or who texted the shop in the last week, and
 * starts over from their next cut.
 */

export const FIRST_TEXT_AFTER_DAYS = 14;
export const REPEAT_EVERY_DAYS = 21;
export const OFFER_AFTER_DAYS = 56;
export const QUIET_AFTER_REPLY_DAYS = 7;
export const WINBACK_VARIANTS = 5;
const DAY = 86_400_000;
// Each run happens in the same noon hour, so allow a few hours of slack between Wednesdays.
const SLACK = 6 * 3_600_000;

export type WednesdayClient = {
  lastCutDate: string | null; // YYYY-MM-DD
  lastSentAt: string | null; // last_reengagement_sent_at
  variantIndex: number; // reengagement_index
  claimedOffer: boolean; // has_claimed_winback
  optedOut: boolean;
  hasFutureBooking: boolean;
  lastInboundAt: string | null; // latest text from them to the shop
};

export type WednesdayText = { templateKey: string; first: boolean; usesOffer: boolean; nextVariantIndex: number };

export function daysSince(dateYmd: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(`${dateYmd}T12:00:00Z`).getTime()) / DAY);
}

/** What (if anything) this client gets this Wednesday. Call only inside the Wednesday window. */
export function wednesdayText(c: WednesdayClient, opts: { now: Date; offer: string | null }): WednesdayText | null {
  if (c.optedOut || c.hasFutureBooking || !c.lastCutDate) return null;
  const now = opts.now.getTime();
  const days = daysSince(c.lastCutDate, opts.now);
  if (days < FIRST_TEXT_AFTER_DAYS) return null;
  if (c.lastInboundAt && now - new Date(c.lastInboundAt).getTime() < QUIET_AFTER_REPLY_DAYS * DAY) return null;

  // A text sent before their latest cut belongs to the previous visit.
  const cutAt = new Date(`${c.lastCutDate}T00:00:00Z`).getTime();
  const lastSent = c.lastSentAt ? new Date(c.lastSentAt).getTime() : null;
  const sentSinceCut = lastSent !== null && lastSent > cutAt;

  if (!sentSinceCut) return { templateKey: "cadence_nudge", first: true, usesOffer: false, nextVariantIndex: c.variantIndex };
  if (now - lastSent! < REPEAT_EVERY_DAYS * DAY - SLACK) return null;

  if (days >= OFFER_AFTER_DAYS && opts.offer?.trim() && !c.claimedOffer) {
    return { templateKey: "winback_final_offer", first: false, usesOffer: true, nextVariantIndex: c.variantIndex };
  }
  const v = ((c.variantIndex % WINBACK_VARIANTS) + WINBACK_VARIANTS) % WINBACK_VARIANTS;
  return { templateKey: `winback_${v + 1}`, first: false, usesOffer: false, nextVariantIndex: c.variantIndex + 1 };
}

/** Wednesday, 12:00–12:59 on the barber's wall clock. */
export function inWednesdayWindow(now: Date, tz: string): boolean {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  return p.find((x) => x.type === "weekday")?.value === "Wed" && Number(p.find((x) => x.type === "hour")?.value) % 24 === 12;
}

/** The start of the next Wednesday-noon window (now, if we're in it). */
export function nextWednesdayNoon(now: Date, tz: string): Date {
  const hour = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
  for (let h = 0; h < 8 * 24; h++) {
    const t = new Date(hour.getTime() + h * 3_600_000);
    if (inWednesdayWindow(t, tz)) return h === 0 ? now : t;
  }
  return now;
}

/**
 * Crons normally use the real clock. For local testing only, `?now=` can move it
 * when ALLOW_TIME_TRAVEL=true (never set in production).
 */
export function cronNow(request: Request): Date {
  const raw = new URL(request.url).searchParams.get("now");
  if (raw && process.env.ALLOW_TIME_TRAVEL === "true" && process.env.NODE_ENV !== "production") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
