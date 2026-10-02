"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const tabs = [
  {
    label: "Home",
    href: "/dashboard",
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  },
  {
    label: "Schedule",
    href: "/dashboard/schedule",
    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  },
  {
    label: "Clients",
    href: "/dashboard/clients",
    icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("users").select("accent_color").eq("user_id", user.id).single();
      if (!cancelled && data?.accent_color) {
        document.documentElement.style.setProperty("--accent-color", data.accent_color);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTab = tabs.find((t) => (t.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(t.href)));

  return (
    <div className="min-h-screen bg-[#121110] text-white">
      <main className="relative max-w-md mx-auto px-5 pt-5 pb-[calc(96px+env(safe-area-inset-bottom))]">{children}</main>

      <nav
        aria-label="Main"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.06] bg-[#121110]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="max-w-md mx-auto grid grid-cols-4">
          {tabs.map((t) => {
            const active = activeTab?.href === t.href;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] transition-colors ${
                    active ? "text-[var(--accent-color)] font-semibold" : "text-white/35 hover:text-white/70"
                  }`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {t.icon}
                  </svg>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
