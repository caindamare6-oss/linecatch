import { describe, it, expect, vi, beforeEach } from "vitest";

// Stripe calls are recorded, never sent.
const stripe = {
  prices: { list: vi.fn(async () => ({ data: [{ id: "price_solo" }] })) },
  customers: {
    create: vi.fn(async () => ({ id: "cus_new" })),
    createBalanceTransaction: vi.fn(async () => ({ id: "cbtxn_1" })),
  },
  coupons: { retrieve: vi.fn(async (id: string) => ({ id })), create: vi.fn() },
  checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.com/x" })) } },
};
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => stripe }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

type Row = Record<string, unknown>;

/** A tiny in-memory stand-in for the Supabase client: just the calls the referral code makes. */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const matches = () => rows.filter((r) => filters.every((f) => f(r)));
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
      ilike: (c: string, v: string) => (filters.push((r) => String(r[c] ?? "").toLowerCase() === v.toLowerCase()), q),
      update: (p: Row) => ((patch = p), q),
      insert: async (r: Row | Row[]) => (rows.push(...(Array.isArray(r) ? r : [r])), { error: null }),
      upsert: async (r: Row) => {
        if (rows.some((x) => x.referred_user_id === r.referred_user_id)) return { error: null };
        rows.push({ id: `ref_${rows.length + 1}`, status: "signed_up", ...r });
        return { error: null };
      },
      maybeSingle: async () => ({ data: matches()[0] ?? null }),
      single: async () => ({ data: matches()[0] ?? null }),
      then: (resolve: (v: unknown) => void) => {
        if (patch) matches().forEach((r) => Object.assign(r, patch));
        resolve({ data: matches(), error: null });
      },
    };
    return q;
  };
  return { from } as never;
}

const REFERRER = { user_id: "u_ref", referral_code: "FRESH851", business_name: "Fresh Cuts", stripe_customer_id: "cus_ref" };

beforeEach(() => vi.clearAllMocks());

describe("applying a referral code", () => {
  it("links a new barber to whoever sent them", async () => {
    const { applyReferral } = await import("@/lib/referrals");
    const tables = { users: [REFERRER, { user_id: "u_new" }], referrals: [] as Row[] };
    const r = await applyReferral(fakeDb(tables), "u_new", "fresh851");
    expect(r).toEqual({ ok: true, referrerName: "Fresh Cuts" });
    expect(tables.referrals[0]).toMatchObject({ referrer_user_id: "u_ref", referred_user_id: "u_new", status: "signed_up" });
    expect(tables.users[1].referred_by).toBe("u_ref");
  });

  it("refuses their own code, unknown codes, and barbers who already pay", async () => {
    const { applyReferral } = await import("@/lib/referrals");
    const db = fakeDb({ users: [REFERRER, { user_id: "u_paid", stripe_subscription_id: "sub_1" }], referrals: [] });
    expect(await applyReferral(db, "u_ref", "FRESH851")).toEqual({ ok: false, error: "own_code" });
    expect(await applyReferral(db, "u_paid", "NOPE1234")).toEqual({ ok: false, error: "not_found" });
    expect(await applyReferral(db, "u_paid", "FRESH851")).toEqual({ ok: false, error: "too_late" });
  });
});

describe("checkout for a referred barber", () => {
  it("takes 50% off their first month on Stripe's page", async () => {
    const { checkoutUrl } = await import("@/lib/stripe-billing");
    const db = fakeDb({
      users: [{ user_id: "u_new", stripe_customer_id: "cus_new", trial_ends_at: null }],
      referrals: [{ id: "ref_1", referred_user_id: "u_new", referrer_user_id: "u_ref", status: "signed_up" }],
    });
    await checkoutUrl(db, "u_new");
    const args = stripe.checkout.sessions.create.mock.calls[0][0] as Row;
    expect(args.discounts).toEqual([{ coupon: "lc-referral-50" }]);
  });

  it("has no discount for a barber nobody referred", async () => {
    const { checkoutUrl } = await import("@/lib/stripe-billing");
    const db = fakeDb({ users: [{ user_id: "u_solo", stripe_customer_id: "cus_solo", trial_ends_at: null }], referrals: [] });
    await checkoutUrl(db, "u_solo");
    const args = stripe.checkout.sessions.create.mock.calls[0][0] as Row;
    expect(args.discounts).toBeUndefined();
  });
});

describe("rewarding the barber who referred", () => {
  it("credits them half a month ($24.50) once the new barber pays, only once", async () => {
    const { rewardReferral } = await import("@/lib/stripe-billing");
    const tables = {
      users: [REFERRER, { user_id: "u_new" }],
      referrals: [{ id: "ref_1", referred_user_id: "u_new", referrer_user_id: "u_ref", status: "signed_up" }] as Row[],
      activity_feed: [] as Row[],
    };
    const db = fakeDb(tables);
    expect(await rewardReferral(db, "u_new")).toBe("ref_1");
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledWith(
      "cus_ref",
      expect.objectContaining({ amount: -2450, currency: "usd" }),
      { idempotencyKey: "referral-reward-ref_1" }
    );
    expect(tables.referrals[0].status).toBe("qualified");
    expect(tables.activity_feed[0]).toMatchObject({ user_id: "u_ref", event_type: "referral_qualified" });

    // A second payment (or a Stripe retry) doesn't credit again.
    expect(await rewardReferral(db, "u_new")).toBeNull();
    expect(stripe.customers.createBalanceTransaction).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a barber nobody referred", async () => {
    const { rewardReferral } = await import("@/lib/stripe-billing");
    expect(await rewardReferral(fakeDb({ referrals: [] }), "u_solo")).toBeNull();
    expect(stripe.customers.createBalanceTransaction).not.toHaveBeenCalled();
  });
});
