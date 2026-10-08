import { normalizePhone } from "@/lib/phone";
import { isAccent } from "@/lib/themes";

export const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Hours = Partial<Record<(typeof DAY_KEYS)[number], { open: string; close: string } | null>>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Business hours: known days only, HH:MM, open before close. Closed days are null. */
export function cleanHours(raw: unknown): { ok: true; value: Hours | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid hours" };
  const out: Hours = {};
  for (const day of DAY_KEYS) {
    const v = (raw as Record<string, unknown>)[day];
    if (!v) {
      out[day] = null;
      continue;
    }
    const { open, close } = v as { open?: unknown; close?: unknown };
    if (typeof open !== "string" || typeof close !== "string" || !HHMM.test(open) || !HHMM.test(close)) {
      return { ok: false, error: `Check the hours for ${day[0].toUpperCase()}${day.slice(1)}` };
    }
    if (open >= close) return { ok: false, error: `${day[0].toUpperCase()}${day.slice(1)} closes before it opens` };
    out[day] = { open, close };
  }
  return { ok: true, value: Object.values(out).some(Boolean) ? out : null };
}

/** Optional phone: "" clears it, anything else must be a real US/CA number. */
export function cleanOptionalPhone(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Invalid phone number" };
  const p = normalizePhone(raw);
  return p.valid ? { ok: true, value: p.e164 } : { ok: false, error: p.error };
}

export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, max);
  return t || null;
}

/** http(s) URL or nothing. */
export function cleanUrl(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Invalid link" };
  const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) throw new Error();
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: "That link doesn't look right" };
  }
}

export const cleanAccent = (raw: unknown) => (isAccent(raw) ? (raw as string) : null);

export function cleanService(raw: unknown): { name: string; price: number; duration: number; description: string | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as { name?: unknown; price?: unknown; duration?: unknown; description?: unknown };
  const name = cleanText(s.name, 60);
  // One short optional line under the name ("Taper with a lineup").
  const description = cleanText(s.description, 80);
  const price = Number(s.price);
  const duration = Number(s.duration);
  if (!name || !Number.isFinite(price) || price < 0 || price > 10000) return null;
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) return null;
  return { name, price: Math.round(price * 100) / 100, duration, description };
}
