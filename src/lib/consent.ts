export const CONSENT_TEXT =
  "By checking this box, I agree to receive text messages from this barber about my appointments, including booking confirmations, reminders, follow-ups, review requests, and occasional offers. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out of all messages or HELP for help.";

export const CONSENT_TEXT_ES =
  "Al marcar esta casilla, acepto recibir mensajes de texto de este barbero sobre mis citas, incluyendo confirmaciones, recordatorios, seguimientos, solicitudes de reseñas y ofertas ocasionales. La frecuencia de los mensajes varía. Pueden aplicarse tarifas de mensajes y datos. Responde STOP para dejar de recibir todos los mensajes o HELP para obtener ayuda.";

/** The consent wording shown in a given language. */
export function consentText(locale: string | null | undefined): string {
  return locale === "es" ? CONSENT_TEXT_ES : CONSENT_TEXT;
}

/**
 * What to record as the consent the client agreed to: the exact wording they were shown
 * (only if it is one of ours — never store arbitrary client-sent text), else the version for their language.
 */
export function recordedConsentText(submitted: unknown, locale: string | null | undefined): string {
  return submitted === CONSENT_TEXT || submitted === CONSENT_TEXT_ES ? submitted : consentText(locale);
}

export const OPT_IN_SOURCES = ["qr", "booking_form", "vip_form", "barber_added"] as const;
export type OptInSource = (typeof OPT_IN_SOURCES)[number];

export function toOptInSource(value: unknown, fallback: OptInSource): OptInSource {
  return OPT_IN_SOURCES.includes(value as OptInSource) ? (value as OptInSource) : fallback;
}
