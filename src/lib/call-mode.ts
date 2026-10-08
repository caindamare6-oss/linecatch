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

export const CARRIERS = ["tmobile", "att", "verizon", "other"] as const;
export type Carrier = (typeof CARRIERS)[number];
export const isCarrier = (v: unknown): v is Carrier => CARRIERS.includes(v as Carrier);
export const CARRIER_LABELS: Record<Exclude<Carrier, "other">, string> = { tmobile: "T-Mobile", att: "AT&T", verizon: "Verizon" };

/**
 * The one code a barber dials to send missed calls to their LineCatch number (US).
 *   T-Mobile / AT&T: **004 forwards unanswered (after 10 seconds), declined, and unreachable calls
 *                    in one go. `plain` is the same without the 10-second setting, if a phone rejects it.
 *   Verizon:         *71 covers unanswered and declined calls; Verizon has no ring-time code.
 * Other carriers have no code we can rely on, so they get steps instead (null here).
 */
export function forwardingCode(carrier: Carrier | null | undefined, lcNumber: string): { on: string; off: string; plain?: string } | null {
  const digits = lcNumber.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (carrier === "tmobile" || carrier === "att") return { on: `**004*1${digits}**10#`, plain: `**004*1${digits}#`, off: "##004#" };
  if (carrier === "verizon") return { on: `*71${digits}`, off: "*73" };
  return null;
}

/** Twilio's carrier name for a cell number → whose codes it takes (prepaid brands ride a big network). */
export function carrierFromName(name: string | null | undefined): Carrier {
  const n = (name || "").toLowerCase();
  if (/verizon|cellco|visible|straight talk|total wireless/.test(n)) return "verizon";
  if (/t-mobile|tmobile|metro|sprint|mint/.test(n)) return "tmobile";
  if (/at&t|\batt\b|cricket|cingular/.test(n)) return "att";
  return "other";
}
