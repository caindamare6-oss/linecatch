import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioClient } from "@/lib/twilio";
import { webhookUrls } from "@/lib/twilio-setup";

type Admin = ReturnType<typeof createAdminClient>;

/** A freed number waits this long before it goes to a new barber, so old clients stop calling it. */
export const REUSE_AFTER_DAYS = 30;

/** What a barber must finish before LineCatch gives them a number. */
export const READY_STEPS = ["setup", "cell", "services", "hours", "portfolio", "photo"] as const;
export type ReadyStep = (typeof READY_STEPS)[number];

export async function missingSteps(db: Admin, userId: string): Promise<ReadyStep[]> {
  const [{ data: u }, { count: services }, { count: photos }] = await Promise.all([
    db.from("users").select("onboarding_completed, forwarding_number, business_hours, cover_url").eq("user_id", userId).maybeSingle(),
    db.from("services").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
    db.from("portfolio_photos").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const hours = (u?.business_hours || {}) as Record<string, unknown>;
  const missing: ReadyStep[] = [];
  if (!u?.onboarding_completed) missing.push("setup");
  if (!u?.forwarding_number) missing.push("cell");
  if (!services) missing.push("services");
  if (!Object.values(hours).some(Boolean)) missing.push("hours");
  if (!photos) missing.push("portfolio");
  if (!u?.cover_url) missing.push("photo");
  return missing;
}

/** Area code of a US number, e.g. "+16175550101" → "617". */
export const areaCode = (phone: string | null | undefined) => {
  const d = (phone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? d.slice(0, 3) : null;
};

/** Buying numbers. Swapped for a fake in development and tests so nothing is ever charged there. */
export type NumberProvider = {
  /** A local US number that can call and text, in this area code if possible. */
  find(areaCode: string | null): Promise<string | null>;
  /** Buy it, point it at this app and add it to the A2P Messaging Service. Returns its Twilio sid. */
  buy(phone: string): Promise<string>;
};

export const twilioNumbers: NumberProvider = {
  async find(code) {
    const client = getTwilioClient();
    const opts = { smsEnabled: true, voiceEnabled: true, limit: 1 };
    const local = code ? await client.availablePhoneNumbers("US").local.list({ ...opts, areaCode: Number(code) }) : [];
    if (local[0]) return local[0].phoneNumber;
    // None left in that area code: any US local number.
    const any = await client.availablePhoneNumbers("US").local.list(opts);
    return any[0]?.phoneNumber ?? null;
  },
  async buy(phone) {
    const client = getTwilioClient();
    const urls = webhookUrls();
    const n = await client.incomingPhoneNumbers.create({ phoneNumber: phone, smsUrl: urls.sms, smsMethod: "POST", voiceUrl: urls.voice, voiceMethod: "POST" });
    const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (service) await client.messaging.v1.services(service).phoneNumbers.create({ phoneNumberSid: n.sid });
    return n.sid;
  },
};

/** Development: hands out fake 555 numbers instead of buying real ones. */
export const fakeNumbers: NumberProvider = {
  async find(code) {
    return `+1${code || "555"}555${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
  },
  async buy() {
    return `PNdev${Math.random().toString(36).slice(2, 12)}`;
  },
};

export function defaultProvider(): NumberProvider | null {
  if (process.env.SMS_DEV_MODE === "true") return fakeNumbers;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilioNumbers;
}

export type AssignResult =
  | { ok: true; phone: string; source: "existing" | "pool" | "bought" }
  | { ok: false; reason: "not_ready"; missing: ReadyStep[] }
  | { ok: false; reason: "no_provider" | "none_available" | "failed"; error?: string };

/**
 * Give a fully set-up barber their LineCatch number: a number from the pool first (one freed at
 * least 30 days ago, same area code preferred), otherwise buy a local one. Safe to call often;
 * it does nothing once the barber has a number.
 */
export async function assignNumber(db: Admin, userId: string, provider: NumberProvider | null = defaultProvider()): Promise<AssignResult> {
  const { data: u } = await db.from("users").select("phone_number, forwarding_number").eq("user_id", userId).maybeSingle();
  if (u?.phone_number) return { ok: true, phone: u.phone_number, source: "existing" };

  const missing = await missingSteps(db, userId);
  if (missing.length) return { ok: false, reason: "not_ready", missing };

  const code = areaCode(u?.forwarding_number);
  const reusableBefore = new Date(Date.now() - REUSE_AFTER_DAYS * 86_400_000).toISOString();

  // 1. Reuse a freed number (never-assigned spares count too).
  const { data: free } = await db
    .from("phone_numbers")
    .select("phone, area_code")
    .is("assigned_user_id", null)
    .or(`released_at.is.null,released_at.lte.${reusableBefore}`)
    .order("released_at", { ascending: true, nullsFirst: true })
    .limit(50);
  const pick = [...(free || [])].sort((a, b) => Number(b.area_code === code) - Number(a.area_code === code));
  for (const n of pick) {
    const { data: claimed } = await db
      .from("phone_numbers")
      .update({ assigned_user_id: userId, assigned_at: new Date().toISOString() })
      .eq("phone", n.phone)
      .is("assigned_user_id", null)
      .select("phone")
      .maybeSingle();
    if (!claimed) continue; // someone else took it a moment ago
    await linkToUser(db, userId, n.phone, "pool");
    return { ok: true, phone: n.phone, source: "pool" };
  }

  // 2. Buy a new one.
  if (!provider) return { ok: false, reason: "no_provider" };
  try {
    const phone = await provider.find(code);
    if (!phone) return { ok: false, reason: "none_available" };
    const sid = await provider.buy(phone);
    const { error: taken } = await db
      .from("phone_numbers")
      .insert({ phone, twilio_sid: sid, area_code: areaCode(phone), assigned_user_id: userId, assigned_at: new Date().toISOString() });
    if (taken) {
      // Another request got this barber a number at the same moment: keep ours as a spare in the pool.
      await db.from("phone_numbers").insert({ phone, twilio_sid: sid, area_code: areaCode(phone) });
      const { data: again } = await db.from("users").select("phone_number").eq("user_id", userId).maybeSingle();
      return again?.phone_number ? { ok: true, phone: again.phone_number, source: "existing" } : { ok: false, reason: "failed", error: taken.message };
    }
    await linkToUser(db, userId, phone, "bought");
    return { ok: true, phone, source: "bought" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`Couldn't get a number for ${userId}:`, error);
    return { ok: false, reason: "failed", error };
  }
}

async function linkToUser(db: Admin, userId: string, phone: string, source: "pool" | "bought") {
  await db.from("users").update({ phone_number: phone }).eq("user_id", userId);
  await db.from("activity_feed").insert({
    user_id: userId,
    event_type: "number_assigned",
    description: `Your LineCatch number is ${phone}`,
    metadata: { phone, source },
  });
}

/** Founder action: take a number back from a barber (left, didn't pay). The number stays ours. */
export async function releaseNumber(db: Admin, userId: string) {
  const { data: u } = await db.from("users").select("phone_number").eq("user_id", userId).maybeSingle();
  if (!u?.phone_number) return { ok: false as const, error: "That barber has no number" };
  const now = new Date().toISOString();
  await db.from("phone_numbers").upsert(
    { phone: u.phone_number, area_code: areaCode(u.phone_number), assigned_user_id: null, released_at: now },
    { onConflict: "phone" }
  );
  await db.from("users").update({ phone_number: null }).eq("user_id", userId);
  return { ok: true as const, phone: u.phone_number };
}

export type PoolRow = { phone: string; areaCode: string | null; owner: string | null; ownerId: string | null; releasedAt: string | null; reusableAt: string | null; waiting: boolean };

/** Founder view of every number we own. */
export async function numberPool(db: Admin): Promise<PoolRow[]> {
  const { data: rows } = await db.from("phone_numbers").select("phone, area_code, assigned_user_id, released_at").order("phone");
  const ids = (rows || []).map((r) => r.assigned_user_id).filter(Boolean) as string[];
  const { data: users } = ids.length ? await db.from("users").select("user_id, business_name, first_name").in("user_id", ids) : { data: [] };
  const names = new Map((users || []).map((u) => [u.user_id, u.business_name?.trim() || u.first_name?.trim() || "(no name)"]));
  return (rows || []).map((r) => ({
    phone: r.phone,
    areaCode: r.area_code,
    owner: r.assigned_user_id ? names.get(r.assigned_user_id) ?? "(unknown)" : null,
    ownerId: r.assigned_user_id,
    releasedAt: r.released_at,
    reusableAt: !r.assigned_user_id && r.released_at ? new Date(new Date(r.released_at).getTime() + REUSE_AFTER_DAYS * 86_400_000).toISOString() : null,
    waiting: !r.assigned_user_id && !!r.released_at && new Date(r.released_at).getTime() + REUSE_AFTER_DAYS * 86_400_000 > Date.now(),
  }));
}

/** After the response goes out, give the barber their number if they just finished the last step. */
export function assignNumberSoon(userId: string) {
  after(async () => {
    const r = await assignNumber(createAdminClient(), userId);
    if (!r.ok && r.reason !== "not_ready") console.error(`Number for ${userId} not assigned: ${r.reason}${"error" in r && r.error ? ` (${r.error})` : ""}`);
  });
}
