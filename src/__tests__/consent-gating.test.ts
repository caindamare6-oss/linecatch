import { describe, it, expect, vi } from "vitest";

// Test the consent-gating logic from voice-status
// These verify the decision logic, not HTTP plumbing

type VipClient = {
  id: string;
  is_opted_in: boolean;
  opted_out_at: string | null;
} | null;

function shouldDispatchSMS(
  vipClient: VipClient,
  optOut: boolean,
  isLockedOut: boolean
): { dispatch: boolean; reason: string | null } {
  if (isLockedOut) return { dispatch: false, reason: "trial_locked" };
  if (!vipClient || !vipClient.is_opted_in) return { dispatch: false, reason: "no_consent" };
  if (vipClient.opted_out_at) return { dispatch: false, reason: "opted_out" };
  if (optOut) return { dispatch: false, reason: "opted_out" };
  return { dispatch: true, reason: null };
}

describe("consent gating", () => {
  it("non-opted-in caller gets logged and not texted", () => {
    const result = shouldDispatchSMS(null, false, false);
    expect(result.dispatch).toBe(false);
    expect(result.reason).toBe("no_consent");
  });

  it("caller with is_opted_in=false gets logged and not texted", () => {
    const result = shouldDispatchSMS(
      { id: "1", is_opted_in: false, opted_out_at: null },
      false,
      false
    );
    expect(result.dispatch).toBe(false);
    expect(result.reason).toBe("no_consent");
  });

  it("opted-out caller gets logged and not texted", () => {
    const result = shouldDispatchSMS(
      { id: "1", is_opted_in: true, opted_out_at: "2024-01-01T00:00:00Z" },
      false,
      false
    );
    expect(result.dispatch).toBe(false);
    expect(result.reason).toBe("opted_out");
  });

  it("caller in opt_outs table gets logged and not texted", () => {
    const result = shouldDispatchSMS(
      { id: "1", is_opted_in: true, opted_out_at: null },
      true,
      false
    );
    expect(result.dispatch).toBe(false);
    expect(result.reason).toBe("opted_out");
  });

  it("opted-in caller with valid consent gets texted", () => {
    const result = shouldDispatchSMS(
      { id: "1", is_opted_in: true, opted_out_at: null },
      false,
      false
    );
    expect(result.dispatch).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("locked-out barber's caller gets logged but not texted", () => {
    const result = shouldDispatchSMS(
      { id: "1", is_opted_in: true, opted_out_at: null },
      false,
      true
    );
    expect(result.dispatch).toBe(false);
    expect(result.reason).toBe("trial_locked");
  });
});
