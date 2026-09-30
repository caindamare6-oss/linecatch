export const CONSENT_TEXT =
  "By checking this box, I agree to receive text messages from this barber about my appointments, including booking confirmations, reminders, follow-ups, review requests, and occasional offers. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out of all messages or HELP for help.";

export const OPT_IN_SOURCES = ["qr", "booking_form", "vip_form", "barber_added"] as const;
export type OptInSource = (typeof OPT_IN_SOURCES)[number];

export function toOptInSource(value: unknown, fallback: OptInSource): OptInSource {
  return OPT_IN_SOURCES.includes(value as OptInSource) ? (value as OptInSource) : fallback;
}
