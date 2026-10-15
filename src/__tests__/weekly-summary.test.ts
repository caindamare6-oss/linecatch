import { describe, it, expect } from "vitest";
import { hasNews, headline, weeklySummaryEmail } from "@/lib/weekly-summary";

describe("weekly summary email", () => {
  it("leads with caught → booked → saved", () => {
    expect(headline({ caught: 6, booked: 3, savedCents: 13500 })).toBe("LineCatch caught 6 missed calls this week. 3 booked, $135 you would have lost.");
    expect(headline({ caught: 1, booked: 0, savedCents: 0 })).toBe("LineCatch caught 1 missed call this week and texted them your booking link.");
  });

  it("is skipped when nothing was caught", () => {
    expect(hasNews({ caught: 0, booked: 0, savedCents: 0 })).toBe(false);
    expect(hasNews({ caught: 2, booked: 0, savedCents: 0 })).toBe(true);
  });

  it("puts the money in the subject and escapes the shop name", () => {
    const e = weeklySummaryEmail({ caught: 4, booked: 2, savedCents: 9000 }, "Kings <Cuts>");
    expect(e.subject).toBe("Your week: $90 saved from missed calls");
    expect(e.html).toContain("Kings &lt;Cuts&gt;");
    expect(e.html).toContain("Turn it off in Settings");
  });

  it("shows only the caught count on a week with nothing booked", () => {
    const e = weeklySummaryEmail({ caught: 3, booked: 0, savedCents: 0 }, null);
    expect(e.html).toContain("missed calls caught");
    expect(e.html).not.toContain("you would have lost");
  });
});
