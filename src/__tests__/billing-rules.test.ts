import { describe, it, expect } from "vitest";
import {
  billingState,
  daysSinceTrialEnd,
  trialDaysLeft,
  fromStripeStatus,
  cutChargeCents,
  noShowFeeCents,
  isLateCancel,
} from "@/lib/billing-rules";

const DAY = 86_400_000;
const NOW = new Date("2026-10-12T15:00:00Z").getTime();
const at = (days: number) => new Date(NOW + days * DAY).toISOString();
const barber = (o: Partial<Parameters<typeof billingState>[0]> = {}) => ({
  billing_status: "trialing" as const,
  trial_ends_at: at(14),
  billing_grace_until: null,
  stripe_subscription_id: null,
  ...o,
});

describe("14-day trial", () => {
  it("counts days left, and days since it ended", () => {
    expect(trialDaysLeft(at(14), NOW)).toBe(14);
    expect(daysSinceTrialEnd(at(1), NOW)).toBe(-1);
    expect(daysSinceTrialEnd(at(-0.2), NOW)).toBe(0);
    expect(daysSinceTrialEnd(at(-3.5), NOW)).toBe(3);
  });

  it("never asks for a card while the trial runs", () => {
    expect(billingState(barber(), NOW)).toMatchObject({ status: "trialing", banner: null, shouldPause: false, daysLeft: 14 });
    expect(billingState(barber({ trial_ends_at: at(0.5) }), NOW).banner).toBeNull();
  });

  it("a card added during the trial: no banner, no pause", () => {
    expect(billingState(barber({ stripe_subscription_id: "sub_1", trial_ends_at: at(-30) }), NOW)).toMatchObject({ banner: null, shouldPause: false });
  });

  it("trial over with no card: texts keep going 7 days, then pause", () => {
    expect(billingState(barber({ trial_ends_at: at(-1) }), NOW)).toMatchObject({ banner: "add_card", shouldPause: false });
    expect(billingState(barber({ trial_ends_at: at(-6.5) }), NOW)).toMatchObject({ shouldPause: false });
    expect(billingState(barber({ trial_ends_at: at(-7) }), NOW)).toMatchObject({ status: "paused", shouldPause: true, banner: "paused" });
  });
});

describe("paying barbers", () => {
  it("active: nothing to show", () => {
    expect(billingState(barber({ billing_status: "active" }), NOW)).toMatchObject({ banner: null, shouldPause: false });
  });

  it("failed payment: 7-day grace, then pause", () => {
    expect(billingState(barber({ billing_status: "past_due", billing_grace_until: at(3) }), NOW)).toMatchObject({ banner: "past_due", shouldPause: false });
    expect(billingState(barber({ billing_status: "past_due", billing_grace_until: at(-0.1) }), NOW)).toMatchObject({ banner: "paused", shouldPause: true });
  });

  it("canceled pauses", () => {
    expect(billingState(barber({ billing_status: "canceled" }), NOW).shouldPause).toBe(true);
  });

  it("maps Stripe statuses", () => {
    expect(fromStripeStatus("active")).toBe("active");
    expect(fromStripeStatus("unpaid")).toBe("past_due");
    expect(fromStripeStatus("incomplete_expired")).toBe("canceled");
  });
});

describe("client charges", () => {
  it("the cut minus the 10th-cut reward", () => {
    expect(cutChargeCents(3500, 0)).toBe(3500);
    expect(cutChargeCents(3500, 1750)).toBe(1750);
    expect(cutChargeCents(3500, 3500)).toBe(0);
    // Stripe can't charge under 50¢.
    expect(cutChargeCents(3500, 3480)).toBe(0);
  });

  it("no-show fee: the barber's % of the price, kept between 10% and 100%", () => {
    expect(noShowFeeCents(4000, 50)).toBe(2000);
    expect(noShowFeeCents(4000, 100)).toBe(4000);
    expect(noShowFeeCents(4000, 500)).toBe(4000);
    expect(noShowFeeCents(4000, 1)).toBe(400);
    expect(noShowFeeCents(0, 50)).toBe(0);
  });

  it("late cancel is under 2 hours before, never after the start", () => {
    expect(isLateCancel(new Date(NOW + 90 * 60_000), NOW)).toBe(true);
    expect(isLateCancel(new Date(NOW + 150 * 60_000), NOW)).toBe(false);
    expect(isLateCancel(new Date(NOW - 60_000), NOW)).toBe(false);
  });
});

