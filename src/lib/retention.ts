/**
 * The "get them back" ladder. Runs in the Wednesday Engine window (Wednesday, noon, barber's time):
 * each lapsed client gets at most one text per week, the next rung they're due for.
 *
 *   rung 1  check-in   at the barber's rebook interval (default 18 days since last cut)
 *   rung 2  win-back   at 30 days (rotating copy)
 *   rung 3  win-back   at 45 days (next variant)
 *   rung 4  last word  at 60 days, with the barber's offer the first time a client ever reaches it
 *
 * The ladder pauses while a client has a future booking or has texted the shop since the last rung,
 * and starts over after their next completed cut. Opted-out clients never get any of it.
 */

export const WINBACK_VARIANTS = 5;
export const MIN_DAYS_BETWEEN_RUNGS = 6;
const DAY = 86_400_000;

export type LadderClient = {
  lastCutDate: string | null; // YYYY-MM-DD
  stage: number; // reengagement_stage
  lastSentAt: string | null; // last_reengagement_sent_at
  variantIndex: number; // reengagement_index
  claimedOffer: boolean; // has_claimed_winback
  optedOut: boolean;
  hasFutureBooking: boolean;
  lastInboundAt: string | null; // latest text from them to the shop
};

export type Rung = { stage: 1 | 2 | 3 | 4; templateKey: string; usesOffer: boolean; nextVariantIndex: number };

export function daysSince(dateYmd: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(`${dateYmd}T12:00:00Z`).getTime()) / DAY);
}

export function nextRung(c: LadderClient, opts: { now: Date; rebookDays: number; offer: string | null }): Rung | null {
  if (c.optedOut || c.hasFutureBooking || !c.lastCutDate) return null;
  const days = daysSince(c.lastCutDate, opts.now);
  const cutAt = new Date(`${c.lastCutDate}T00:00:00Z`).getTime();

  // A rung sent before their latest cut belongs to the previous lapse.
  const sentThisLapse = c.lastSentAt && new Date(c.lastSentAt).getTime() > cutAt;
  const stage = sentThisLapse ? c.stage : 0;
  if (stage >= 4) return null;

  if (sentThisLapse) {
    // One rung a week at most, and a reply to the last rung means a person is handling it.
    if (opts.now.getTime() - new Date(c.lastSentAt!).getTime() < MIN_DAYS_BETWEEN_RUNGS * DAY) return null;
    if (c.lastInboundAt && new Date(c.lastInboundAt).getTime() > new Date(c.lastSentAt!).getTime()) return null;
  }

  // Highest rung they're due for, but never skip more than one step at a time.
  const due = [opts.rebookDays, 30, 45, 60].filter((d) => days >= d).length;
  if (due === 0 || due <= stage) return null;
  const target = Math.min(due, stage + 1) as 1 | 2 | 3 | 4;

  if (target === 1) return { stage: 1, templateKey: "cadence_nudge", usesOffer: false, nextVariantIndex: c.variantIndex };
  if (target === 4) {
    const usesOffer = !!opts.offer?.trim() && !c.claimedOffer;
    return { stage: 4, templateKey: usesOffer ? "winback_final_offer" : "winback_final", usesOffer, nextVariantIndex: c.variantIndex };
  }
  const v = ((c.variantIndex % WINBACK_VARIANTS) + WINBACK_VARIANTS) % WINBACK_VARIANTS;
  return { stage: target, templateKey: `winback_${v + 1}`, usesOffer: false, nextVariantIndex: c.variantIndex + 1 };
}

/** Wednesday, 12:00–12:59 on the barber's wall clock. */
export function inWednesdayWindow(now: Date, tz: string): boolean {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  return p.find((x) => x.type === "weekday")?.value === "Wed" && Number(p.find((x) => x.type === "hour")?.value) % 24 === 12;
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
