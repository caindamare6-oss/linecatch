/** Shown under the Book button: booking is agreeing to these texts (no checkbox). */
export const CONSENT_TEXT =
  "By booking, you agree to get texts from this shop about your appointments (confirmations and reminders) and occasional updates. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

export const CONSENT_TEXT_ES =
  "Al reservar, aceptas recibir mensajes de esta barbería sobre tus citas (confirmaciones y recordatorios) y novedades ocasionales. La frecuencia varía. Pueden aplicarse tarifas de mensajes y datos. Responde STOP para cancelar o HELP para ayuda.";

/** The consent wording shown in a given language. */
export function consentText(locale: string | null | undefined): string {
  return locale === "es" ? CONSENT_TEXT_ES : CONSENT_TEXT;
}

export const OPT_IN_SOURCES = ["qr", "booking_form", "vip_form", "barber_added"] as const;
export type OptInSource = (typeof OPT_IN_SOURCES)[number];

export function toOptInSource(value: unknown, fallback: OptInSource): OptInSource {
  return OPT_IN_SOURCES.includes(value as OptInSource) ? (value as OptInSource) : fallback;
}
