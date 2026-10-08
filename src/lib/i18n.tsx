"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, translate, intlLocale, type Locale } from "@/lib/i18n-shared";

export type { Locale } from "@/lib/i18n-shared";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };

const I18nContext = createContext<Ctx>({ locale: "en", setLocale: () => {} });

export function writeLangCookie(l: Locale) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Root provider. `locale` comes from the server (cookie, else browser language) so the first paint
 * is already in the right language. A nested provider can pin a locale (onboarding preview).
 */
export function I18nProvider({ locale: initial, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState<Locale>(initial);
  const setLocale = useCallback(
    (l: Locale) => {
      writeLangCookie(l);
      setState(l);
      document.documentElement.lang = l;
      // Server-rendered text (dashboard numbers, dates) re-renders in the new language.
      router.refresh();
    },
    [router]
  );
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { locale } = useContext(I18nContext);
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useSetLocale() {
  return useContext(I18nContext).setLocale;
}

/** Dates/times in the current language. */
export function useFormat() {
  const locale = useLocale();
  const tag = intlLocale(locale);
  return useMemo(
    () => ({
      tag,
      date: (d: Date | string, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(tag, o),
      time: (d: Date | string, o: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }) => new Date(d).toLocaleTimeString(tag, o),
      dateTime: (d: Date | string, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString(tag, o),
    }),
    [tag]
  );
}

/** EN | ES pill used on client pages, login and settings. */
export function LanguageToggle({ className = "", onChange }: { className?: string; onChange?: (l: Locale) => void }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <div role="group" aria-label="Language / Idioma" className={`inline-flex rounded-full border border-white/[0.12] p-0.5 text-[12px] font-semibold ${className}`}>
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => {
            if (l === locale) return;
            setLocale(l);
            onChange?.(l);
          }}
          className={`h-7 min-w-[40px] px-2.5 rounded-full transition-colors ${locale === l ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : "text-white/55 hover:text-white"}`}
        >
          {l === "en" ? "EN" : "ES"}
        </button>
      ))}
    </div>
  );
}
