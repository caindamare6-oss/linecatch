import { describe, it, expect } from "vitest";

// Mirror the review request eligibility logic from bookings/[id]/route.ts
function shouldSendReviewRequest(opts: {
  newCutCount: number;
  googleReviewUrl: string | null;
  lastReviewRequestAt: string | null;
  isOptedIn: boolean;
  optedOutAt: string | null;
}): boolean {
  if (opts.newCutCount !== 2) return false;
  if (!opts.googleReviewUrl) return false;
  if (opts.lastReviewRequestAt) return false;
  if (!opts.isOptedIn) return false;
  if (opts.optedOutAt) return false;
  return true;
}

describe("review request eligibility", () => {
  const base = {
    newCutCount: 2,
    googleReviewUrl: "https://g.page/r/abc123",
    lastReviewRequestAt: null,
    isOptedIn: true,
    optedOutAt: null,
  };

  it("sends at cut 2 with review URL set and no prior request", () => {
    expect(shouldSendReviewRequest(base)).toBe(true);
  });

  it("does NOT send at cut 1", () => {
    expect(shouldSendReviewRequest({ ...base, newCutCount: 1 })).toBe(false);
  });

  it("does NOT send at cut 3", () => {
    expect(shouldSendReviewRequest({ ...base, newCutCount: 3 })).toBe(false);
  });

  it("does NOT send at cut 4 or later", () => {
    expect(shouldSendReviewRequest({ ...base, newCutCount: 4 })).toBe(false);
    expect(shouldSendReviewRequest({ ...base, newCutCount: 7 })).toBe(false);
  });

  it("skips when google_review_url is null", () => {
    expect(shouldSendReviewRequest({ ...base, googleReviewUrl: null })).toBe(false);
  });

  it("skips when google_review_url is empty string", () => {
    expect(shouldSendReviewRequest({ ...base, googleReviewUrl: "" })).toBe(false);
  });

  it("skips when client already received a review request", () => {
    expect(
      shouldSendReviewRequest({
        ...base,
        lastReviewRequestAt: "2026-08-01T12:00:00Z",
      })
    ).toBe(false);
  });

  it("skips when client is opted out", () => {
    expect(
      shouldSendReviewRequest({ ...base, isOptedIn: false })
    ).toBe(false);
  });

  it("skips when client has opted_out_at set", () => {
    expect(
      shouldSendReviewRequest({
        ...base,
        optedOutAt: "2026-09-01T12:00:00Z",
      })
    ).toBe(false);
  });
});
