/** One place for values that would otherwise be hardcoded across the app. */

export const APP_NAME = "LineCatch";

/** Public URL of the app, without a trailing slash. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://linecatch.app").replace(/\/+$/, "");
}

/** Where barbers and clients reach LineCatch (HELP replies, legal pages, Settings). */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@linecatch.app";

/** Used only when a barber hasn't set their own timezone yet. */
export const DEFAULT_TZ = "America/New_York";

/** Optional QR sticker add-on for the chair or mirror. */
export const STICKER_PRICE_CENTS = Number(process.env.NEXT_PUBLIC_STICKER_PRICE_CENTS || 700);

/** Loyalty reward shown to clients (the loyalty engine uses REWARD_CENTS from loyalty-rules). */
export { REWARD_CENTS as REWARD_LABEL_CENTS } from "@/lib/loyalty-rules";

/** Referral rewards. */
export const REFERRER_FREE_MONTHS = 1;
export const REFERRED_PERCENT_OFF = 50;

export function money(cents: number, locale: "en" | "es" = "en"): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}
