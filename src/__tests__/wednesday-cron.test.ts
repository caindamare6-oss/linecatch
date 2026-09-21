import { describe, it, expect } from "vitest";

// Test the timezone-aware Wednesday selection logic

function isWednesdayNoon(now: Date, timezone: string): boolean {
  const localTimeStr = now.toLocaleString("en-US", { timeZone: timezone });
  const localTime = new Date(localTimeStr);
  return localTime.getDay() === 3 && localTime.getHours() === 12;
}

function shouldReengage(
  lastReengagementSentAt: string | null,
  now: Date,
  guardDays: number = 21
): boolean {
  if (!lastReengagementSentAt) return true;
  const lastSent = new Date(lastReengagementSentAt);
  const guardMs = guardDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastSent.getTime() > guardMs;
}

describe("Wednesday cron timezone selection", () => {
  // Wednesday Sep 16, 2026 at 16:30 UTC = 12:30 PM ET, 11:30 AM CT, 9:30 AM PT
  const wednesdayUTC = new Date("2026-09-16T16:30:00Z");

  it("picks America/New_York when UTC is 16:30 on Wednesday", () => {
    expect(isWednesdayNoon(wednesdayUTC, "America/New_York")).toBe(true);
  });

  it("does NOT pick America/Chicago at the same UTC time (11:30 AM CT)", () => {
    expect(isWednesdayNoon(wednesdayUTC, "America/Chicago")).toBe(false);
  });

  it("does NOT pick America/Los_Angeles at the same UTC time (9:30 AM PT)", () => {
    expect(isWednesdayNoon(wednesdayUTC, "America/Los_Angeles")).toBe(false);
  });

  // Wednesday Sep 16, 2026 at 17:30 UTC = 12:30 PM CT
  const wednesdayCT = new Date("2026-09-16T17:30:00Z");

  it("picks America/Chicago when UTC is 17:30 on Wednesday", () => {
    expect(isWednesdayNoon(wednesdayCT, "America/Chicago")).toBe(true);
  });

  // Wednesday Sep 16, 2026 at 19:30 UTC = 12:30 PM PT
  const wednesdayPT = new Date("2026-09-16T19:30:00Z");

  it("picks America/Los_Angeles when UTC is 19:30 on Wednesday", () => {
    expect(isWednesdayNoon(wednesdayPT, "America/Los_Angeles")).toBe(true);
  });

  // Thursday should never match
  const thursdayUTC = new Date("2026-09-17T16:30:00Z");

  it("does NOT pick any timezone on Thursday", () => {
    expect(isWednesdayNoon(thursdayUTC, "America/New_York")).toBe(false);
  });
});

describe("21-day re-engagement guard", () => {
  const now = new Date("2026-09-16T12:00:00Z");

  it("allows first-time re-engagement (null)", () => {
    expect(shouldReengage(null, now)).toBe(true);
  });

  it("blocks re-engagement sent 10 days ago", () => {
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldReengage(tenDaysAgo, now)).toBe(false);
  });

  it("allows re-engagement sent 22 days ago", () => {
    const twentyTwoDaysAgo = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldReengage(twentyTwoDaysAgo, now)).toBe(true);
  });

  it("blocks re-engagement sent exactly 21 days ago", () => {
    const exactlyTwentyOne = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldReengage(exactlyTwentyOne, now)).toBe(false);
  });
});
