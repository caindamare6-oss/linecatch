import { describe, it, expect } from "vitest";
import { isLinkPreview } from "@/lib/link-preview";

const req = (ua: string | null, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new Request("https://www.linecatch.app/api/track/x", { method: init.method || "GET", headers: { ...(ua ? { "user-agent": ua } : {}), ...init.headers } });

describe("link previews don't count as taps", () => {
  it("ignores iMessage, WhatsApp, Android and scanner fetches", () => {
    // iMessage's preview fetcher identifies itself as these crawlers.
    expect(isLinkPreview(req("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0"))).toBe(true);
    expect(isLinkPreview(req("WhatsApp/2.23.20.0 A"))).toBe(true);
    expect(isLinkPreview(req("Mozilla/5.0 (Linux; Android 14) Google-Read-Aloud"))).toBe(true);
    expect(isLinkPreview(req("okhttp/4.9.2"))).toBe(true);
    expect(isLinkPreview(req(null))).toBe(true);
    expect(isLinkPreview(req("Mozilla/5.0 (iPhone)", { method: "HEAD" }))).toBe(true);
    expect(isLinkPreview(req("Mozilla/5.0 (iPhone)", { headers: { purpose: "prefetch" } }))).toBe(true);
  });

  it("counts a person opening the link on a phone", () => {
    expect(isLinkPreview(req("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"))).toBe(false);
    expect(isLinkPreview(req("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"))).toBe(false);
  });
});
