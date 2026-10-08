import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type TokenKind = "session" | "link";

export const SESSION_TTL_DAYS = 365;
export const LINK_TTL_DAYS = 7;

export type SessionRow = {
  id: string;
  user_id: string;
  phone_number: string;
  kind: TokenKind;
  verified: boolean;
  display_name: string | null;
  expires_at: string;
};

// 24 random bytes → 32 url-safe chars: short enough for an SMS link.
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function looksLikeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);
}

export function isUsable(row: SessionRow | null, barberId: string, now = new Date()): row is SessionRow {
  return !!row && row.user_id === barberId && new Date(row.expires_at).getTime() > now.getTime();
}

export function greeting(firstName: string | null | undefined): string {
  const name = firstName?.trim();
  return name ? `Hey ${name}! Ready for your next cut?` : "Welcome back! Ready for your next cut?";
}

export async function issueToken(
  db: Admin,
  opts: { userId: string; phone: string; kind: TokenKind; verified: boolean; displayName?: string | null }
): Promise<string | null> {
  const token = generateToken();
  const days = opts.kind === "link" ? LINK_TTL_DAYS : SESSION_TTL_DAYS;
  const { error } = await db.from("client_sessions").insert({
    user_id: opts.userId,
    phone_number: opts.phone,
    token_hash: hashToken(token),
    kind: opts.kind,
    verified: opts.verified,
    display_name: opts.displayName?.trim() || null,
    expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error("Client session issue error:", error);
    return null;
  }
  return token;
}

/** The live token row for this barber, or null if missing, expired, or another barber's. */
export async function findToken(db: Admin, barberId: string, token: unknown): Promise<SessionRow | null> {
  if (!looksLikeToken(token)) return null;
  const { data } = await db
    .from("client_sessions")
    .select("id, user_id, phone_number, kind, verified, display_name, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  const row = data as SessionRow | null;
  return isUsable(row, barberId) ? row : null;
}

export async function touchToken(db: Admin, id: string) {
  await db.from("client_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}

export async function revokeToken(db: Admin, barberId: string, token: unknown) {
  if (!looksLikeToken(token)) return;
  await db.from("client_sessions").delete().eq("user_id", barberId).eq("token_hash", hashToken(token));
}
