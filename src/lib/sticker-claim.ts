import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export const STICKER_COOKIE = "lc_sticker";

export const normalizeSticker = (raw: unknown) => (typeof raw === "string" && /^[A-Za-z0-9]{4,12}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null);

export type ClaimError = "not_found" | "have_one" | "own" | "taken" | "retired" | "failed";

/** An unclaimed sticker someone can still set up with, and the shop it was handed to (if recorded). */
export async function pendingSticker(db: Admin, raw: unknown): Promise<{ code: string; shop: string | null } | null> {
  const code = normalizeSticker(raw);
  if (!code) return null;
  const { data } = await db.from("sticker_codes").select("code, status, handed_to").eq("code", code).maybeSingle();
  return data?.status === "unclaimed" ? { code: data.code, shop: data.handed_to ?? null } : null;
}

/**
 * Attach a sticker to a barber. Atomic: only an unclaimed code can be taken, and a barber holds one
 * active sticker. Claiming turns SMS marketing on (texts still only go to clients who opted in).
 */
export async function claimSticker(db: Admin, userId: string, raw: unknown): Promise<{ ok: true; code: string } | { ok: false; error: ClaimError; existingCode?: string }> {
  const code = normalizeSticker(raw);
  if (!code) return { ok: false, error: "not_found" };

  const { data: existing } = await db.from("sticker_codes").select("code").eq("owner_user_id", userId).eq("status", "active").limit(1).maybeSingle();
  if (existing) return existing.code === code ? { ok: false, error: "own" } : { ok: false, error: "have_one", existingCode: existing.code };

  const { data, error } = await db
    .from("sticker_codes")
    .update({ owner_user_id: userId, status: "active", claimed_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "unclaimed")
    .select("code")
    .single();

  if (error || !data) {
    const { data: check } = await db.from("sticker_codes").select("status, owner_user_id").eq("code", code).maybeSingle();
    if (!check) return { ok: false, error: "not_found" };
    if (check.status === "active") return { ok: false, error: check.owner_user_id === userId ? "own" : "taken" };
    if (check.status === "retired") return { ok: false, error: "retired" };
    return { ok: false, error: "failed" };
  }

  // Placeholder until billing: plan should come from the subscription.
  await db.from("users").update({ is_locked_out: false, plan: "full", feature_marketing: true }).eq("user_id", userId);
  await db.from("activity_feed").insert({
    user_id: userId,
    event_type: "sticker_activated",
    description: `QR sticker ${data.code} connected`,
    metadata: { code: data.code },
  });
  return { ok: true, code: data.code };
}

/**
 * A barber who already has an account signs in from a sticker ("Already have an account?").
 * Setup won't run again, so the sticker connects at sign-in. Accounts still in setup connect it
 * when they finish, as usual.
 */
export async function claimOnSignIn(db: Admin, userId: string, raw: unknown) {
  if (!normalizeSticker(raw)) return null;
  const { data: u } = await db.from("users").select("onboarding_completed").eq("user_id", userId).maybeSingle();
  if (!u?.onboarding_completed) return null;
  return claimSticker(db, userId, raw);
}
