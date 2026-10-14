import { describe, it, expect } from "vitest";
import { assertStripeKey } from "@/lib/stripe";

describe("Stripe key check", () => {
  it("accepts test keys everywhere", () => {
    expect(assertStripeKey("sk_test_abc", false)).toBe("sk_test_abc");
    expect(assertStripeKey("rk_test_abc", true)).toBe("rk_test_abc");
  });

  it("accepts live keys only on the live site", () => {
    expect(assertStripeKey("sk_live_abc", true)).toBe("sk_live_abc");
    expect(assertStripeKey("rk_live_abc", true)).toBe("rk_live_abc");
    expect(() => assertStripeKey("sk_live_abc", false)).toThrow(/only allowed on the live site/);
  });

  it("refuses anything that isn't a secret key", () => {
    for (const key of ["pk_test_abc", "pk_live_abc", "whsec_abc", "abc"]) {
      expect(() => assertStripeKey(key, true)).toThrow(/not a Stripe secret key/);
    }
  });

  it("refuses a missing key", () => {
    expect(() => assertStripeKey(undefined)).toThrow(/not set/);
    expect(() => assertStripeKey("")).toThrow(/not set/);
  });
});
