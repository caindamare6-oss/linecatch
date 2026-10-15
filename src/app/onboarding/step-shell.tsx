"use client";

import { useT } from "@/lib/i18n";

export const obCard = { backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" };

/**
 * How far along setup is on each screen (1–5). Making the account already counts for 20%, so nobody
 * starts at zero; the last screen is 90% and tapping Done finishes it.
 */
const PERCENT = [20, 40, 60, 80, 90];
export const stepPercent = (step: number) => PERCENT[Math.min(Math.max(step, 1), PERCENT.length) - 1];

/** "40% done" with a bar under it, at the top of every setup screen. */
export function SetupProgress({ step }: { step: number }) {
  const t = useT();
  const pct = stepPercent(step);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--ob-accent)" }}>{t("ob.percent", { pct })}</p>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("ob.percent", { pct })} className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--ob-surface)" }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: "var(--ob-accent)" }} />
      </div>
    </div>
  );
}

/** One setup screen: how far along they are, a title, the body, and Back / Continue pinned at the bottom. */
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
            <SetupProgress step={step} />
            <h2 className="mt-4 text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{title}</h2>
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
