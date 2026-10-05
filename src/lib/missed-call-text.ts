/**
 * The text a caller gets when the barber misses their call. Barbers pick a style in Settings;
 * Casual is the default. The two ready-made styles are written here in both languages, so a caller
 * gets them in their own language. "custom" is the barber's own words (users.custom_message).
 */
export const MISSED_CALL_STYLES = ["casual", "professional", "custom"] as const;
export type MissedCallStyle = (typeof MISSED_CALL_STYLES)[number];
export const isMissedCallStyle = (v: unknown): v is MissedCallStyle => MISSED_CALL_STYLES.includes(v as MissedCallStyle);

export const MISSED_CALL_PRESETS: Record<Exclude<MissedCallStyle, "custom">, { en: string; es: string }> = {
  casual: {
    en: "Hey, sorry I missed you! I'm with a client right now. Grab a spot here: {link}",
    es: "¡Hola, perdón que no pude contestar! Estoy con un cliente ahora. Aparta tu cita aquí: {link}",
  },
  professional: {
    en: "Thank you for calling. I'm with a client and can't answer right now. You can book your appointment here: {link}",
    es: "Gracias por llamar. Estoy con un cliente y no puedo contestar ahora. Puedes reservar tu cita aquí: {link}",
  },
};

/** The template for this barber's style; a custom text without {link} falls back to Casual. */
export function missedCallTemplate(style: string | null | undefined, custom: string | null | undefined, lang: string): string {
  if (style === "custom" && custom?.includes("{link}")) return custom;
  const preset = MISSED_CALL_PRESETS[style === "professional" ? "professional" : "casual"];
  return lang === "es" ? preset.es : preset.en;
}

/** "Fade Kings: Hey, sorry I missed you!…", unless the text already names the shop. */
export function withShopName(body: string, shop: string | null | undefined): string {
  const name = shop?.trim();
  if (!name || body.toLowerCase().includes(name.toLowerCase())) return body;
  return `${name}: ${body}`;
}
