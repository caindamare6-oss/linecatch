import { describe, it, expect } from "vitest";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import { translate, translateError, fromAcceptLanguage } from "@/lib/i18n-shared";
import { normalizeCode, makeCode } from "@/lib/referrals";
import { money } from "@/lib/config";
import { consentText, recordedConsentText, CONSENT_TEXT, CONSENT_TEXT_ES } from "@/lib/consent";

function keys(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("locales", () => {
  it("every English string has a Spanish version", () => {
    const esKeys = new Set(keys(es));
    const missing = keys(en).filter((k) => !esKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("Spanish keeps the same {placeholders} as English", () => {
    // The VIP headline is two lines and Spanish puts the name on the other line.
    const split = new Set(["vip.title_1", "vip.title_2"]);
    const broken = keys(en).filter((k) => {
      if (split.has(k)) return false;
      const e = translate("en", k).match(/\{\w+\}/g)?.sort().join() ?? "";
      const s = translate("es", k).match(/\{\w+\}/g)?.sort().join() ?? "";
      return e !== s;
    });
    expect(broken).toEqual([]);
  });

  it("fills variables and falls back to English, then the key", () => {
    expect(translate("es", "clients.total", { n: 4 })).toBe("4 en total");
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });

  it("API error sentences show in Spanish", () => {
    expect(translate("es", "Couldn't save. Try again.")).toBe("No se pudo guardar. Inténtalo de nuevo.");
    expect(translateError("es", "Friday closes before it opens")).toBe("El viernes cierra antes de abrir");
    expect(translateError("en", "Couldn't save. Try again.")).toBe("Couldn't save. Try again.");
  });

  it("picks Spanish from the browser language", () => {
    expect(fromAcceptLanguage("es-MX,es;q=0.9")).toBe("es");
    expect(fromAcceptLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("en");
    expect(fromAcceptLanguage(null)).toBe("en");
  });

  it("money and consent follow the language", () => {
    expect(money(500, "en")).toBe("$5");
    expect(money(750, "en")).toBe("$7.50");
    expect(consentText("es")).toBe(CONSENT_TEXT_ES);
    expect(recordedConsentText("anything the client sent", "es")).toBe(CONSENT_TEXT_ES);
    expect(recordedConsentText(CONSENT_TEXT, "es")).toBe(CONSENT_TEXT);
  });
});

describe("referral codes", () => {
  it("normalizes what people type", () => {
    expect(normalizeCode(" fresh-c851 ")).toBe("FRESHC851");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("X".repeat(13))).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });

  it("builds readable codes from the shop name", () => {
    expect(makeCode("Fresh Cuts", () => 0.851)).toBe("FRESHC851");
    expect(makeCode("Peluquería Ñandú", () => 0.007)).toBe("PELUQU007");
    expect(makeCode("", () => 0.5)).toBe("LC500");
  });
});
