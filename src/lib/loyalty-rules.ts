export type Plan = "basic" | "full";

/** A punch card: every 10th cut gets the reward. */
export const CARD_SIZE = 10;

/** What the 10th cut gets: half off (the default) or free. Set in Settings → Loyalty rewards. */
export type RewardType = "half" | "free";
export const REWARD_TYPES: RewardType[] = ["half", "free"];

export function toPlan(value: unknown): Plan {
  return value === "basic" ? "basic" : "full";
}

/** A barber's loyalty program: on/off and what the 10th cut gets. */
export type Loyalty = { enabled: boolean; reward: RewardType };
export const DEFAULT_LOYALTY: Loyalty = { enabled: true, reward: "half" };

export function toLoyalty(row: { loyalty_enabled?: boolean | null; loyalty_reward_type?: string | null } | null | undefined): Loyalty {
  return {
    enabled: row?.loyalty_enabled !== false,
    reward: row?.loyalty_reward_type === "free" ? "free" : "half",
  };
}

/** How much of the cut the reward takes off, in percent. */
export const rewardPercent = (l: Pick<Loyalty, "reward">) => (l.reward === "free" ? 100 : 50);

/** The reward in cents for a cut at this price (half rounds to the cent). */
export const rewardCents = (l: Pick<Loyalty, "reward">, priceCents: number) => Math.round((Math.max(priceCents, 0) * rewardPercent(l)) / 100);

/** "50% off" / "free" (en), "con 50% de descuento" / "gratis" (es): fits "Your next cut is …". */
export function rewardLabel(l: Pick<Loyalty, "reward">, lang: "en" | "es" = "en") {
  if (l.reward === "free") return lang === "es" ? "gratis" : "free";
  return lang === "es" ? "con 50% de descuento" : "50% off";
}

/** Which visits get the reward, the same for every client: 10, 20, 30… */
export function isRewardCut(cut: number): boolean {
  return cut > 0 && cut % CARD_SIZE === 0;
}

export function nextRewardCut(afterCut: number): number {
  const n = Math.max(afterCut, 0);
  return (Math.floor(n / CARD_SIZE) + 1) * CARD_SIZE;
}

/** The one loyalty text goes out after the cut right before a reward (the 9th, 19th…). */
export const isHeadsUpCut = (cut: number) => isRewardCut(cut + 1);

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
