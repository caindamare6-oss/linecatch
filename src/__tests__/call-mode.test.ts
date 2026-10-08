import { describe, it, expect } from "vitest";
import { forwardingCode, carrierFromName, isCarrier, forwardedCallLine, numberChangedLine, isCallMode } from "@/lib/call-mode";
import { areaCode } from "@/lib/phone-numbers";

describe("forwarded calls", () => {
  it("one code per carrier: 10-second ring, Decline and no signal all forward on T-Mobile/AT&T", () => {
    const tmo = { on: "**004*18575052551**10#", plain: "**004*18575052551#", off: "##004#" };
    expect(forwardingCode("tmobile", "+18575052551")).toEqual(tmo);
    expect(forwardingCode("att", "(857) 505-2551")).toEqual(tmo);
    expect(forwardingCode("verizon", "+18575052551")).toEqual({ on: "*718575052551", off: "*73" });
    expect(forwardingCode("other", "+18575052551")).toBeNull();
    expect(forwardingCode(null, "+18575052551")).toBeNull();
  });

  it("carrier from Twilio's carrier name, prepaid brands on their network", () => {
    expect(carrierFromName("T-Mobile USA, Inc.")).toBe("tmobile");
    expect(carrierFromName("Metro by T-Mobile")).toBe("tmobile");
    expect(carrierFromName("AT&T Wireless")).toBe("att");
    expect(carrierFromName("Cricket Wireless - ATT - SVR")).toBe("att");
    expect(carrierFromName("Cellco Partnership dba Verizon Wireless")).toBe("verizon");
    expect(carrierFromName("Visible")).toBe("verizon");
    expect(carrierFromName("Google (Grand Central) BWI - Bandwidth.com - SVR")).toBe("other");
    expect(carrierFromName(null)).toBe("other");
    expect(isCarrier("tmobile")).toBe(true);
    expect(isCarrier("sprint")).toBe(false);
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
