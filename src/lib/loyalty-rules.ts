export type Plan = "basic" | "full";

/** The reward when a barber hasn't set their own amount. */
export const REWARD_CENTS = 500;

export function toPlan(value: unknown): Plan {
  return value === "basic" ? "basic" : "full";
}

/** A barber's loyalty program: on/off and the reward, from Settings → Loyalty rewards. */
export type Loyalty = { enabled: boolean; cents: number };
export const DEFAULT_LOYALTY: Loyalty = { enabled: true, cents: REWARD_CENTS };
export const MIN_REWARD_CENTS = 100;
export const MAX_REWARD_CENTS = 5000;

export function toLoyalty(row: { loyalty_enabled?: boolean | null; loyalty_reward_cents?: number | null } | null | undefined): Loyalty {
  const cents = Number(row?.loyalty_reward_cents);
  return {
    enabled: row?.loyalty_enabled !== false,
    cents: Number.isInteger(cents) && cents >= MIN_REWARD_CENTS && cents <= MAX_REWARD_CENTS ? cents : REWARD_CENTS,
  };
}

/**
 * Which visits get the reward, the same for every client however they booked or signed up:
 * the first cut is full price, the 2nd is off, then every 3rd after that: 2, 5, 8, 11…
 */
export function isRewardCut(cut: number): boolean {
  return cut === 2 || (cut > 2 && (cut - 2) % 3 === 0);
}

export function nextRewardCut(afterCut: number): number {
  let n = Math.max(afterCut, 0) + 1;
  while (!isRewardCut(n)) n++;
  return n;
}

/**
 * A visit adds one stamp for that phone number, however many people were in the party,
 * and earns the reward when it lands on a reward cut (never while the program is off).
 */
export function visitReward(stampsBefore: number, loyalty: Loyalty) {
  const stampsAfter = stampsBefore + 1;
  const due = loyalty.enabled && isRewardCut(stampsAfter);
  return {
    due,
    rewardCut: due ? stampsAfter : null,
    stampsAfter,
    nextRewardCut: nextRewardCut(stampsAfter),
    upcomingRewardCut: nextRewardCut(stampsBefore),
  };
}
