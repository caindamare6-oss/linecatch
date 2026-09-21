import { describe, it, expect } from "vitest";

type Barber = {
  user_id: string;
  is_active: boolean;
  is_locked_out: boolean;
};

function shouldCronProcess(barber: Barber): boolean {
  return barber.is_active && !barber.is_locked_out;
}

function shouldProcessSTOP(_isLockedOut: boolean): boolean {
  return true;
}

function shouldProcessLanguageChange(isLockedOut: boolean): boolean {
  return !isLockedOut;
}

describe("trial lockout — cron skipping", () => {
  it("active, non-locked barber is processed by cron", () => {
    expect(shouldCronProcess({ user_id: "1", is_active: true, is_locked_out: false })).toBe(true);
  });

  it("locked-out barber is skipped by cron", () => {
    expect(shouldCronProcess({ user_id: "1", is_active: true, is_locked_out: true })).toBe(false);
  });

  it("inactive barber is skipped by cron", () => {
    expect(shouldCronProcess({ user_id: "1", is_active: false, is_locked_out: false })).toBe(false);
  });
});

describe("trial lockout — STOP/HELP always process", () => {
  it("STOP processes even when barber is locked out", () => {
    expect(shouldProcessSTOP(true)).toBe(true);
  });

  it("STOP processes when barber is not locked out", () => {
    expect(shouldProcessSTOP(false)).toBe(true);
  });
});

describe("trial lockout — language change blocked when locked", () => {
  it("language change blocked when locked out", () => {
    expect(shouldProcessLanguageChange(true)).toBe(false);
  });

  it("language change allowed when not locked out", () => {
    expect(shouldProcessLanguageChange(false)).toBe(true);
  });
});
