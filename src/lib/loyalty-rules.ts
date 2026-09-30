export type Plan = "basic" | "full";

export const REWARD_CENTS = 500;

export function toPlan(value: unknown): Plan {
  return value === "basic" ? "basic" : "full";
}

/** Basic: 3, 6, 9, 12… (no signup reward). Full: 1, then 4, 7, 10, 13… */
export function isRewardCut(cut: number, plan: Plan): boolean {
  if (cut < 1) return false;
  if (plan === "basic") return cut % 3 === 0;
  return cut === 1 || (cut >= 4 && (cut - 1) % 3 === 0);
}

export function nextRewardCut(afterCut: number, plan: Plan): number {
  let n = Math.max(afterCut, 0) + 1;
  while (!isRewardCut(n, plan)) n++;
  return n;
}

/**
 * A visit adds one stamp per person. It earns at most one $5 reward,
 * no matter how many reward cuts the group's stamps cross.
 */
export function visitReward(stampsBefore: number, partySize: number, plan: Plan) {
  let rewardCut: number | null = null;
  for (let k = 1; k <= partySize; k++) {
    if (isRewardCut(stampsBefore + k, plan)) {
      rewardCut = stampsBefore + k;
      break;
    }
  }
  const stampsAfter = stampsBefore + partySize;
  return {
    due: rewardCut !== null,
    rewardCut,
    stampsAfter,
    nextRewardCut: nextRewardCut(stampsAfter, plan),
    upcomingRewardCut: nextRewardCut(stampsBefore, plan),
  };
}
