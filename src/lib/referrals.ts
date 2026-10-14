import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/config";

type Admin = ReturnType<typeof createAdminClient>;

export const REF_COOKIE = "lc_ref";
export const HEARD_FROM = ["in_person", "barber", "instagram", "tiktok", "google", "youtube", "event", "other"] as const;
export type HeardFrom = (typeof HEARD_FROM)[number];

/** Codes are letters and digits, 4–12 long, case-insensitive. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 4 && c.length <= 12 ? c : null;
}

/** A readable code from the shop or first name: "FRESHC" + 3 digits. */
export function makeCode(name: string | null | undefined, rand: () => number = Math.random): string {
  const base = (name || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
  const prefix = base.length >= 2 ? base : "LC";
  return prefix + String(Math.floor(rand() * 1000)).padStart(3, "0");
}

export const referralLink = (code: string) => `${appUrl()}/join/${code}`;

/** Every barber gets a code the first time it's needed. */
export async function ensureReferralCode(db: Admin, userId: string): Promise<string> {
  const { data: u } = await db.from("users").select("referral_code, business_name, first_name").eq("user_id", userId).single();
  if (u?.referral_code) return u.referral_code;
  for (let i = 0; i < 8; i++) {
    const code = makeCode(u?.business_name || u?.first_name);
    const { error } = await db.from("users").update({ referral_code: code }).eq("user_id", userId).is("referral_code", null);
    if (!error) {
      const { data } = await db.from("users").select("referral_code").eq("user_id", userId).single();
      if (data?.referral_code) return data.referral_code;
    }
  }
  throw new Error("Couldn't create a referral code");
}

export async function findReferrer(db: Admin, code: string) {
  const { data } = await db.from("users").select("user_id, business_name, first_name").ilike("referral_code", code).maybeSingle();
  return data;
}

export type ApplyResult = { ok: true; referrerName: string } | { ok: false; error: "not_found" | "own_code" | "already_referred" | "too_late" };

/** Attach a code to a barber who hasn't paid yet (at sign-up or right before checkout). One per account, never their own. */
export async function applyReferral(db: Admin, referredId: string, rawCode: unknown): Promise<ApplyResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: "not_found" };
  const referrer = await findReferrer(db, code);
  if (!referrer) return { ok: false, error: "not_found" };
  if (referrer.user_id === referredId) return { ok: false, error: "own_code" };

  const { data: me } = await db.from("users").select("stripe_subscription_id, referred_by").eq("user_id", referredId).single();
  if (me?.stripe_subscription_id) return { ok: false, error: "too_late" };
  if (me?.referred_by && me.referred_by !== referrer.user_id) return { ok: false, error: "already_referred" };

  const { error } = await db.from("referrals").upsert(
    { referrer_user_id: referrer.user_id, referred_user_id: referredId, code },
    { onConflict: "referred_user_id", ignoreDuplicates: true }
  );
  if (error) return { ok: false, error: "already_referred" };
  await db.from("users").update({ referred_by: referrer.user_id }).eq("user_id", referredId);
  return { ok: true, referrerName: referrer.business_name || referrer.first_name || "" };
}
