import { getTwilioClient } from "@/lib/twilio";
import { carrierFromName, type Carrier } from "@/lib/call-mode";

/**
 * Which carrier a barber's cell is on, from Twilio Lookup (about half a cent, once per number).
 * null when it can't be checked (development, no Twilio credentials, lookup failed): the barber
 * then picks it themselves in Settings.
 */
export async function detectCarrier(phone: string): Promise<Carrier | null> {
  if (process.env.SMS_DEV_MODE === "true" || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  try {
    const r = await getTwilioClient().lookups.v2.phoneNumbers(phone).fetch({ fields: "line_type_intelligence" });
    const info = r.lineTypeIntelligence as { carrier_name?: string | null } | null;
    return info?.carrier_name ? carrierFromName(info.carrier_name) : null;
  } catch (err) {
    console.error("Carrier lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
