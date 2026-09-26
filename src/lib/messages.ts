import { createAdminClient } from "@/lib/supabase/admin";

const STOP_HELP_LINE_EN = "\nReply STOP to end";
const STOP_HELP_LINE_ES = "\nResponde PARAR para salir";
const STOP_HELP_LINE_PT = "\nResponda SAIR para sair";

export { CONSENT_TEXT } from "./consent";

export function getStopHelpLine(lang: string): string {
  if (lang === "es") return STOP_HELP_LINE_ES;
  if (lang === "pt") return STOP_HELP_LINE_PT;
  return STOP_HELP_LINE_EN;
}

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
  return result;
}

const BARBER_FACING_TEMPLATES = new Set([
  "morning_summary",
  "morning_late_broadcast",
  "weekly_report",
  "completion_nudge",
  "barber_cancel_notify",
  "barber_reschedule_notify",
]);

export async function buildSMS(opts: {
  userId: string;
  templateKey: string;
  clientPhone: string;
  vars: Record<string, string>;
}): Promise<string> {
  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("vip_clients")
    .select("client_language, first_name, first_message_sent_at")
    .eq("user_id", opts.userId)
    .eq("phone_number", opts.clientPhone)
    .maybeSingle();

  const { data: barberProfile } = await supabase
    .from("users")
    .select("first_name, barber_language")
    .eq("user_id", opts.userId)
    .single();

  const isBarberFacing = BARBER_FACING_TEMPLATES.has(opts.templateKey);
  const lang = isBarberFacing
    ? (barberProfile?.barber_language || "en")
    : (client?.client_language || "en");

  const firstName = client?.first_name || "";
  const isFirstMessage = !client?.first_message_sent_at;
  const barberName = barberProfile?.first_name || "";

  const template = await resolveTemplate(opts.userId, opts.templateKey, lang);
  if (!template) return "";

  const allVars = { ...opts.vars, first_name: firstName, barber_name: barberName };
  let msg = interpolateTemplate(template, allVars);

  if (isFirstMessage && !isBarberFacing) {
    msg += getStopHelpLine(lang);
  }

  return msg;
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
