import { createAdminClient } from "@/lib/supabase/admin";
import { missedCallTemplate, withShopName } from "@/lib/missed-call-text";

export { CONSENT_TEXT } from "./consent";

export async function resolveTemplate(
  userId: string,
  templateKey: string,
  language: string = "en"
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: custom } = await supabase
    .from("message_templates")
    .select("custom_message, custom_message_es, custom_message_pt")
    .eq("user_id", userId)
    .eq("template_key", templateKey)
    .single();

  if (custom) {
    const msg = pickLanguage(custom, language);
    if (msg) return msg;
  }

  const { data: fallback } = await supabase
    .from("message_templates")
    .select("custom_message, custom_message_es, custom_message_pt")
    .is("user_id", null)
    .eq("template_key", templateKey)
    .single();

  if (fallback) {
    return pickLanguage(fallback, language) || fallback.custom_message;
  }

  return null;
}

function pickLanguage(
  row: { custom_message: string; custom_message_es: string | null; custom_message_pt: string | null },
  lang: string
): string | null {
  if (lang === "es" && row.custom_message_es) return row.custom_message_es;
  if (lang === "pt" && row.custom_message_pt) return row.custom_message_pt;
  return row.custom_message;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  // A placeholder with no value must never reach a client as literal "{reward}".
  return result.replace(/\{[a-z_]+\}/g, "");
}

const BARBER_FACING_TEMPLATES = new Set([
  "morning_summary",
  "morning_late_broadcast",
  "weekly_report",
  "completion_nudge",
  "barber_cancel_notify",
  "barber_reschedule_notify",
  "barber_booking_notify",
]);

const WEEKDAYS_ES: Record<string, string> = { Monday: "lunes", Tuesday: "martes", Wednesday: "miércoles", Thursday: "jueves", Friday: "viernes", Saturday: "sábado", Sunday: "domingo" };

/**
 * Callers format dates in English ("Friday"); a Spanish text needs "viernes". Weekday names and the
 * "your barber" fallback are swapped here so every template gets them in the client's language.
 */
function spanishVars(vars: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (/date$/.test(k)) out[k] = v.replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g, (d) => WEEKDAYS_ES[d]);
    else if (k === "shop_name" && v === "your barber") out[k] = "tu barbero";
    else out[k] = v;
  }
  return out;
}

export async function buildSMS(opts: {
  userId: string;
  templateKey: string;
  clientPhone: string;
  vars: Record<string, string>;
}): Promise<{ body: string; language: string } | null> {
  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("vip_clients")
    .select("client_language, first_name")
    .eq("user_id", opts.userId)
    .eq("phone_number", opts.clientPhone)
    .maybeSingle();

  const { data: barberProfile } = await supabase
    .from("users")
    .select("first_name, business_name, barber_language, custom_message, missed_call_style, winback_offer")
    .eq("user_id", opts.userId)
    .single();

  const isBarberFacing = BARBER_FACING_TEMPLATES.has(opts.templateKey);
  const isMissedCall = opts.templateKey === "missed_call";
  // A first-time caller's language isn't known yet: write to them in the barber's.
  const language = isBarberFacing || (isMissedCall && !client?.client_language)
    ? (barberProfile?.barber_language || "en")
    : (client?.client_language || "en");

  const firstName = client?.first_name || "";
  const barberName = barberProfile?.first_name || "";

  // Missed-call text: the style the barber picked in Settings (Casual unless they changed it).
  // Casual and Professional wording comes from Admin → Texts, with the built-in copy as backup.
  let template: string | null;
  if (isMissedCall) {
    const style = barberProfile?.missed_call_style;
    const own = style === "custom" && barberProfile?.custom_message?.includes("{link}");
    const preset = own ? null : await resolveTemplate(opts.userId, `missed_call_${style === "professional" ? "professional" : "casual"}`, language);
    template = preset?.includes("{link}") ? preset : missedCallTemplate(style, barberProfile?.custom_message, language);
  } else {
    template = await resolveTemplate(opts.userId, opts.templateKey, language);
  }
  if (!template) return null;

  const allVars: Record<string, string> = {
    ...(language === "es" ? spanishVars(opts.vars) : opts.vars),
    first_name: firstName,
    barber_name: barberName,
    offer: barberProfile?.winback_offer || "",
  };
  let body = interpolateTemplate(template, allVars);
  // The caller sees right away whose shop is texting them.
  if (isMissedCall) body = withShopName(body, barberProfile?.business_name || barberProfile?.first_name);

  return { body, language };
}

export async function markFirstMessageSent(userId: string, clientPhone: string) {
  const supabase = createAdminClient();
  await supabase
    .from("vip_clients")
    .update({ first_message_sent_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("phone_number", clientPhone)
    .is("first_message_sent_at", null);
}
