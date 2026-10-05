import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { withOptOut, isMarketingTemplate } = await import("@/lib/twilio");

describe("STOP footer at send time", () => {
  const template = "Hey Mike, sorry we missed you! Book here: https://link.com";
  const client = { audience: "client" as const, language: "en" };

  it("a client's first text gets the STOP footer", () => {
    expect(withOptOut(template, { ...client, templateKey: "missed_call", firstText: true })).toContain("Reply STOP to opt out.");
  });

  it("later service texts don't", () => {
    expect(withOptOut(template, { ...client, templateKey: "booking_confirm", firstText: false })).toBe(template);
    expect(withOptOut(template, { ...client, templateKey: "missed_call", firstText: false })).toBe(template);
  });

  it("marketing texts always do", () => {
    for (const key of ["broadcast", "review_request", "cadence_nudge", "winback_1", "winback_final_offer"]) {
      expect(isMarketingTemplate(key)).toBe(true);
      expect(withOptOut(template, { ...client, templateKey: key, firstText: false })).toContain("Reply STOP to opt out.");
    }
  });

  it("Spanish clients get it in Spanish", () => {
    expect(withOptOut(template, { audience: "client", language: "es", templateKey: "broadcast", firstText: false })).toContain("Responde STOP");
  });

  it("barber message does NOT get STOP footer", () => {
    expect(withOptOut(template, { audience: "barber", language: "en", templateKey: "morning_summary", firstText: true })).not.toContain("STOP");
  });

  it("message already containing STOP is not doubled", () => {
    const msgWithStop = "Book here: link.com\nReply STOP to opt out.";
    expect(withOptOut(msgWithStop, { ...client, templateKey: "broadcast", firstText: true })).toBe(msgWithStop);
  });
});
