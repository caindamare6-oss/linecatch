import { describe, it, expect } from "vitest";
import { summarizeClients, shortAgo, clientPathId, phoneFromPathId } from "@/lib/clients";
import { buildInbox, templateLabel, type SmsRow } from "@/lib/conversations";
import { monthRevenue, monthBounds, greetingFor } from "@/lib/revenue";
import { cleanHours, cleanOptionalPhone, cleanUrl, cleanService, cleanAccent } from "@/lib/validate";

const NOW = new Date("2026-10-15T16:00:00Z"); // Thu Oct 15, noon in New York

describe("summarizeClients", () => {
  const base = {
    vips: [
      { phone_number: "+16175550001", first_name: "Alex", is_opted_in: true, opted_out_at: null, cut_count: 3 },
      { phone_number: "+16175550002", first_name: "Bo", is_opted_in: true, opted_out_at: "2026-10-01T00:00:00Z", cut_count: 1 },
    ],
    contacts: [{ caller_phone: "+16175550001", name: "Alex Rivera" }, { caller_phone: "+16175550003", name: null }],
    bookings: [
      { customer_phone: "+16175550001", booking_time: "2026-10-01T15:00:00Z", status: "completed", service_id: "a" },
      { customer_phone: "+16175550001", booking_time: "2026-09-10T15:00:00Z", status: "completed", service_id: "b" },
      { customer_phone: "+16175550001", booking_time: "2026-10-20T15:00:00Z", status: "confirmed", service_id: "a" },
      { customer_phone: "+16175550004", booking_time: "2026-10-01T15:00:00Z", status: "cancelled", service_id: "a" },
    ],
    prices: { a: 35, b: 50 },
    optOuts: [],
    plan: "full" as const,
    now: NOW,
  };

  it("merges VIPs, contacts and bookers; the barber's name wins", () => {
    const out = summarizeClients(base);
    const alex = out.find((c) => c.phone === "+16175550001")!;
    expect(alex.name).toBe("Alex Rivera");
    expect(alex.visits).toBe(2);
    expect(alex.spent).toBe(85);
    expect(alex.lastVisit).toBe("2026-10-01T15:00:00Z");
    expect(alex.nextBooking).toBe("2026-10-20T15:00:00Z");
    expect(out.map((c) => c.phone)).toContain("+16175550003");
    expect(out.map((c) => c.phone)).toContain("+16175550004");
  });

  it("an opted-out client is never a VIP", () => {
    const bo = summarizeClients(base).find((c) => c.phone === "+16175550002")!;
    expect(bo.isVip).toBe(false);
    expect(bo.optedOut).toBe(true);
    const viaTable = summarizeClients({ ...base, optOuts: ["+16175550001"] }).find((c) => c.phone === "+16175550001")!;
    expect(viaTable.isVip).toBe(false);
  });

  it("loyalty: full plan rewards cut 4 after 3 stamps; basic rewards cut 3 after 2", () => {
    const alex = summarizeClients(base).find((c) => c.phone === "+16175550001")!;
    expect(alex.rewardDue).toBe(true);
    const basic = summarizeClients({ ...base, plan: "basic", vips: [{ ...base.vips[0], cut_count: 1 }] }).find((c) => c.phone === "+16175550001")!;
    expect(basic.rewardDue).toBe(false);
    expect(basic.cutsToReward).toBe(2);
  });

  it("people with an upcoming booking sort first", () => {
    expect(summarizeClients(base)[0].phone).toBe("+16175550001");
  });

  it("path ids round-trip and reject junk", () => {
    expect(phoneFromPathId(clientPathId("+16175550001"))).toBe("+16175550001");
    expect(phoneFromPathId("abc")).toBeNull();
    expect(phoneFromPathId("1617")).toBeNull();
  });

  it("shortAgo", () => {
    expect(shortAgo("2026-10-14T16:00:00Z", NOW)).toBe("1d");
    expect(shortAgo("2026-10-01T16:00:00Z", NOW)).toBe("2w");
    expect(shortAgo(null, NOW)).toBe("");
  });
});

describe("buildInbox", () => {
  const row = (o: Partial<SmsRow>): SmsRow => ({ id: Math.random().toString(), to_number: "+1", from_number: null, direction: "outbound", template_key: "direct", body: "hi", status: "sent", created_at: "2026-10-15T10:00:00Z", ...o });
  const rows: SmsRow[] = [
    row({ to_number: "+16175550001", template_key: "missed_call", created_at: "2026-10-15T09:00:00Z" }),
    row({ direction: "inbound", from_number: "+16175550001", to_number: "+16175550100", body: "can I come at 4?", template_key: null, created_at: "2026-10-15T09:05:00Z" }),
    row({ to_number: "+16175550002", template_key: "broadcast", body: "Open Thursday", created_at: "2026-10-14T12:00:00Z" }),
    row({ to_number: "+16175550003", template_key: "broadcast", body: "Open Thursday", created_at: "2026-10-14T12:00:03Z" }),
    row({ to_number: "+16175550100", template_key: "morning_summary", body: "3 cuts today", created_at: "2026-10-15T12:00:00Z" }),
  ];

  it("one row per client, latest message, unreplied when they texted last", () => {
    const inbox = buildInbox(rows, { "+16175550001": "Alex" });
    const alex = inbox.find((i) => i.kind === "client" && i.phone === "+16175550001");
    expect(alex && alex.kind === "client" && alex.last.body).toBe("can I come at 4?");
    expect(alex && alex.kind === "client" && alex.unreplied).toBe(true);
    expect(alex && alex.kind === "client" && alex.name).toBe("Alex");
  });

  it("collapses a broadcast into one row with a count, and hides texts to the barber", () => {
    const inbox = buildInbox(rows, {});
    const casts = inbox.filter((i) => i.kind === "broadcast");
    expect(casts).toHaveLength(1);
    expect(casts[0].kind === "broadcast" && casts[0].sent).toBe(2);
    expect(inbox.some((i) => i.kind === "client" && i.phone === "+16175550100")).toBe(false);
  });

  it("filters", () => {
    expect(buildInbox(rows, {}, "received").every((i) => i.kind === "client" && i.hasInbound)).toBe(true);
    expect(buildInbox(rows, {}, "sent").some((i) => i.kind === "client" && i.phone === "+16175550001")).toBe(false);
  });

  it("labels automated texts", () => {
    expect(templateLabel("missed_call")).toBe("Missed-call text");
    expect(templateLabel("winback_3")).toBe("Win-back");
    expect(templateLabel("direct")).toBeNull();
  });
});

describe("monthRevenue", () => {
  const tz = "America/New_York";
  it("uses the barber's calendar month, not UTC", () => {
    // 11pm Sept 30 in New York is Oct 1 in UTC: belongs to September.
    const b = monthBounds(NOW, tz);
    expect(b.start.toISOString()).toBe("2026-10-01T04:00:00.000Z");
    const r = monthRevenue([{ booking_time: "2026-10-01T03:00:00Z", service_id: "a" }], { a: 35 }, tz, NOW);
    expect(r.total).toBe(0);
    expect(r.lastMonthToDate).toBe(0); // Sept 30 is after the 15th
  });

  it("sums real prices and builds a running weekly line", () => {
    const r = monthRevenue(
      [
        { booking_time: "2026-10-02T15:00:00Z", service_id: "a" },
        { booking_time: "2026-10-09T15:00:00Z", service_id: "b" },
        { booking_time: "2026-10-14T15:00:00Z", service_id: "a" },
        { booking_time: "2026-09-10T15:00:00Z", service_id: "b" },
        { booking_time: "2026-09-20T15:00:00Z", service_id: "b" },
      ],
      { a: 35, b: 50 },
      tz,
      NOW
    );
    expect(r.total).toBe(120);
    expect(r.cuts).toBe(3);
    expect(r.lastMonthToDate).toBe(50); // only Sept 1–15 counts against Oct 1–15
    expect(r.points).toEqual([35, 120, 120, null, null]);
    expect(r.currentWeek).toBe(2);
    expect(r.monthName).toBe("October");
  });

  it("greets by the barber's local time", () => {
    expect(greetingFor(new Date("2026-10-15T12:00:00Z"), tz)).toBe("Good morning");
    expect(greetingFor(new Date("2026-10-15T19:00:00Z"), tz)).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-10-16T01:00:00Z"), tz)).toBe("Good evening");
  });
});

describe("validators", () => {
  it("hours: closed days become null, bad ranges rejected, all-closed is null", () => {
    const ok = cleanHours({ monday: { open: "09:00", close: "18:00" }, tuesday: null, extra: { open: "1", close: "2" } });
    expect(ok).toEqual({ ok: true, value: { monday: { open: "09:00", close: "18:00" }, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null } });
    expect(cleanHours({ monday: { open: "18:00", close: "09:00" } }).ok).toBe(false);
    expect(cleanHours({ monday: { open: "9am", close: "5pm" } }).ok).toBe(false);
    expect(cleanHours({})).toEqual({ ok: true, value: null });
  });

  it("phones normalize to E.164; empty clears", () => {
    expect(cleanOptionalPhone("(617) 555-0101")).toEqual({ ok: true, value: "+16175550101" });
    expect(cleanOptionalPhone("")).toEqual({ ok: true, value: null });
    expect(cleanOptionalPhone("123").ok).toBe(false);
  });

  it("urls get a scheme; junk is rejected", () => {
    expect(cleanUrl("g.page/r/abc/review")).toEqual({ ok: true, value: "https://g.page/r/abc/review" });
    expect(cleanUrl("not a url").ok).toBe(false);
    expect(cleanUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("services need a name, sane price and minutes", () => {
    expect(cleanService({ name: " Fade ", price: "35", duration: 30 })).toEqual({ name: "Fade", price: 35, duration: 30 });
    expect(cleanService({ name: "Fade", price: -1, duration: 30 })).toBeNull();
    expect(cleanService({ name: "Fade", price: 35, duration: 2 })).toBeNull();
    expect(cleanService({ name: "", price: 35, duration: 30 })).toBeNull();
  });

  it("only offered accents are accepted", () => {
    expect(cleanAccent("#D4AF7A")).toBe("#D4AF7A");
    expect(cleanAccent("#00F5A0")).toBeNull();
  });
});
