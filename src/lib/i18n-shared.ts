import en from "@/locales/en.json";
import es from "@/locales/es.json";

/** Language plumbing usable on both server and client. */

export type Locale = "en" | "es";
export const LOCALES: Locale[] = ["en", "es"];
export const LANG_COOKIE = "lc_lang";

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "es";

const bundles: Record<Locale, unknown> = { en, es };

/** "home.greeting" → string, with {vars}. Falls back to English, then to the key itself. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const lookup = (root: unknown) => key.split(".").reduce<unknown>((node, p) => (node && typeof node === "object" ? (node as Record<string, unknown>)[p] : undefined), root);
  let s = lookup(bundles[locale]);
  if (typeof s !== "string") s = lookup(bundles.en);
  if (typeof s !== "string") return translateError(locale, key);
  return vars ? (s as string).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : (s as string);
}

/** BCP-47 tag for dates and numbers. */
export const intlLocale = (l: Locale) => (l === "es" ? "es-US" : "en-US");

/** Pick from an Accept-Language header when no choice was saved. */
export function fromAcceptLanguage(header: string | null): Locale {
  return header && /^\s*es\b/i.test(header.split(",")[0] || "") ? "es" : "en";
}

/**
 * API routes answer with plain English error sentences. Passing one through t() shows it in the
 * current language: exact matches come from the "errors" table, a few messages with names in them
 * from the patterns below, and anything unknown is shown as-is.
 */
const ERROR_PATTERNS: { re: RegExp; es: string }[] = [
  { re: /^Check the price and minutes for "(.+)"$/, es: 'Revisa el precio y los minutos de "$1"' },
  { re: /^Check the hours for (\w+)$/, es: "Revisa el horario del $1" },
  { re: /^(\w+) closes before it opens$/, es: "El $1 cierra antes de abrir" },
];

const DAYS_ES: Record<string, string> = { Monday: "lunes", Tuesday: "martes", Wednesday: "miércoles", Thursday: "jueves", Friday: "viernes", Saturday: "sábado", Sunday: "domingo" };

export function translateError(locale: Locale, msg: string): string {
  if (locale === "en") return msg;
  const table = (bundles[locale] as { errors?: Record<string, string> }).errors;
  if (table?.[msg]) return table[msg];
  for (const p of ERROR_PATTERNS) if (p.re.test(msg)) return msg.replace(p.re, p.es).replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g, (d) => DAYS_ES[d]);
  return msg;
}
