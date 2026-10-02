import { describe, it, expect } from "vitest";
import { wednesdayText, inWednesdayWindow, nextWednesdayNoon, type WednesdayClient } from "@/lib/retention";
import { marketingState, cleanAddress } from "@/lib/marketing";
import { keyword } from "@/lib/opt-out";

const DAY = 86_400_000;
const WED = new Date("2026-10-07T16:30:00Z"); // Wed Oct 7, 12:30pm New York
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysBefore = (n: number, from = WED) => ymd(new Date(from.getTime() - n * DAY));
const opts = { now: WED, offer: "$5 off" };
const client = (o: Partial<WednesdayClient> = {}): WednesdayClient => ({
  lastCutDate: daysBefore(14),
  lastSentAt: null,
  variantIndex: 0,
  claimedOffer: false,
  optedOut: false,
  hasFutureBooking: false,
  lastInboundAt: null,
  ...o,
});

describe("Wednesday reminders", () => {
  it("first text: the first Wednesday at least 2 weeks after the cut, whatever day the cut was", () => {
    expect(wednesdayText(client({ lastCutDate: daysBefore(13) }), opts)).toBeNull();
    // Cuts on every weekday of the week 2–3 weeks back all get their first text this Wednesday.
    for (let d = 14; d <= 20; d++) expect(wednesdayText(client({ lastCutDate: daysBefore(d) }), opts)).toMatchObject({ templateKey: "cadence_nudge", first: true });
  });

  it("simulating a year of Wednesdays: first at 2–3 weeks, then every 3 weeks, forever", () => {
    for (const cutOffset of [0, 1, 2, 3, 4, 5, 6]) {
      // A cut on each day of the week (Wed, Tue, Mon, Sun, Sat, Fri, Thu).
      const cut = new Date(WED.getTime() - cutOffset * DAY);
      let c = client({ lastCutDate: ymd(cut) });
      const sentOn: Date[] = [];
      for (let w = 1; w <= 52; w++) {
        // Noon New York every Wednesday (follows the November clock change).
        const now = new Date(nextWednesdayNoon(new Date(WED.getTime() + (w * 7 - 1) * DAY), "America/New_York").getTime() + 30 * 60_000);
        const r = wednesdayText(c, { now, offer: "" });
        if (r) {
          sentOn.push(now);
          c = { ...c, lastSentAt: now.toISOString(), variantIndex: r.nextVariantIndex };
        }
      }
      const firstGap = Math.round((sentOn[0].getTime() - cut.getTime()) / DAY);
      expect(firstGap).toBeGreaterThanOrEqual(14);
      expect(firstGap).toBeLessThanOrEqual(20);
      for (let i = 1; i < sentOn.length; i++) expect(Math.round((sentOn[i].getTime() - sentOn[i - 1].getTime()) / DAY)).toBe(21);
      expect(sentOn.length).toBeGreaterThanOrEqual(16);
      for (const d of sentOn) expect(inWednesdayWindow(d, "America/New_York")).toBe(true);
    }
  });

  it("repeats rotate the copy; the offer goes out once, after 8+ weeks", () => {
    expect(wednesdayText(client({ lastCutDate: daysBefore(40), lastSentAt: daysBefore(21), variantIndex: 7 }), opts)).toMatchObject({ templateKey: "winback_3", nextVariantIndex: 8 });
    expect(wednesdayText(client({ lastCutDate: daysBefore(60), lastSentAt: daysBefore(21) }), opts)).toMatchObject({ templateKey: "winback_final_offer", usesOffer: true });
    expect(wednesdayText(client({ lastCutDate: daysBefore(60), lastSentAt: daysBefore(21), claimedOffer: true }), opts)).toMatchObject({ templateKey: "winback_1" });
    expect(wednesdayText(client({ lastCutDate: daysBefore(60), lastSentAt: daysBefore(21) }), { ...opts, offer: "" })).toMatchObject({ templateKey: "winback_1" });
  });

  it("not before 3 weeks since the last text", () => {
    expect(wednesdayText(client({ lastCutDate: daysBefore(40), lastSentAt: daysBefore(14) }), opts)).toBeNull();
  });

  it("stops on opt-out, skips future bookings and recent replies, restarts after a new cut", () => {
    expect(wednesdayText(client({ optedOut: true }), opts)).toBeNull();
    expect(wednesdayText(client({ hasFutureBooking: true }), opts)).toBeNull();
    expect(wednesdayText(client({ lastInboundAt: daysBefore(3) }), opts)).toBeNull();
    expect(wednesdayText(client({ lastInboundAt: daysBefore(8) }), opts)).not.toBeNull();
    // The last text was before their latest cut, so it's a fresh start.
    expect(wednesdayText(client({ lastCutDate: daysBefore(15), lastSentAt: daysBefore(30) }), opts)).toMatchObject({ first: true });
  });

  it("only Wednesday at noon, barber's time", () => {
    expect(inWednesdayWindow(WED, "America/New_York")).toBe(true);
    expect(inWednesdayWindow(WED, "America/Los_Angeles")).toBe(false);
    expect(inWednesdayWindow(new Date("2026-10-08T16:30:00Z"), "America/New_York")).toBe(false);
    expect(nextWednesdayNoon(new Date("2026-10-09T15:00:00Z"), "America/New_York").toISOString()).toBe("2026-10-14T16:00:00.000Z");
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
