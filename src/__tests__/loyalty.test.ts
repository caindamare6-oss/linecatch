import { describe, it, expect } from "vitest";

// Mirror the SQL function logic in JS for testability
// Discount at cut 1 (onboarding, not yet claimed), then every 3 from cut 4: 4, 7, 10, 13...
function loyaltyDiscountDue(cutCount: number, claimed: boolean): boolean {
  if (cutCount === 1 && !claimed) return true;
  if (cutCount >= 4 && (cutCount - 1) % 3 === 0) return true;
  return false;
}

function loyaltyCutsUntilNext(cutCount: number, claimed: boolean): number {
  if (!claimed && cutCount < 1) return 1 - cutCount;
  if (cutCount < 4) return 4 - cutCount;
  return (3 - ((cutCount - 1) % 3)) % 3;
}

describe("loyaltyDiscountDue", () => {
  it("returns true at cut 1 (onboarding, not yet claimed)", () => {
    expect(loyaltyDiscountDue(1, false)).toBe(true);
  });

  it("returns true at cuts 4, 7, 10, 13", () => {
    expect(loyaltyDiscountDue(4, true)).toBe(true);
    expect(loyaltyDiscountDue(7, true)).toBe(true);
    expect(loyaltyDiscountDue(10, true)).toBe(true);
    expect(loyaltyDiscountDue(13, true)).toBe(true);
  });

  it("returns false at cuts 2, 3, 5, 6, 8", () => {
    expect(loyaltyDiscountDue(2, true)).toBe(false);
    expect(loyaltyDiscountDue(3, true)).toBe(false);
    expect(loyaltyDiscountDue(5, true)).toBe(false);
    expect(loyaltyDiscountDue(6, true)).toBe(false);
    expect(loyaltyDiscountDue(8, true)).toBe(false);
  });

  it("returns false at cut 1 if already claimed", () => {
    expect(loyaltyDiscountDue(1, true)).toBe(false);
  });

  it("returns true at cut 16 (next in sequence after 13)", () => {
    expect(loyaltyDiscountDue(16, true)).toBe(true);
  });
});

describe("loyaltyCutsUntilNext", () => {
  it("returns 1 for a new client (0 cuts, not claimed)", () => {
    expect(loyaltyCutsUntilNext(0, false)).toBe(1);
  });

  it("returns 3 at cut 1 (not claimed — next reward at 4)", () => {
    expect(loyaltyCutsUntilNext(1, false)).toBe(3);
  });

  it("returns 3 at cut 1 (claimed — next is 4)", () => {
    expect(loyaltyCutsUntilNext(1, true)).toBe(3);
  });

  it("returns 2 at cut 2 (claimed — next is 4)", () => {
    expect(loyaltyCutsUntilNext(2, true)).toBe(2);
  });

  it("returns 0 at cut 4", () => {
    expect(loyaltyCutsUntilNext(4, true)).toBe(0);
  });

  it("returns 2 at cut 5", () => {
    expect(loyaltyCutsUntilNext(5, true)).toBe(2);
  });

  it("returns 1 at cut 6", () => {
    expect(loyaltyCutsUntilNext(6, true)).toBe(1);
  });

  it("returns 0 at cut 7", () => {
    expect(loyaltyCutsUntilNext(7, true)).toBe(0);
  });
});
