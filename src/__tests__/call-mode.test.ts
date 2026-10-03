import { describe, it, expect } from "vitest";
import { forwardingCodes, forwardedCallLine, numberChangedLine, isCallMode } from "@/lib/call-mode";
import { areaCode } from "@/lib/phone-numbers";

describe("forwarded calls", () => {
  it("carrier codes use the 10-digit LineCatch number", () => {
    const c = forwardingCodes("+18575052551");
    expect(c.verizon).toEqual({ on: "*718575052551", off: "*73" });
    expect(c.attTmobile).toEqual({ on: "**61*8575052551#", off: "##61#" });
  });

  it("the caller hears one short line in the barber's language", () => {
    expect(forwardedCallLine("en", "texted")).toBe("Sorry we missed you. We'll text you a link to book.");
    expect(forwardedCallLine("es", "texted")).toMatch(/Te enviamos un mensaje de texto/);
    expect(forwardedCallLine("en", "already")).toBe("Sorry we missed you. We already texted you a link to book.");
    // No promise of a text when none goes out (opted out, texting off).
    expect(forwardedCallLine("en", "none")).not.toMatch(/text/i);
    expect(numberChangedLine("es")).toMatch(/ya no pertenece/);
  });

  it("only two modes exist", () => {
    expect(isCallMode("forwarded")).toBe(true);
    expect(isCallMode("direct")).toBe(true);
    expect(isCallMode("loop")).toBe(false);
  });
});

describe("phone numbers", () => {
  it("area code from a US number", () => {
    expect(areaCode("+16175550101")).toBe("617");
    expect(areaCode("(857) 505-2551")).toBe("857");
    expect(areaCode("123")).toBeNull();
    expect(areaCode(null)).toBeNull();
  });
});
