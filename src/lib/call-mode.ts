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
 *   none     no text (they opted out, or texting is off): nothing is said, the call just ends
 */
export type CallerLine = "texted" | "already" | "none";

export function forwardedCallLine(lang: CallLang, line: CallerLine): string | null {
  if (line === "none") return null;
  if (lang === "es") return line === "texted" ? "Te vamos a enviar un enlace para reservar." : "Ya te enviamos un enlace para reservar.";
  return line === "texted" ? "We're going to send you a booking link." : "We already sent you a booking link.";
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
    // T-Mobile and AT&T want the 1 in front of the number.
    attTmobile: { on: `**61*1${digits}#`, off: "##61#" },
  };
}
