import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Two kinds of texts:
 * - Service: missed-call text, booking confirmations, reminders, reschedule/cancel notices,
 *   loyalty updates, replies. Every barber gets these.
 * - Marketing: broadcasts and Google review requests.
 *   These go out only when the barber turns SMS marketing on.
 * Either way, a text only ever goes to a client who opted in (the checkbox when they book)
 * and hasn't opted out.
 */
export type MarketingState = "off" | "on";

export function marketingState(featureMarketing: boolean | null | undefined): MarketingState {
  return featureMarketing ? "on" : "off";
}

export const MARKETING_BLOCKED = {
  off: { en: "SMS marketing is off. Turn it on in Settings to send this.", es: "El marketing por SMS está apagado. Actívalo en Ajustes para enviar esto." },
} as const;

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
