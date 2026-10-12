import { describe, it, expect } from "vitest";
import { isRewardCut, nextRewardCut, visitReward, toLoyalty, rewardCents, rewardLabel, isHeadsUpCut, DEFAULT_LOYALTY } from "../lib/loyalty-rules";

const ON = DEFAULT_LOYALTY;

describe("a 10-cut punch card", () => {
  it("every 10th cut is the reward: 10, 20, 30", () => {
    expect(Array.from({ length: 31 }, (_, i) => i).filter(isRewardCut)).toEqual([10, 20, 30]);
  });

  it("nextRewardCut names the right upcoming cut", () => {
    expect(nextRewardCut(0)).toBe(10);
    expect(nextRewardCut(9)).toBe(10);
    expect(nextRewardCut(10)).toBe(20);
    expect(nextRewardCut(13)).toBe(20);
  });

  it("the heads-up text goes out only after the 9th, 19th…", () => {
    expect(Array.from({ length: 21 }, (_, i) => i).filter(isHeadsUpCut)).toEqual([9, 19]);
  });
});

describe("visits", () => {
  it("only the 10th visit is due", () => {
    const due = Array.from({ length: 12 }, (_, before) => before).filter((before) => visitReward(before, ON).due);
    expect(due.map((before) => before + 1)).toEqual([10]);
  });

  it("a visit adds one stamp, however many people are in the party", () => {
    expect(visitReward(2, ON).stampsAfter).toBe(3);
  });

  it("with loyalty off nothing is ever due", () => {
    expect(visitReward(9, { enabled: false, reward: "half" }).due).toBe(false);
  });
});

describe("barber settings", () => {
  it("on by default, 50% off", () => {
    expect(toLoyalty(null)).toEqual({ enabled: true, reward: "half" });
    expect(toLoyalty({ loyalty_enabled: null, loyalty_reward_type: null })).toEqual({ enabled: true, reward: "half" });
  });

  it("free when they pick it; anything else falls back to 50%", () => {
    expect(toLoyalty({ loyalty_enabled: true, loyalty_reward_type: "free" })).toEqual({ enabled: true, reward: "free" });
    expect(toLoyalty({ loyalty_enabled: false, loyalty_reward_type: "bogus" })).toEqual({ enabled: false, reward: "half" });
  });

  it("the reward is half or all of the cut's price", () => {
    expect(rewardCents({ reward: "half" }, 3500)).toBe(1750);
    expect(rewardCents({ reward: "half" }, 4499)).toBe(2250);
    expect(rewardCents({ reward: "free" }, 3500)).toBe(3500);
    expect(rewardCents({ reward: "free" }, -5)).toBe(0);
  });

  it("labels read right in both languages", () => {
    expect(rewardLabel({ reward: "half" })).toBe("50% off");
    expect(rewardLabel({ reward: "free" }, "es")).toBe("gratis");
  });
});
