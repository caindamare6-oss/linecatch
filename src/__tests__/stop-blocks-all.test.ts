import { describe, it, expect } from "vitest";
import { isOptedOut } from "../lib/opt-out";

function fakeDb(tables: Record<string, Record<string, string | null>[]>) {
  return {
    from(table: string) {
      const filters: [string, string][] = [];
      const q = {
        select: () => q,
        eq: (col: string, val: string) => {
          filters.push([col, val]);
          return q;
        },
        maybeSingle: async () => ({
          data: (tables[table] || []).find((r) => filters.every(([c, v]) => r[c] === v)) || null,
        }),
      };
      return q;
    },
  };
}

const USER = "barber-1";
const PHONE = "+15551234567";

describe("STOP blocks every client text", () => {
  it("opted_out_at on vip_clients blocks", async () => {
    const db = fakeDb({ vip_clients: [{ user_id: USER, phone_number: PHONE, opted_out_at: "2026-09-01" }] });
    expect(await isOptedOut(db, USER, PHONE)).toBe(true);
  });

  it("row in opt_outs blocks even without vip_clients row", async () => {
    const db = fakeDb({ opt_outs: [{ user_id: USER, caller_phone: PHONE }] });
    expect(await isOptedOut(db, USER, PHONE)).toBe(true);
  });

  it("active client is not blocked", async () => {
    const db = fakeDb({ vip_clients: [{ user_id: USER, phone_number: PHONE, opted_out_at: null }] });
    expect(await isOptedOut(db, USER, PHONE)).toBe(false);
  });

  it("opt-out is scoped to that barber only", async () => {
    const db = fakeDb({ opt_outs: [{ user_id: "other-barber", caller_phone: PHONE }] });
    expect(await isOptedOut(db, USER, PHONE)).toBe(false);
  });
});
