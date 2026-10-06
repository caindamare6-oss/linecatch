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
