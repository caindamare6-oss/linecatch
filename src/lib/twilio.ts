import twilio from "twilio";

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

export async function sendSMS(to: string, from: string, body: string): Promise<boolean> {
  if (!isTwilioEnabled()) {
    console.log(`[SMS Mock] To: ${to} From: ${from} Body: ${body}`);
    return true;
  }
  const twilioClient = getTwilioClient();
  await twilioClient.messages.create({ to, from, body });
  return true;
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
