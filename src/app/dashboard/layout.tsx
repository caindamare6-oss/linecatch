"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, X } from "lucide-react";

const SettingsPage = lazy(() => import("./settings/page"));

const tabs = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Messages", href: "/dashboard/messages" },
  { label: "Schedule", href: "/dashboard/schedule" },
  { label: "Services", href: "/dashboard/services" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/dashboard/settings") {
      setSettingsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccent() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("users")
        .select("accent_color")
        .eq("user_id", user.id)
        .single();
      if (!cancelled && data?.accent_color) {
        document.documentElement.style.setProperty("--accent-color", data.accent_color);
      }
    }
    loadAccent();
    return () => { cancelled = true; };
  }, []);

  function closeSettings() {
    setSettingsOpen(false);
    if (pathname === "/dashboard/settings") {
      router.push("/dashboard");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 3%, transparent)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px]" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-color) 2%, transparent)' }} />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--accent-color)]">
              <path d="M3 5.5C3 4.12 4.12 3 5.5 3h3.09c.39 0 .74.24.88.6l1.42 3.55c.15.37.05.8-.25 1.06l-1.72 1.47a12.06 12.06 0 005.69 5.69l1.47-1.72c.26-.3.69-.4 1.06-.25l3.55 1.42c.36.14.6.49.6.88v3.09c0 1.38-1.12 2.5-2.5 2.5C9.83 21.29 2.71 14.17 2.71 5.5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 3c0 0 2 .5 3.5 2S20 9 20 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M14.5 6.5c0 0 1 .3 1.8 1.2.8.8 1.2 1.8 1.2 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-white">Line</span>
              <span className="text-[var(--accent-color)]">Catch</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 border rounded-full px-2.5 py-0.5" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 20%, transparent)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />
              <span className="text-[11px] font-medium" style={{ color: 'color-mix(in srgb, var(--accent-color) 80%, transparent)' }}>Active</span>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={handleSignOut}
              className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-5 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 flex">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 text-center py-2 px-2 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--accent-color)] text-[#0d0d0d]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
                style={isActive ? { boxShadow: '0 0 12px color-mix(in srgb, var(--accent-color) 20%, transparent)' } : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        {pathname === "/dashboard/settings" ? null : children}
      </div>

      {/* Settings Side Panel */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 transition-opacity"
            onClick={closeSettings}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0d0d0d] border-l border-white/[0.06] z-50 overflow-y-auto animate-slide-in">
            <div className="sticky top-0 z-10 bg-[#0d0d0d] border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70">Settings</h2>
              <button
                onClick={closeSettings}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="px-4 py-4">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-16">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 30%, transparent)', borderTopColor: 'var(--accent-color)' }} />
                  </div>
                }
              >
                <SettingsPage />
              </Suspense>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        :root {
          --accent-color: #00F5A0;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
