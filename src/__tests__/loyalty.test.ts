import { describe, it, expect } from "vitest";
import { isRewardCut, nextRewardCut, visitReward, toLoyalty, DEFAULT_LOYALTY } from "../lib/loyalty-rules";

const ON = DEFAULT_LOYALTY;
const rewardCuts = Array.from({ length: 14 }, (_, i) => i + 1).filter((n) => isRewardCut(n));

describe("one schedule for every client", () => {
  it("1st cut full price, 2nd off, then every 3rd: 2, 5, 8, 11, 14", () => {
    expect(rewardCuts).toEqual([2, 5, 8, 11, 14]);
  });

  it("cut 0 and cut 1 are never a reward", () => {
    expect(isRewardCut(0)).toBe(false);
    expect(isRewardCut(1)).toBe(false);
  });

  it("nextRewardCut names the right upcoming cut", () => {
    expect(nextRewardCut(0)).toBe(2);
    expect(nextRewardCut(1)).toBe(2);
    expect(nextRewardCut(2)).toBe(5);
    expect(nextRewardCut(4)).toBe(5);
    expect(nextRewardCut(5)).toBe(8);
  });
});

describe("visits", () => {
  it("visit by visit: only the 2nd, 5th and 8th are off", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((before) => visitReward(before, ON).due)).toEqual([false, true, false, false, true, false, false, true]);
  });

  it("a visit adds one stamp, however many people are in the party", () => {
    expect(visitReward(2, ON).stampsAfter).toBe(3);
  });

  it("after the visit, the next reward is counted from the new total", () => {
    expect(visitReward(1, ON).nextRewardCut).toBe(5);
    expect(visitReward(0, ON).upcomingRewardCut).toBe(2);
  });

  it("with loyalty off nothing is ever due", () => {
    expect([0, 1, 4, 7].map((b) => visitReward(b, { enabled: false, cents: 500 }).due)).toEqual([false, false, false, false]);
  });
});

describe("barber settings", () => {
  it("on by default with $5", () => {
    expect(toLoyalty(null)).toEqual({ enabled: true, cents: 500 });
    expect(toLoyalty({ loyalty_enabled: null, loyalty_reward_cents: null })).toEqual({ enabled: true, cents: 500 });
  });
  it("their own amount, within $1–$50", () => {
    expect(toLoyalty({ loyalty_enabled: true, loyalty_reward_cents: 1000 })).toEqual({ enabled: true, cents: 1000 });
    expect(toLoyalty({ loyalty_enabled: true, loyalty_reward_cents: 99999 }).cents).toBe(500);
    expect(toLoyalty({ loyalty_enabled: false, loyalty_reward_cents: 700 })).toEqual({ enabled: false, cents: 700 });
  });
});
