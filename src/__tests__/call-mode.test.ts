import { describe, it, expect } from "vitest";
import { forwardingCodes, forwardedCallLine, numberChangedLine, isCallMode } from "@/lib/call-mode";
import { areaCode } from "@/lib/phone-numbers";

describe("forwarded calls", () => {
  it("carrier codes use the 10-digit LineCatch number", () => {
    const c = forwardingCodes("+18575052551");
    expect(c.verizon).toEqual({ on: "*718575052551", off: "*73" });
    expect(c.attTmobile).toEqual({ on: "**61*18575052551#", off: "##61#" });
  });

  it("the caller hears one short line in the barber's language", () => {
    expect(forwardedCallLine("en", "texted")).toBe("We're going to send you a booking link.");
    expect(forwardedCallLine("es", "texted")).toBe("Te vamos a enviar un enlace para reservar.");
    expect(forwardedCallLine("en", "already")).toBe("We already sent you a booking link.");
    // No text goes out (opted out, texting off): nothing is said, the call just ends.
    expect(forwardedCallLine("en", "none")).toBeNull();
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
