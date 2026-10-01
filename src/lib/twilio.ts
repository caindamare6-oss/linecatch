import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOptedOut } from "@/lib/opt-out";

let client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return client;
}

export function isTwilioEnabled(): boolean {
  return process.env.TWILIO_ENABLED !== "false";
}

const OPT_OUT = "\nReply STOP to opt out.";

// ponytail: per-recipient cap stops SMS pumping and runaway loops to one number.
// Rotating-number abuse is handled by the Vercel firewall rate limit on public routes.
const MAX_CLIENT_SMS_PER_HOUR = 10;

function withOptOut(body: string, audience: "client" | "barber"): string {
  if (audience === "barber") return body;
  return /\bSTOP\b/i.test(body) ? body : body + OPT_OUT;
}

export async function sendSMS(opts: {
  to: string;
  from: string;
  body: string;
  userId: string;
  templateKey: string;
  language: string;
  audience?: "client" | "barber";
}): Promise<boolean> {
  const { to, from, userId, templateKey, language, audience = "client" } = opts;
  const body = withOptOut(opts.body, audience);
  const admin = createAdminClient();
  const isDevMode = process.env.SMS_DEV_MODE === "true";

  if (audience === "client" && (await isOptedOut(admin as unknown as Parameters<typeof isOptedOut>[0], userId, to))) {
    console.log(`[SMS Blocked] ${to} opted out, template ${templateKey} not sent`);
    return false;
  }

  if (audience === "client") {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("sms_log")
      .select("id", { count: "exact", head: true })
      .eq("to_number", to)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_CLIENT_SMS_PER_HOUR) {
      console.warn(`[SMS Capped] ${to} hit ${MAX_CLIENT_SMS_PER_HOUR}/hour, template ${templateKey} not sent`);
      return false;
    }
  }

  const { data: row } = await admin
    .from("sms_log")
    .insert({
      user_id: userId,
      to_number: to,
      template_key: templateKey,
      language,
      body,
      status: isDevMode ? "dev" : "pending",
    })
    .select("id")
    .single();

  const logId = row?.id;

  if (isDevMode) {
    console.log(`[SMS Dev] To: ${to} Template: ${templateKey} Body: ${body}`);
    return true;
  }

  if (!isTwilioEnabled()) {
    console.log(`[SMS Mock] To: ${to} From: ${from} Body: ${body}`);
    if (logId) {
      await admin.from("sms_log").update({ status: "dev" }).eq("id", logId);
    }
    return true;
  }

  try {
    const twilioClient = getTwilioClient();
    const message = await twilioClient.messages.create({ to, from, body });
    if (logId) {
      await admin
        .from("sms_log")
        .update({
          status: "sent",
          twilio_sid: message.sid,
          sent_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`SMS send failed to ${to}:`, errorMsg);
    if (logId) {
      await admin
        .from("sms_log")
        .update({ status: "failed", error: errorMsg })
        .eq("id", logId);
    }
    return false;
  }
}

export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );
}
