/** Shown under the Book button: booking is agreeing to appointment texts (no checkbox). */
export const CONSENT_TEXT =
  "By booking, you agree to get texts from this shop about your appointments (confirmations and reminders). Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

export const CONSENT_TEXT_ES =
  "Al reservar, aceptas recibir mensajes de esta barbería sobre tus citas (confirmaciones y recordatorios). La frecuencia varía. Pueden aplicarse tarifas de mensajes y datos. Responde STOP para cancelar o HELP para ayuda.";

/** The optional checkbox: openings and deals (broadcasts). Only clients who tick it get them. */
export const OFFERS_CONSENT_TEXT =
  "Also text me openings and deals from this shop (optional). Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out.";

export const OFFERS_CONSENT_TEXT_ES =
  "También envíame horarios libres y ofertas de esta barbería (opcional). La frecuencia varía. Pueden aplicarse tarifas de mensajes y datos. Responde STOP para cancelar.";

/** The appointment-texts wording shown in a given language. */
export function consentText(locale: string | null | undefined): string {
  return locale === "es" ? CONSENT_TEXT_ES : CONSENT_TEXT;
}

/** The openings-and-deals checkbox wording in a given language. */
export function offersConsentText(locale: string | null | undefined): string {
  return locale === "es" ? OFFERS_CONSENT_TEXT_ES : OFFERS_CONSENT_TEXT;
}

export const OPT_IN_SOURCES = ["qr", "booking_form", "vip_form", "barber_added"] as const;
export type OptInSource = (typeof OPT_IN_SOURCES)[number];

export function toOptInSource(value: unknown, fallback: OptInSource): OptInSource {
  return OPT_IN_SOURCES.includes(value as OptInSource) ? (value as OptInSource) : fallback;
}
