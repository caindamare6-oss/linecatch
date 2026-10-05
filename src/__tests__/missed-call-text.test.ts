import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { missedCallTemplate, withShopName, isMissedCallStyle, MISSED_CALL_PRESETS } from "@/lib/missed-call-text";

describe("missed-call text styles", () => {
  it("Casual is the default", () => {
    expect(missedCallTemplate(null, null, "en")).toBe(MISSED_CALL_PRESETS.casual.en);
    expect(missedCallTemplate("casual", "Old text {link}", "en")).toBe(MISSED_CALL_PRESETS.casual.en);
  });

  it("Professional, in the caller's language", () => {
    expect(missedCallTemplate("professional", null, "en")).toMatch(/^Thank you for calling/);
    expect(missedCallTemplate("professional", null, "es")).toMatch(/^Gracias por llamar/);
  });

  it("every preset carries the link", () => {
    for (const p of Object.values(MISSED_CALL_PRESETS)) {
      expect(p.en).toContain("{link}");
      expect(p.es).toContain("{link}");
    }
  });

  it("the barber's own words, but only if they carry the link", () => {
    expect(missedCallTemplate("custom", "Yo, book here {link}", "en")).toBe("Yo, book here {link}");
    expect(missedCallTemplate("custom", "Reply YES or NO", "en")).toBe(MISSED_CALL_PRESETS.casual.en);
  });

  it("only three styles exist", () => {
    expect(isMissedCallStyle("custom")).toBe(true);
    expect(isMissedCallStyle("short")).toBe(false);
  });

  it("starts with the shop name, once", () => {
    expect(withShopName("Hey! Book: x", "Fade Kings")).toBe("Fade Kings: Hey! Book: x");
    expect(withShopName("Thanks for calling Fade Kings. Book: x", "fade kings")).toBe("Thanks for calling Fade Kings. Book: x");
    expect(withShopName("Hey! Book: x", "  ")).toBe("Hey! Book: x");
    expect(withShopName("Hey! Book: x", null)).toBe("Hey! Book: x");
  });
});

describe("short links", () => {
  const rows: { code: string; target: string }[] = [];
  let failNext: string | null = null;
  const db = {
    from: () => ({
      insert: async (row: { code: string; target: string }) => {
        if (failNext) {
          const code = failNext;
          failNext = null;
          return { error: { code } };
        }
        rows.push(row);
        return { error: null };
      },
    }),
  };

  it("swaps long app links for short ones and keeps the rest", async () => {
    const { shortenLinks, isShortCode } = await import("@/lib/short-link");
    const long = "https://www.linecatch.app/api/track/7e3392cb-27e2-457f-8caa-0fe07351e4a1?t=DHf1pD8Ell5GUFeuu9FlY7jd-LBwb8b9f";
    const out = await shortenLinks(db as never, `Shop: Book here: ${long}\nReply STOP to opt out.`);
    const m = out.match(/www\.linecatch\.app\/c\/(\S+)/);
    expect(m).not.toBeNull();
    expect(isShortCode(m![1])).toBe(true);
    expect(out).toContain("Reply STOP to opt out.");
    expect(out).not.toContain("api/track");
    expect(rows.at(-1)!.target).toBe(long.slice("https://www.linecatch.app".length));
  });

  it("leaves short and outside links alone, and drops trailing punctuation", async () => {
    const { shortenLinks } = await import("@/lib/short-link");
    const before = rows.length;
    expect(await shortenLinks(db as never, "Book: https://www.linecatch.app/fade")).toBe("Book: https://www.linecatch.app/fade");
    expect(await shortenLinks(db as never, "Book: https://booksy.com/en-us/123456789/some-very-long-barber-link")).toContain("booksy.com");
    const out = await shortenLinks(db as never, "Move it: https://www.linecatch.app/manage/6657b184-7c74-40a0-afc7-636d2cec6125.");
    expect(out).toMatch(/\/c\/\S{8}\.$/);
    expect(rows.length).toBe(before + 1);
  });

  it("retries on a code clash; keeps the long link if the table is unusable", async () => {
    const { shortenLinks } = await import("@/lib/short-link");
    const long = "https://www.linecatch.app/manage/6657b184-7c74-40a0-afc7-636d2cec6125";
    failNext = "23505";
    expect(await shortenLinks(db as never, long)).toMatch(/\/c\//);
    failNext = "42P01";
    expect(await shortenLinks(db as never, long)).toBe(long);
  });
});
