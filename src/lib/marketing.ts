import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Two kinds of texts:
 * - Service: missed-call text, booking confirmations, reminders, reschedule/cancel notices,
 *   loyalty updates, replies. Every barber gets these.
 * - Marketing: Wednesday check-ins and win-backs, broadcasts, Google review requests.
 *   These go out only when the barber turns SMS marketing on.
 * Either way, a text only ever goes to a client who opted in (booking checkbox, VIP page or QR sticker)
 * and hasn't opted out. The QR sticker is optional: it's just another way for clients to opt in.
 */
export type MarketingState = "off" | "on";

export function marketingState(featureMarketing: boolean | null | undefined): MarketingState {
  return featureMarketing ? "on" : "off";
}

export const MARKETING_BLOCKED = {
  off: { en: "SMS marketing is off. Turn it on in Settings to send this.", es: "El marketing por SMS está apagado. Actívalo en Ajustes para enviar esto." },
} as const;

export async function hasActiveSticker(db: Admin, userId: string): Promise<boolean> {
  const { data } = await db.from("sticker_codes").select("code").eq("owner_user_id", userId).eq("status", "active").limit(1).maybeSingle();
  return !!data;
}

export async function getMarketingState(db: Admin, userId: string): Promise<MarketingState> {
  const { data: user } = await db.from("users").select("feature_marketing").eq("user_id", userId).single();
  return marketingState(user?.feature_marketing);
}

/** Barbers (from a list) whose marketing texts may go out right now. */
export async function marketingAllowedIds(db: Admin, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data: users } = await db.from("users").select("user_id").in("user_id", userIds).eq("feature_marketing", true);
  return new Set((users || []).map((u) => u.user_id));
}

export type ShippingAddress = { name: string; line1: string; line2: string | null; city: string; state: string; zip: string };

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" ")
);

/** US shipping address for the QR sticker. */
export function cleanAddress(raw: unknown): { ok: true; value: ShippingAddress } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Add a shipping address for your QR sticker" };
  const a = raw as Record<string, unknown>;
  const t = (k: string, max: number) => (typeof a[k] === "string" ? (a[k] as string).trim().slice(0, max) : "");
  const value = { name: t("name", 60), line1: t("line1", 100), line2: t("line2", 100) || null, city: t("city", 60), state: t("state", 20).toUpperCase(), zip: t("zip", 10) };
  if (!value.name || !value.line1 || !value.city) return { ok: false, error: "Add the name, street and city for shipping" };
  if (!US_STATES.has(value.state)) return { ok: false, error: "Use the 2-letter state code, like MA" };
  if (!/^\d{5}(-\d{4})?$/.test(value.zip)) return { ok: false, error: "Enter a 5-digit ZIP code" };
  return { ok: true, value };
}
