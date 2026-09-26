import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function sendSMS(opts: {
  to: string;
  from: string;
  body: string;
  userId: string;
  templateKey: string;
  language: string;
}): Promise<boolean> {
  const { to, from, body, userId, templateKey, language } = opts;
  const admin = createAdminClient();
  const isDevMode = process.env.SMS_DEV_MODE === "true";

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
