/**
 * How missed calls reach a barber's LineCatch number.
 *
 *   forwarded  Clients call the barber's real shop/cell number. When it isn't answered, the carrier
 *              forwards the call to the LineCatch number, which texts the caller the booking link.
 *   direct     Clients call the LineCatch number itself, which rings the barber's cell first.
 */
export const CALL_MODES = ["forwarded", "direct"] as const;
export type CallMode = (typeof CALL_MODES)[number];
export type CallLang = "en" | "es";

export const isCallMode = (v: unknown): v is CallMode => v === "forwarded" || v === "direct";

/**
 * What the caller hears on a forwarded call before we hang up:
 *   texted   a text with the booking link is going out now
 *   already  they were texted the link before (recently, or once as a first-time caller)
 *   none     no text (they opted out, or texting is off)
 */
export type CallerLine = "texted" | "already" | "none";

export function forwardedCallLine(lang: CallLang, line: CallerLine): string {
  if (lang === "es") {
    if (line === "texted") return "Lo sentimos, no pudimos contestar. Te enviamos un mensaje de texto con un enlace para reservar.";
    if (line === "already") return "Lo sentimos, no pudimos contestar. Ya te enviamos un mensaje de texto con el enlace para reservar.";
    return "Lo sentimos, no pudimos contestar. Por favor intenta más tarde.";
  }
  if (line === "texted") return "Sorry we missed you. We'll text you a link to book.";
  if (line === "already") return "Sorry we missed you. We already texted you a link to book.";
  return "Sorry we missed your call. Please try again later.";
}

/** A number freed from a barber who left, during its 30-day wait before reuse. */
export function numberChangedLine(lang: CallLang): string {
  return lang === "es"
    ? "Este número ya no pertenece a esta barbería. Por favor comunícate con la barbería directamente."
    : "This number is no longer in service for this shop. Please contact the shop directly.";
}

/** Carrier codes for forwarding unanswered calls to the LineCatch number (US). */
export function forwardingCodes(lcNumber: string) {
  const digits = lcNumber.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return {
    verizon: { on: `*71${digits}`, off: "*73" },
    attTmobile: { on: `**61*${digits}#`, off: "##61#" },
  };
}
