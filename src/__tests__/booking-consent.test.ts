import { describe, it, expect } from "vitest";

type VipClient = {
  id: string;
  is_opted_in: boolean;
  opted_out_at: string | null;
  consent_text: string | null;
  opt_in_source: string | null;
  first_name: string | null;
} | null;

type BookingConsentResult =
  | { allowed: true; action: "create_consent" | "update_consent" | "already_consented" }
  | { allowed: false; reason: string };

function evaluateBookingConsent(
  vipClient: VipClient,
  consentText: string | undefined
): BookingConsentResult {
  if (vipClient?.opted_out_at) {
    return { allowed: false, reason: "opted_out" };
  }

  if (!vipClient) {
    if (!consentText) return { allowed: false, reason: "consent_required" };
    return { allowed: true, action: "create_consent" };
  }

  if (!vipClient.is_opted_in) {
    if (!consentText) return { allowed: false, reason: "consent_required" };
    return { allowed: true, action: "update_consent" };
  }

  return { allowed: true, action: "already_consented" };
}

describe("booking form consent", () => {
  it("new client with consent checkbox creates vip_clients row", () => {
    const result = evaluateBookingConsent(null, "I consent to SMS...");
    expect(result).toEqual({ allowed: true, action: "create_consent" });
  });

  it("new client without consent checkbox is rejected", () => {
    const result = evaluateBookingConsent(null, undefined);
    expect(result).toEqual({ allowed: false, reason: "consent_required" });
  });

  it("existing opted-in client booking again does not require consent", () => {
    const result = evaluateBookingConsent(
      {
        id: "1",
        is_opted_in: true,
        opted_out_at: null,
        consent_text: "Original consent",
        opt_in_source: "vip_form",
        first_name: "Mike",
      },
      undefined
    );
    expect(result).toEqual({ allowed: true, action: "already_consented" });
  });

  it("opted-out client booking is blocked, not re-opted-in", () => {
    const result = evaluateBookingConsent(
      {
        id: "1",
        is_opted_in: true,
        opted_out_at: "2026-01-01T00:00:00Z",
        consent_text: "Original consent",
        opt_in_source: "vip_form",
        first_name: "Mike",
      },
      "I consent to SMS..."
    );
    expect(result).toEqual({ allowed: false, reason: "opted_out" });
  });

  it("existing non-opted-in client with consent gets updated", () => {
    const result = evaluateBookingConsent(
      {
        id: "1",
        is_opted_in: false,
        opted_out_at: null,
        consent_text: null,
        opt_in_source: null,
        first_name: null,
      },
      "I consent to SMS..."
    );
    expect(result).toEqual({ allowed: true, action: "update_consent" });
  });
});
