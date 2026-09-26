"use client";

import { createContext, useContext, useMemo } from "react";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

type Messages = typeof en;
type Locale = "en" | "es";

const bundles: Record<Locale, Messages> = { en, es };

const I18nContext = createContext<{ locale: Locale; messages: Messages }>({
  locale: "en",
  messages: en,
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, messages: bundles[locale] || en }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { messages } = useContext(I18nContext);

  return function t(key: string, vars?: Record<string, string | number>): string {
    const parts = key.split(".");
    let node: unknown = messages;
    for (const p of parts) {
      if (node && typeof node === "object" && p in node) {
        node = (node as Record<string, unknown>)[p];
      } else {
        return key;
      }
    }
    if (typeof node !== "string") return key;
    if (!vars) return node;
    return node.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
    );
  };
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
