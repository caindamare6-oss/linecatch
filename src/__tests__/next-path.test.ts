import { describe, it, expect } from "vitest";
import { safeNext, scheduleLink } from "@/lib/next-path";

describe("after login", () => {
  it("goes back to the page the link pointed to", () => {
    expect(safeNext("/dashboard/schedule?day=2026-10-07&booking=abc")).toBe("/dashboard/schedule?day=2026-10-07&booking=abc");
    expect(safeNext("/dashboard/clients")).toBe("/dashboard/clients");
  });
  it("never to another site, or back to login", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/login?next=/x", "/auth/callback", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});

describe("links in texts to the barber", () => {
  it("open the booking's day, in the barber's timezone", () => {
    // 1:30am UTC Oct 8 is still Oct 7 in New York.
    expect(scheduleLink("https://www.linecatch.app", "b1", "2026-10-08T01:30:00Z", "America/New_York")).toBe(
      "https://www.linecatch.app/dashboard/schedule?day=2026-10-07&booking=b1"
    );
  });
});

import { TEXT_CATALOG, missingFillIns, unknownFillIns, fillExample } from "@/lib/text-catalog";
import { measure } from "@/lib/sms-segments";

describe("Admin → Texts checks", () => {
  const confirm = TEXT_CATALOG.find((t) => t.key === "booking_confirm")!;
  it("a text that loses its link can't be saved", () => {
    expect(missingFillIns("You're in. {date} at {time}.", confirm)).toEqual(["link"]);
    expect(missingFillIns("You're in. {date} at {time}. {link}", confirm)).toEqual([]);
  });
  it("a fill-in the text can't use is caught", () => {
    expect(unknownFillIns("Hi {first_nam}. {link}", confirm)).toEqual(["first_nam"]);
  });
  it("counter: 160 plain characters is 1 text, one accent makes it 70 per text", () => {
    expect(measure("a".repeat(160)).segments).toBe(1);
    expect(measure("a".repeat(161)).segments).toBe(2);
    expect(measure("á" + "a".repeat(70)).segments).toBe(2);
    expect(fillExample("Book: {link}")).toBe("Book: www.linecatch.app/c/K7mP2xQa");
  });
});
