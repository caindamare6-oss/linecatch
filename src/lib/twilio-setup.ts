import { getTwilioClient, isTwilioEnabled } from "@/lib/twilio";
import { appUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Where Twilio must send calls and texts for every LineCatch number. */
export function webhookUrls() {
  const base = appUrl();
  return { sms: `${base}/api/twilio/sms`, voice: `${base}/api/twilio/voice` };
}

export type NumberStatus = {
  phone: string;
  sid: string | null;
  owner: string | null; // barber shop or name
  inTwilio: boolean;
  smsOk: boolean;
  voiceOk: boolean;
};

export type TwilioStatus = {
  appUrl: string;
  credentials: boolean;
  devMode: boolean;
  enabled: boolean;
  account: { ok: true; name: string; status: string } | { ok: false; error: string };
  numbers: NumberStatus[];
  unlinked: string[]; // numbers in the Twilio account no barber uses
  barbersWithoutNumber: number;
  problems: string[];
};

type TwilioNumber = { sid: string; phoneNumber: string; smsUrl: string | null; smsMethod: string | null; voiceUrl: string | null; voiceMethod: string | null };

const same = (a: string | null, b: string) => (a || "").replace(/\/+$/, "") === b;

/** Everything that decides whether texts and calls actually go through Twilio, in one report. */
export async function twilioStatus(db: Admin): Promise<TwilioStatus> {
  const urls = webhookUrls();
  const credentials = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  const devMode = process.env.SMS_DEV_MODE === "true";
  const enabled = isTwilioEnabled();
  const problems: string[] = [];

  if (!credentials) problems.push("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN aren't set in Vercel.");
  if (devMode) problems.push("SMS_DEV_MODE is true, so texts are only logged, never sent. Remove it in Vercel.");
  if (!enabled) problems.push("TWILIO_ENABLED is false, so texts are only logged, never sent.");
  if (!process.env.TWILIO_MESSAGING_SERVICE_SID) problems.push("TWILIO_MESSAGING_SERVICE_SID isn't set, so new barber numbers won't join your A2P-registered Messaging Service and their texts may be blocked.");
  if (!process.env.NEXT_PUBLIC_APP_URL) problems.push("NEXT_PUBLIC_APP_URL isn't set; webhooks fall back to https://www.linecatch.app.");

  const { data: barbers } = await db.from("users").select("phone_number, business_name, first_name, onboarding_completed");
  const owners = new Map<string, string>();
  let barbersWithoutNumber = 0;
  for (const b of barbers || []) {
    if (b.phone_number) owners.set(b.phone_number, b.business_name?.trim() || b.first_name?.trim() || "(no name)");
    else if (b.onboarding_completed) barbersWithoutNumber++;
  }
  if (barbersWithoutNumber) problems.push(`${barbersWithoutNumber} set-up barber(s) have no LineCatch number, so their missed calls can't be texted.`);

  let account: TwilioStatus["account"] = { ok: false, error: "No credentials" };
  let twilioNumbers: TwilioNumber[] = [];
  if (credentials) {
    try {
      const client = getTwilioClient();
      const acct = await client.api.v2010.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
      account = { ok: true, name: acct.friendlyName, status: acct.status };
      if (acct.status !== "active") problems.push(`The Twilio account is ${acct.status}, not active.`);
      twilioNumbers = (await client.incomingPhoneNumbers.list({ limit: 1000 })) as unknown as TwilioNumber[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      account = { ok: false, error: msg };
      problems.push(`Twilio rejected the credentials: ${msg}`);
    }
  }

  const byPhone = new Map(twilioNumbers.map((n) => [n.phoneNumber, n]));
  const numbers: NumberStatus[] = [...owners.entries()].map(([phone, owner]) => {
    const n = byPhone.get(phone);
    const smsOk = !!n && same(n.smsUrl, urls.sms) && (n.smsMethod || "POST").toUpperCase() === "POST";
    const voiceOk = !!n && same(n.voiceUrl, urls.voice) && (n.voiceMethod || "POST").toUpperCase() === "POST";
    if (account.ok && !n) problems.push(`${owner}'s number ${phone} isn't in this Twilio account.`);
    else if (n && (!smsOk || !voiceOk)) problems.push(`${owner}'s number ${phone} sends calls or texts to the wrong address.`);
    return { phone, sid: n?.sid ?? null, owner, inTwilio: !!n, smsOk, voiceOk };
  });
  const unlinked = twilioNumbers.map((n) => n.phoneNumber).filter((p) => !owners.has(p));

  return { appUrl: appUrl(), credentials, devMode, enabled, account, numbers, unlinked, barbersWithoutNumber, problems };
}

/** Point every barber's LineCatch number at this app's voice and SMS webhooks. */
export async function fixWebhooks(db: Admin): Promise<{ fixed: string[]; failed: { phone: string; error: string }[] }> {
  const status = await twilioStatus(db);
  if (!status.account.ok) return { fixed: [], failed: [{ phone: "*", error: status.account.error }] };
  const urls = webhookUrls();
  const client = getTwilioClient();
  const fixed: string[] = [];
  const failed: { phone: string; error: string }[] = [];
  for (const n of status.numbers) {
    if (!n.sid || (n.smsOk && n.voiceOk)) continue;
    try {
      await client.incomingPhoneNumbers(n.sid).update({ smsUrl: urls.sms, smsMethod: "POST", voiceUrl: urls.voice, voiceMethod: "POST" });
      fixed.push(n.phone);
    } catch (err) {
      failed.push({ phone: n.phone, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { fixed, failed };
}
