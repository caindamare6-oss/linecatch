import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOptedOut } from "@/lib/opt-out";
import { shortenLinks } from "@/lib/short-link";

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

const OPT_OUT: Record<string, string> = {
  en: "\nReply STOP to opt out.",
  es: "\nResponde STOP para no recibir más mensajes.",
};

// ponytail: per-recipient cap stops SMS pumping and runaway loops to one number.
// Rotating-number abuse is handled by the Vercel firewall rate limit on public routes.
const MAX_CLIENT_SMS_PER_HOUR = 10;

/** Marketing texts always carry the opt-out line; service texts only on the first text to a client. */
export const isMarketingTemplate = (key: string) =>
  key === "broadcast" || key === "review_request" || key === "cadence_nudge" || key.startsWith("winback_");

export function withOptOut(body: string, opts: { audience: "client" | "barber"; language: string; templateKey: string; firstText: boolean }): string {
  if (opts.audience === "barber" || /\bSTOP\b/i.test(body)) return body;
  if (!opts.firstText && !isMarketingTemplate(opts.templateKey)) return body;
  return body + (OPT_OUT[opts.language] || OPT_OUT.en);
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

  let firstText = false;
  if (audience === "client") {
    const { count } = await admin
      .from("sms_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("to_number", to)
      .eq("direction", "outbound")
      .neq("status", "failed");
    firstText = (count ?? 0) === 0;
  }
  const body = await shortenLinks(admin, withOptOut(opts.body, { audience, language, templateKey, firstText }));

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
    // The system opts a number out on its own when texting it can never work:
    // 21610 carrier-level STOP, 21614 landline / can't receive SMS, 21211 invalid number.
    const code = (err as { code?: number })?.code;
    const reason = code === 21610 ? "carrier_stop" : code === 21614 ? "not_mobile" : code === 21211 ? "invalid_number" : null;
    if (reason && audience === "client") {
      await admin.from("opt_outs").upsert({ user_id: userId, caller_phone: to, opted_out_at: new Date().toISOString(), reason }, { onConflict: "user_id,caller_phone" });
      await admin.from("vip_clients").update({ opted_out_at: new Date().toISOString() }).eq("user_id", userId).eq("phone_number", to).is("opted_out_at", null);
    }
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
