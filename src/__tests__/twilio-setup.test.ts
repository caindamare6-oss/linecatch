import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn().mockResolvedValue({});
const twilioNumbers = [
  { sid: "PN1", phoneNumber: "+16175550001", smsUrl: "https://www.linecatch.app/api/twilio/sms", smsMethod: "POST", voiceUrl: "https://www.linecatch.app/api/twilio/voice", voiceMethod: "POST" },
  { sid: "PN2", phoneNumber: "+16175550002", smsUrl: "https://old.example.com/sms", smsMethod: "POST", voiceUrl: null, voiceMethod: "POST" },
  { sid: "PN3", phoneNumber: "+16175550003", smsUrl: null, smsMethod: null, voiceUrl: null, voiceMethod: null },
];
const client = Object.assign((sid: string) => ({ update: (o: unknown) => update(sid, o) }), {
  list: vi.fn().mockResolvedValue(twilioNumbers),
});

vi.mock("@/lib/twilio", () => ({
  isTwilioEnabled: () => process.env.TWILIO_ENABLED !== "false",
  getTwilioClient: () => ({
    api: { v2010: { accounts: () => ({ fetch: async () => ({ friendlyName: "LineCatch", status: "active" }) }) } },
    incomingPhoneNumbers: client,
  }),
}));

import { twilioStatus, fixWebhooks } from "@/lib/twilio-setup";

const barbers = [
  { phone_number: "+16175550001", business_name: "Fresh Cuts", first_name: null, onboarding_completed: true },
  { phone_number: "+16175550002", business_name: "Kings", first_name: null, onboarding_completed: true },
  { phone_number: "+16175559999", business_name: "Gone", first_name: null, onboarding_completed: true },
  { phone_number: null, business_name: "New Shop", first_name: null, onboarding_completed: true },
];
const db = { from: () => ({ select: async () => ({ data: barbers }) }) } as never;

beforeEach(() => {
  update.mockClear();
  process.env.TWILIO_ACCOUNT_SID = "AC123";
  process.env.TWILIO_AUTH_TOKEN = "secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.linecatch.app";
  delete process.env.SMS_DEV_MODE;
  delete process.env.TWILIO_ENABLED;
});

describe("Twilio connection check", () => {
  it("reports each barber number's webhooks and what to fix", async () => {
    const s = await twilioStatus(db);
    expect(s.account.ok).toBe(true);
    const byPhone = Object.fromEntries(s.numbers.map((n) => [n.phone, n]));
    expect(byPhone["+16175550001"]).toMatchObject({ inTwilio: true, smsOk: true, voiceOk: true });
    expect(byPhone["+16175550002"]).toMatchObject({ inTwilio: true, smsOk: false, voiceOk: false });
    expect(byPhone["+16175559999"].inTwilio).toBe(false);
    expect(s.unlinked).toEqual(["+16175550003"]);
    expect(s.barbersWithoutNumber).toBe(1);
    expect(s.problems.join(" ")).toMatch(/Kings/);
    expect(s.problems.join(" ")).toMatch(/isn't in this Twilio account/);
  });

  it("flags dev mode and missing credentials", async () => {
    process.env.SMS_DEV_MODE = "true";
    delete process.env.TWILIO_AUTH_TOKEN;
    const s = await twilioStatus(db);
    expect(s.credentials).toBe(false);
    expect(s.account.ok).toBe(false);
    expect(s.problems.join(" ")).toMatch(/SMS_DEV_MODE/);
    expect(s.problems.join(" ")).toMatch(/TWILIO_ACCOUNT_SID/);
  });

  it("rewires only the numbers that point somewhere else, and never unlinked ones", async () => {
    const r = await fixWebhooks(db);
    expect(r.fixed).toEqual(["+16175550002"]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("PN2", {
      smsUrl: "https://www.linecatch.app/api/twilio/sms",
      smsMethod: "POST",
      voiceUrl: "https://www.linecatch.app/api/twilio/voice",
      voiceMethod: "POST",
    });
  });
});
