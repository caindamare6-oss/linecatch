import { describe, it, expect } from "vitest";
import { assertTestKey } from "@/lib/stripe";

describe("Stripe test-mode lock", () => {
  it("accepts secret and restricted test keys", () => {
    expect(assertTestKey("sk_test_abc")).toBe("sk_test_abc");
    expect(assertTestKey("rk_test_abc")).toBe("rk_test_abc");
  });

  it("refuses live keys and anything else", () => {
    for (const key of ["sk_live_abc", "rk_live_abc", "pk_test_abc", "whsec_abc", "abc"]) {
      expect(() => assertTestKey(key)).toThrow(/not a Stripe test key/);
    }
  });

  it("refuses a missing key", () => {
    expect(() => assertTestKey(undefined)).toThrow(/not set/);
    expect(() => assertTestKey("")).toThrow(/not set/);
  });
});
