"use client";

import { useT } from "@/lib/i18n";

export const TOTAL_STEPS = 5;
export const obCard = { backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" };

/** One setup screen: "Step n of 4", a title, the body, and Back / Continue pinned at the bottom. */
export default function StepShell({
  step,
  title,
  subtitle,
  children,
  error,
  saving,
  onBack,
  onNext,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  error?: string;
  saving?: boolean;
  onBack?: () => void;
  onNext: () => void;
}) {
  const t = useT();
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: "var(--ob-bg)", fontFamily: "var(--ob-font-body)" }}>
      <main className="flex-1 overflow-y-auto px-4">
        <div className="max-w-md mx-auto pt-[max(24px,env(safe-area-inset-top))] pb-8 space-y-5" style={{ animation: "ob-fade-up 400ms ease-out" }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ob-accent)" }}>
              {t("ob.step", { n: step, total: TOTAL_STEPS })}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{title}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--ob-text-muted)" }}>{subtitle}</p>
          </div>
          {children}
          {error && (
            <p role="alert" className="text-sm rounded-xl px-3.5 py-3" style={{ backgroundColor: "color-mix(in srgb, var(--ob-danger) 10%, transparent)", color: "var(--ob-danger)" }}>
              {error}
            </p>
          )}
        </div>
      </main>

      <footer className="flex-none border-t" style={{ backgroundColor: "var(--ob-bg)", borderColor: "var(--ob-border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-md mx-auto px-4 py-3 flex gap-3">
          {onBack && (
            <button onClick={onBack} disabled={saving} className="flex-none px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-50" style={{ color: "var(--ob-text-secondary)", ...obCard }}>
              {t("ob.back")}
            </button>
          )}
          <button onClick={onNext} disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: "var(--ob-accent)" }}>
            {saving ? t("common.saving") : t("ob.continue")}
          </button>
        </div>
      </footer>
    </div>
  );
}
