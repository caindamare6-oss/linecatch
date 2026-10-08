import { describe, it, expect } from "vitest";

function canModifyBooking(status: string, bookingTime: Date, now: Date): "ok" | "too_late" | "not_active" {
  if (status !== "confirmed") return "not_active";
  const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 3) return "too_late";
  return "ok";
}

describe("manage booking window", () => {
  const now = new Date("2026-09-19T10:00:00Z");

  it("allows changes when booking is 4+ hours away", () => {
    const bt = new Date("2026-09-19T14:00:00Z");
    expect(canModifyBooking("confirmed", bt, now)).toBe("ok");
  });

  it("allows changes at exactly 3h01m", () => {
    const bt = new Date("2026-09-19T13:01:00Z");
    expect(canModifyBooking("confirmed", bt, now)).toBe("ok");
  });

  it("blocks changes at exactly 3 hours", () => {
    const bt = new Date("2026-09-19T13:00:00Z");
    expect(canModifyBooking("confirmed", bt, now)).toBe("too_late");
  });

  it("blocks changes at 2 hours away", () => {
    const bt = new Date("2026-09-19T12:00:00Z");
    expect(canModifyBooking("confirmed", bt, now)).toBe("too_late");
  });

  it("blocks changes for past bookings", () => {
    const bt = new Date("2026-09-19T09:00:00Z");
    expect(canModifyBooking("confirmed", bt, now)).toBe("too_late");
  });

  it("returns not_active for cancelled bookings", () => {
    const bt = new Date("2026-09-19T14:00:00Z");
    expect(canModifyBooking("cancelled", bt, now)).toBe("not_active");
  });

  it("returns not_active for completed bookings", () => {
    const bt = new Date("2026-09-19T14:00:00Z");
    expect(canModifyBooking("completed", bt, now)).toBe("not_active");
  });
});

describe("LATE keyword eligibility", () => {
  function shouldProcessLate(body: string, isLockedOut: boolean): boolean {
    return body.trim().toLowerCase() === "late" && !isLockedOut;
  }

  it("processes LATE from active barber", () => {
    expect(shouldProcessLate("LATE", false)).toBe(true);
  });

  it("processes late (lowercase)", () => {
    expect(shouldProcessLate("late", false)).toBe(true);
  });

  it("ignores LATE from locked-out barber", () => {
    expect(shouldProcessLate("LATE", true)).toBe(false);
  });

  it("ignores other keywords", () => {
    expect(shouldProcessLate("STOP", false)).toBe(false);
  });
});
