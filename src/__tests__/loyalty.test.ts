import { describe, it, expect } from "vitest";
import { isRewardCut, nextRewardCut, visitReward } from "../lib/loyalty-rules";

const rewardCuts = (plan: "basic" | "full") =>
  Array.from({ length: 16 }, (_, i) => i + 1).filter((n) => isRewardCut(n, plan));

describe("reward cadence by plan", () => {
  it("Basic rewards cuts 3, 6, 9, 12, 15 — no signup reward", () => {
    expect(rewardCuts("basic")).toEqual([3, 6, 9, 12, 15]);
  });

  it("Full rewards cuts 1, 4, 7, 10, 13, 16", () => {
    expect(rewardCuts("full")).toEqual([1, 4, 7, 10, 13, 16]);
  });

  it("cut 0 is never a reward", () => {
    expect(isRewardCut(0, "basic")).toBe(false);
    expect(isRewardCut(0, "full")).toBe(false);
  });

  it("nextRewardCut names the right upcoming cut (the old progress text was one late)", () => {
    expect(nextRewardCut(3, "full")).toBe(4);
    expect(nextRewardCut(2, "full")).toBe(4);
    expect(nextRewardCut(0, "full")).toBe(1);
    expect(nextRewardCut(0, "basic")).toBe(3);
    expect(nextRewardCut(3, "basic")).toBe(6);
  });
});

describe("solo visits", () => {
  it("Full: 1st visit is $5 off, 2nd and 3rd aren't, 4th is", () => {
    expect(visitReward(0, 1, "full").due).toBe(true);
    expect(visitReward(1, 1, "full").due).toBe(false);
    expect(visitReward(2, 1, "full").due).toBe(false);
    expect(visitReward(3, 1, "full").due).toBe(true);
  });

  it("Basic: only the 3rd visit is $5 off", () => {
    expect([0, 1, 2, 3, 4, 5].map((before) => visitReward(before, 1, "basic").due)).toEqual([
      false, false, true, false, false, true,
    ]);
  });
});

describe("group visits", () => {
  it("each person adds a stamp to the booker's card", () => {
    expect(visitReward(2, 3, "basic").stampsAfter).toBe(5);
  });

  it("a group that lands on a reward cut gets $5 once", () => {
    const r = visitReward(1, 2, "basic"); // stamps 2,3 → hits 3
    expect(r.due).toBe(true);
    expect(r.rewardCut).toBe(3);
  });

  it("a group crossing two reward cuts still gets only one $5", () => {
    // Full from 0 with a party of 4: stamps 1,2,3,4 cross cuts 1 and 4
    const r = visitReward(0, 4, "full");
    expect(r.due).toBe(true);
    expect(r.rewardCut).toBe(1);
    expect(r.stampsAfter).toBe(4);
  });

  it("a group that doesn't reach a reward cut gets nothing", () => {
    expect(visitReward(3, 2, "basic").due).toBe(false); // stamps 4,5
  });

  it("after the visit, the next reward is counted from the new total", () => {
    expect(visitReward(0, 4, "full").nextRewardCut).toBe(7);
    expect(visitReward(1, 2, "basic").nextRewardCut).toBe(6);
  });
});
