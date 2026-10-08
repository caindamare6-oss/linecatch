import { describe, it, expect } from "vitest";
import { appThemeVars } from "@/lib/themes";
import { facePhoto, frontIndex, ringGeometry, stepAngle, RING_MIN_SLOTS } from "@/lib/ring";
import { daySlots, localDate, nextOpenings } from "@/lib/slots";

describe("app colors follow the barber's theme", () => {
  it("dark themes use their own colors, with the barber's accent pick on top", () => {
    const mint = appThemeVars("mint", null);
    expect(mint["--app-bg"]).toBe("#070908");
    expect(mint["--app-fg"]).toBe("#F2F5F3");
    expect(mint["--accent-color"]).toBe("#00F5A0");
    expect(mint["color-scheme"]).toBe("dark");

    const copper = appThemeVars("mint", "#E0926A");
    expect(copper["--accent-color"]).toBe("#E0926A");
    expect(copper["--accent-fg"]).toBe("#121110");
  });

  it("Cream & Brass is light and keeps its brass, ignoring dark-theme accent picks", () => {
    const cream = appThemeVars("cream", "#E0926A");
    expect(cream["--app-bg"]).toBe("#F6F1E7");
    expect(cream["--app-fg"]).toBe("#1B1916");
    expect(cream["--accent-color"]).toContain("#A8762A");
    expect(cream["--accent-fg"]).toBe("#FFFFFF");
    expect(cream["color-scheme"]).toBe("light");
  });

  it("LineCatch Champagne (the default) is exactly the live app's colors", () => {
    const gold = appThemeVars("gold", "#D4AF7A");
    expect(gold["--app-bg"]).toBe("#121110");
    expect(gold["--app-bg-deep"]).toBe("#0C0B0A");
    expect(gold["--app-fg"]).toBe("#F2EEE6");
    expect(gold["--app-card"]).toBe("#1B1A18");
    expect(gold["--app-card-2"]).toBe("#2C2A27");
    expect(gold["--app-muted"]).toBe("#948C80");
    expect(gold["--ob-bg"]).toBe("#0F0E0D");
    expect(gold["--accent-color"]).toBe("#D4AF7A");
    // Their accent pick still applies on the default theme.
    expect(appThemeVars("gold", "#A8C49A")["--accent-color"]).toBe("#A8C49A");
  });

  it("an unknown theme or a made-up accent falls back to the LineCatch look", () => {
    const v = appThemeVars("purple-haze", "#123456");
    expect(v["--app-bg"]).toBe("#121110");
    expect(v["--accent-color"]).toBe("#D4AF7A");
  });
});

describe("3D ring", () => {
  it("only places real photos and grows with the count", () => {
    expect(ringGeometry(3).slots).toBe(RING_MIN_SLOTS);
    expect(ringGeometry(25).slots).toBe(25);
    expect(ringGeometry(50).radius).toBeGreaterThan(ringGeometry(25).radius);
  });

  it("always comes to rest facing a real photo, never an empty place", () => {
    const n = 3; // 3 photos on an 8-place ring: places 3–7 are empty
    const { step } = ringGeometry(n);
    for (let a = -720; a <= 720; a += 7) {
      const face = facePhoto(a, n);
      const idx = (((Math.round(-face / step) % 8) + 8) % 8);
      expect(idx).toBeLessThan(n);
      expect(frontIndex(face, n)).toBe(idx);
    }
  });

  it("Next from the last photo wraps to the first, Prev from the first goes to the last", () => {
    const n = 3;
    const { step } = ringGeometry(n);
    const atLast = -2 * step;
    expect(frontIndex(stepAngle(atLast, 1, n), n)).toBe(0);
    expect(frontIndex(stepAngle(0, -1, n), n)).toBe(2);
    expect(frontIndex(stepAngle(0, 1, n), n)).toBe(1);
  });

  it("steps through every photo on a full 25-photo ring", () => {
    const n = 25;
    let angle = 0;
    const seen: number[] = [];
    for (let i = 0; i < n; i++) {
      seen.push(frontIndex(angle, n));
      angle = stepAngle(angle, 1, n);
    }
    expect(seen).toEqual(Array.from({ length: n }, (_, i) => i));
    expect(frontIndex(angle, n)).toBe(0);
  });
});

/** A stand-in for the Supabase client: every query returns the given rows. */
function fakeDb(rows: { bookings?: unknown[]; services?: unknown[] }) {
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "in"]) chain[m] = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows[table as "bookings" | "services"] ?? [] });
    return chain;
  };
  return { from: query } as never;
}

describe("Next opening", () => {
  const tz = "America/New_York";
  const hours = { wednesday: { open: "10:00", close: "19:00" }, thursday: { open: "10:00", close: "19:00" } };
  // Wednesday Oct 7, 2026, 3:10 PM in New York.
  const now = new Date("2026-10-07T19:10:00Z").getTime();

  it("localDate is the barber's calendar day", () => {
    expect(localDate(tz, 0, new Date(now))).toBe("2026-10-07");
    expect(localDate(tz, 1, new Date(now))).toBe("2026-10-08");
  });

  it("skips past times and booked times", async () => {
    const booked = [{ booking_time: "2026-10-07T19:30:00Z", service_id: "s1" }]; // 3:30 PM, 45 min
    const db = fakeDb({ bookings: booked, services: [{ id: "s1", duration_minutes: 45 }] });
    const slots = await daySlots(db, { userId: "u", date: "2026-10-07", totalMinutes: 45, hours, tz, now });
    expect(slots[0]).toBe("16:30");
    expect(slots).not.toContain("15:30");
    expect(slots).not.toContain("16:00");
    expect(slots.at(-1)).toBe("18:00");
  });

  it("returns the next few openings on the first day that has any", async () => {
    const db = fakeDb({});
    const open = await nextOpenings(db, { userId: "u", totalMinutes: 45, hours, tz, now, count: 3 });
    expect(open.map((o) => o.time)).toEqual(["15:30", "16:00", "16:30"]);
    expect(open[0].dayOffset).toBe(0);
  });

  it("moves to tomorrow when today is done", async () => {
    const late = new Date("2026-10-07T23:30:00Z").getTime(); // 7:30 PM, closed
    const open = await nextOpenings(fakeDb({}), { userId: "u", totalMinutes: 45, hours, tz, now: late });
    expect(open[0]).toMatchObject({ date: "2026-10-08", time: "10:00", dayOffset: 1 });
  });
});
