import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("first_name, barber_language, custom_message, winback_offer")
    .eq("user_id", opts.userId)
    .single();

  const isBarberFacing = BARBER_FACING_TEMPLATES.has(opts.templateKey);
  const language = isBarberFacing
    ? (barberProfile?.barber_language || "en")
    : (client?.client_language || "en");

  const firstName = client?.first_name || "";
  const barberName = barberProfile?.first_name || "";

  let template: string | null;
  // The barber's own missed-call text wins, but only if it can carry the booking link.
  // (The column's legacy default asks callers to "Reply YES or NO", which nothing handles.)
  if (opts.templateKey === "missed_call" && barberProfile?.custom_message?.includes("{link}")) {
    template = barberProfile.custom_message;
  } else {
    template = await resolveTemplate(opts.userId, opts.templateKey, language);
  }
  if (!template) return null;

  const allVars: Record<string, string> = {
    ...opts.vars,
    first_name: firstName,
    barber_name: barberName,
    offer: barberProfile?.winback_offer || "",
  };
  const body = interpolateTemplate(template, allVars);

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
