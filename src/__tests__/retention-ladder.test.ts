import { describe, it, expect } from "vitest";
import { nextRung, inWednesdayWindow, type LadderClient } from "@/lib/retention";
import { marketingState, cleanAddress } from "@/lib/marketing";
import { keyword } from "@/lib/opt-out";

const WED_NOON_NY = new Date("2026-10-07T16:30:00Z"); // Wed Oct 7, 12:30pm New York
const daysAgo = (n: number, from = WED_NOON_NY) => new Date(from.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const opts = { now: WED_NOON_NY, rebookDays: 18, offer: "$5 off" };
const client = (o: Partial<LadderClient> = {}): LadderClient => ({
  lastCutDate: daysAgo(20),
  stage: 0,
  lastSentAt: null,
  variantIndex: 0,
  claimedOffer: false,
  optedOut: false,
  hasFutureBooking: false,
  lastInboundAt: null,
  ...o,
});

describe("win-back ladder", () => {
  it("not due yet before the rebook interval", () => {
    expect(nextRung(client({ lastCutDate: daysAgo(10) }), opts)).toBeNull();
  });

  it("rung 1 is the check-in at the rebook interval", () => {
    expect(nextRung(client(), opts)).toMatchObject({ stage: 1, templateKey: "cadence_nudge" });
  });

  it("no reply for weeks walks the ladder one rung per week", () => {
    const cut = daysAgo(62);
    let c = client({ lastCutDate: cut });
    const sent: string[] = [];
    // Simulate sixteen Wednesdays starting the week they became due.
    for (let w = 0; w < 16; w++) {
      const now = new Date(WED_NOON_NY.getTime() - (9 - w) * 7 * 86_400_000 + 45 * 86_400_000);
      const r = nextRung(c, { ...opts, now });
      if (r) {
        sent.push(r.templateKey);
        c = { ...c, stage: r.stage, lastSentAt: now.toISOString(), variantIndex: r.nextVariantIndex, claimedOffer: c.claimedOffer || r.usesOffer };
      }
    }
    // Ladder, then a check-in every 4 weeks (never stops on its own).
    expect(sent).toEqual(["cadence_nudge", "winback_1", "winback_2", "winback_final_offer", "winback_3", "winback_4", "winback_5"]);
  });

  it("the offer goes out only once per client, ever", () => {
    expect(nextRung(client({ lastCutDate: daysAgo(70), stage: 3, lastSentAt: daysAgo(14), claimedOffer: true }), opts)).toMatchObject({ templateKey: "winback_final", usesOffer: false });
    expect(nextRung(client({ lastCutDate: daysAgo(70), stage: 3, lastSentAt: daysAgo(14) }), { ...opts, offer: "" })).toMatchObject({ templateKey: "winback_final" });
  });

  it("after the ladder it keeps checking in every 4 weeks until they opt out", () => {
    expect(nextRung(client({ lastCutDate: daysAgo(90), stage: 4, lastSentAt: daysAgo(20) }), opts)).toBeNull();
    expect(nextRung(client({ lastCutDate: daysAgo(90), stage: 4, lastSentAt: daysAgo(28), variantIndex: 2 }), opts)).toMatchObject({ stage: 5, templateKey: "winback_3" });
    expect(nextRung(client({ lastCutDate: daysAgo(200), stage: 5, lastSentAt: daysAgo(30), variantIndex: 9 }), opts)).toMatchObject({ stage: 5, templateKey: "winback_5" });
    expect(nextRung(client({ lastCutDate: daysAgo(200), stage: 5, lastSentAt: daysAgo(30), optedOut: true }), opts)).toBeNull();
  });

  it("a reply to the shop pauses the ladder", () => {
    const c = client({ lastCutDate: daysAgo(35), stage: 1, lastSentAt: daysAgo(14), lastInboundAt: daysAgo(10) });
    expect(nextRung(c, opts)).toBeNull();
  });

  it("future booking, opt-out or a too-recent text skips them", () => {
    expect(nextRung(client({ hasFutureBooking: true }), opts)).toBeNull();
    expect(nextRung(client({ optedOut: true }), opts)).toBeNull();
    expect(nextRung(client({ lastCutDate: daysAgo(35), stage: 1, lastSentAt: daysAgo(3) }), opts)).toBeNull();
  });

  it("a new cut resets the ladder", () => {
    // Stage 4 from a previous lapse, then they came back 20 days ago.
    expect(nextRung(client({ stage: 4, lastSentAt: daysAgo(40), lastCutDate: daysAgo(20) }), opts)).toMatchObject({ stage: 1 });
  });

  it("win-back copy rotates", () => {
    expect(nextRung(client({ lastCutDate: daysAgo(31), stage: 1, lastSentAt: daysAgo(8), variantIndex: 7 }), opts)).toMatchObject({ templateKey: "winback_3", nextVariantIndex: 8 });
  });

  it("only sends Wednesday at noon, barber's time", () => {
    expect(inWednesdayWindow(WED_NOON_NY, "America/New_York")).toBe(true);
    expect(inWednesdayWindow(WED_NOON_NY, "America/Los_Angeles")).toBe(false);
    expect(inWednesdayWindow(new Date("2026-10-08T16:30:00Z"), "America/New_York")).toBe(false);
  });
});

describe("SMS marketing state", () => {
  it("is the barber's switch; the QR sticker isn't required", () => {
    expect(marketingState(false)).toBe("off");
    expect(marketingState(true)).toBe("on");
  });

  it("shipping address validation", () => {
    expect(cleanAddress({ name: "Fresh Cuts", line1: "1 Main St", city: "Boston", state: "ma", zip: "02118" }).ok).toBe(true);
    expect(cleanAddress({ name: "Fresh Cuts", line1: "1 Main St", city: "Boston", state: "Mass", zip: "02118" }).ok).toBe(false);
    expect(cleanAddress({ name: "Fresh Cuts", line1: "", city: "Boston", state: "MA", zip: "02118" }).ok).toBe(false);
    expect(cleanAddress(null).ok).toBe(false);
  });
});

describe("opt-out keywords", () => {
  it("ignore case, punctuation, accents and spacing", () => {
    for (const t of ["STOP", "Stop.", " stop ", "STOP!", "stop!!"]) expect(keyword(t)).toBe("stop");
    expect(keyword("Párar")).toBe("parar");
    expect(keyword("please stop texting")).toBe("please stop texting");
  });
});
