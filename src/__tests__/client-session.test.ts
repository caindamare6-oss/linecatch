import { describe, it, expect } from "vitest";
import { generateToken, hashToken, looksLikeToken, isUsable, greeting, type SessionRow } from "@/lib/client-session";

const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: "s1",
  user_id: "barber-a",
  phone_number: "+16175550199",
  kind: "session",
  verified: true,
  display_name: "Alex",
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  ...over,
});

describe("client session tokens", () => {
  it("are 32 url-safe chars and unique", () => {
    const a = generateToken();
    const b = generateToken();
    expect(looksLikeToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("are stored hashed, never raw", () => {
    const t = generateToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it("rejects malformed tokens before hitting the database", () => {
    for (const bad of [undefined, null, "", "short", "x".repeat(33), "a".repeat(31) + "!", 42]) {
      expect(looksLikeToken(bad)).toBe(false);
    }
  });

  it("only works for the barber it was issued for", () => {
    expect(isUsable(row(), "barber-a")).toBe(true);
    expect(isUsable(row(), "barber-b")).toBe(false);
  });

  it("stops working once expired", () => {
    expect(isUsable(row({ expires_at: new Date(Date.now() - 1).toISOString() }), "barber-a")).toBe(false);
    expect(isUsable(null, "barber-a")).toBe(false);
  });
});

describe("returning-client greeting", () => {
  it("greets by first name", () => {
    expect(greeting("Alex")).toBe("Hey Alex! Ready for your next cut?");
    expect(greeting("  Alex ")).toBe("Hey Alex! Ready for your next cut?");
  });

  it("falls back when no name is on file", () => {
    expect(greeting(null)).toBe("Welcome back! Ready for your next cut?");
    expect(greeting(" ")).toBe("Welcome back! Ready for your next cut?");
  });
});
