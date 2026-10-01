import { describe, it, expect } from "vitest";
import { slugify, checkSlug, RESERVED_SLUGS } from "@/lib/slug";
import { getTheme, THEMES, THEME_IDS, isAccent } from "@/lib/themes";
import { pickLang, PORTFOLIO_COPY } from "@/lib/portfolio-copy";

describe("slugs", () => {
  it("makes a shop name URL-safe", () => {
    expect(slugify("Damare's Cuts")).toBe("damare-s-cuts");
    expect(slugify("  Shepard barbers ")).toBe("shepard-barbers");
    expect(slugify("Peluquería José")).toBe("peluqueria-jose");
  });
  it("falls back when the name is too short or empty", () => {
    expect(slugify("")).toBe("barber");
    expect(slugify("JD")).toBe("barber");
  });
  it("rejects bad formats and reserved app paths", () => {
    expect(checkSlug("ok-name")).toBeNull();
    expect(checkSlug("-bad")).toBe("format");
    expect(checkSlug("ab")).toBe("format");
    expect(checkSlug("Has Caps")).toBe("format");
    for (const r of ["book", "dashboard", "api", "login", "vip", "s"]) {
      expect(RESERVED_SLUGS.has(r)).toBe(true);
    }
    expect(checkSlug("book")).toBe("reserved");
    expect(checkSlug("dashboard")).toBe("reserved");
  });
});

describe("themes", () => {
  it("includes the cream & brass light theme", () => {
    expect(THEMES.cream.dark).toBe(false);
    expect(THEMES.cream.bg).toBe("#F6F1E7");
    expect(THEMES.cream.accent).toBe("#A8762A");
  });
  it("defaults to the LineCatch champagne look", () => {
    expect(getTheme(undefined).id).toBe("gold");
    expect(getTheme("nope").id).toBe("gold");
    expect(THEMES.gold.name).toBe("LineCatch Champagne");
    expect(THEMES.gold.accent).toBe("#D4AF7A");
    expect(THEMES.mint.accent).toBe("#00F5A0");
    expect(THEME_IDS).toEqual(["mint", "classic", "gold", "midnight", "cream"]);
  });
  it("only accepts accents from the picker", () => {
    expect(isAccent("#D4AF7A")).toBe(true);
    expect(isAccent("#00F5A0")).toBe(false);
    expect(isAccent("red; background:url(x)")).toBe(false);
  });
});

describe("portfolio language", () => {
  it("honors ?lang first, then the browser language", () => {
    expect(pickLang("es", "en-US")).toBe("es");
    expect(pickLang("en", "es-MX")).toBe("en");
    expect(pickLang(undefined, "es-MX,es;q=0.9")).toBe("es");
    expect(pickLang(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(pickLang(undefined, null)).toBe("en");
  });
  it("has the same keys in English and Spanish", () => {
    expect(Object.keys(PORTFOLIO_COPY.es).sort()).toEqual(Object.keys(PORTFOLIO_COPY.en).sort());
    expect(PORTFOLIO_COPY.es.steps).toHaveLength(PORTFOLIO_COPY.en.steps.length);
    expect(PORTFOLIO_COPY.es.cta).toBe("Continuar a reservar");
  });
});
