import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLocale, fromAcceptLanguage, translate, intlLocale, type Locale } from "@/lib/i18n-shared";

/** Current language on the server: saved cookie, else the browser's. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(saved) ? saved : fromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT() {
  const locale = await getLocale();
  return { locale, tag: intlLocale(locale), t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}
