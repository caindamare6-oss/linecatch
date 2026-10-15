"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLocale, useSetLocale } from "@/lib/i18n";
import { applyAppTheme } from "@/lib/themes";

const tabs = [
  {
    label: "nav.home",
    href: "/dashboard",
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  },
  {
    label: "nav.messages",
    href: "/dashboard/messages",
    icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  },
  {
    label: "nav.schedule",
    href: "/dashboard/schedule",
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  },
  {
    label: "nav.clients",
    href: "/dashboard/clients",
    icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("users").select("theme, accent_color, barber_language").eq("user_id", user.id).single();
      // The barber's portfolio colors are their app's colors too.
      if (!cancelled && data) applyAppTheme(data.theme, data.accent_color);
      // The language saved on the account follows the barber to any device.
      if (!cancelled && (data?.barber_language === "en" || data?.barber_language === "es") && data.barber_language !== locale) {
        setLocale(data.barber_language);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  const activeTab = tabs.find((x) => (x.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(x.href)));

  return (
    // App shell: the page scrolls inside <main>, and the tab bar is the last row of a full-height
    // column. Nothing is position:fixed, so iPhone home-screen apps can't leave it floating mid-screen.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--app-bg)] text-white">
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="relative max-w-md mx-auto px-5 pt-[max(20px,env(safe-area-inset-top))] pb-6">{children}</div>
      </main>

      <nav aria-label={t("nav.main")} className="shrink-0 px-4 pt-2 pb-[max(12px,calc(env(safe-area-inset-bottom)+6px))]">
        {/* Raised off the screen edge with big tap targets, clear of the home swipe line. */}
        <ul className="max-w-md mx-auto grid grid-cols-4 rounded-[22px] border border-white/[0.08] bg-[var(--app-card)]/95 backdrop-blur-md p-1.5">
          {tabs.map((tab) => {
            const active = activeTab?.href === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[16px] text-[11px] transition-colors active:scale-[0.97] ${
                    active ? "bg-[var(--accent-color)]/[0.12] text-[var(--accent-color)] font-semibold" : "text-white/45 hover:text-white/75"
                  }`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {tab.icon}
                  </svg>
                  {t(tab.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
