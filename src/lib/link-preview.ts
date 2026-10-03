const PREVIEW_AGENTS = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|google-?read-?aloud|curl|wget|python|go-http|okhttp|java\/|headless|scan/i;

/** True when the request is an automatic link preview or scanner, not a person opening the link. */
export function isLinkPreview(request: Request): boolean {
  if (request.method === "HEAD") return true;
  const ua = request.headers.get("user-agent") || "";
  if (!ua) return true;
  if (PREVIEW_AGENTS.test(ua)) return true;
  // Browsers asking for a page send these; preview fetchers usually don't.
  const purpose = request.headers.get("purpose") || request.headers.get("sec-purpose") || "";
  return /prefetch|preview/i.test(purpose);
}
