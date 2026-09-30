import { describe, it, expect } from "vitest";

function withOptOut(body: string, audience: "client" | "barber"): string {
  if (audience === "barber") return body;
  return /\bSTOP\b/i.test(body) ? body : body + "\nReply STOP to opt out.";
}

describe("STOP footer at send time", () => {
  const template = "Hey Mike, sorry we missed you! Book here: https://link.com";

  it("client message gets STOP footer", () => {
    const msg = withOptOut(template, "client");
    expect(msg).toContain("Reply STOP to opt out.");
  });

  it("barber message does NOT get STOP footer", () => {
    const msg = withOptOut(template, "barber");
    expect(msg).not.toContain("STOP");
  });

  it("message already containing STOP is not doubled", () => {
    const msgWithStop = "Book here: link.com\nReply STOP to opt out.";
    const result = withOptOut(msgWithStop, "client");
    expect(result).toBe(msgWithStop);
  });
});
