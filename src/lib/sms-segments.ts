/**
 * How a text is billed. Standard (GSM-7) texts fit 160 characters in one segment, then 153 per
 * segment. One character outside that set (á, í, ó, ú, ’, emoji…) makes the whole text Unicode:
 * 70 in one segment, then 67. Prices: Twilio console → Messaging → Pricing.
 */
export const TWILIO_PER_SEGMENT = 0.0083; // Twilio's US SMS price, outbound
export const CARRIER_FEE_PER_SEGMENT = 0.003; // A2P 10DLC carrier pass-through fee (varies 0.002–0.005 by carrier)
export const PER_SEGMENT = TWILIO_PER_SEGMENT + CARRIER_FEE_PER_SEGMENT;

const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€"; // count as 2

export function measure(text: string) {
  const chars = [...text];
  const gsm = chars.every((c) => GSM.includes(c) || GSM_EXT.includes(c));
  const units = gsm ? chars.reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0) : chars.length;
  const [single, multi] = gsm ? [160, 153] : [70, 67];
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  const nonGsm = gsm ? [] : [...new Set(chars.filter((c) => !GSM.includes(c) && !GSM_EXT.includes(c)))];
  return { chars: units, gsm, segments, cost: segments * PER_SEGMENT, nonGsm };
}
