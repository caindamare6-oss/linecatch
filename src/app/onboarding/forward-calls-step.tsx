"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import ForwardSetup, { type ForwardInfo } from "@/app/dashboard/settings/forward-setup";
import { formatPhone } from "@/lib/clients";
import { type Carrier } from "@/lib/call-mode";

type ForwardState = (ForwardInfo & { numberMissing: string[] }) | null;

/**
 * Last screen of setup: wait for the LineCatch number (assigned right after Finish), then the same
 * call-forwarding setup as Settings. "Set up later" leaves it waiting in Settings → Missed calls.
 */
export default function ForwardCallsStep({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [info, setInfo] = useState<ForwardState>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let alive = true;
    let tries = 0;
    async function check() {
      const r = await fetch("/api/settings").then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (!alive) return;
      if (r) setInfo({ phone_number: r.phone_number, carrier: r.carrier, lastMissedCallAt: r.lastMissedCallAt, numberMissing: r.numberMissing || [] });
      // Stop once the number is here, or when it can't come yet (a step like photos is missing).
      if (r?.phone_number || r?.numberMissing?.length) return;
      if (++tries >= 12) return setGaveUp(true);
      setTimeout(check, 2000);
    }
    check();
    return () => { alive = false; };
  }, []);

  async function onCarrier(c: Carrier): Promise<string | null> {
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrier: c }) });
    if (!res.ok) return (await res.json().catch(() => ({}))).error || "settings.save_error";
    setInfo((prev) => (prev ? { ...prev, carrier: c } : prev));
    return null;
  }

  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  }

  const phone = info?.phone_number;
  const missing = info?.numberMissing || [];
  const waiting = !phone && !missing.length && !gaveUp;
  const card = { backgroundColor: "var(--ob-surface)", border: "1px solid var(--ob-border)" };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ backgroundColor: "var(--ob-bg)", fontFamily: "var(--ob-font-body)" }}>
      <main className="flex-1 overflow-y-auto px-4">
        <div className="max-w-md mx-auto py-8 space-y-5" style={{ animation: "ob-fade-up 400ms ease-out" }}>
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{t("fwd_step.title")}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--ob-text-muted)" }}>{t("fwd_step.subtitle")}</p>
          </div>

          {phone ? (
            <div className="rounded-xl p-4 space-y-4" style={card}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-white/45">{t("forward.your_number")}</p>
                  <p className="text-[20px] font-semibold tracking-[0.3px]" style={{ fontFamily: "var(--ob-font-heading)", color: "var(--ob-text)" }}>{formatPhone(phone)}</p>
                </div>
                <button onClick={() => copy(phone)} className="h-9 px-3 rounded-lg border border-[var(--accent-color)]/35 text-[var(--accent-color)] text-[12px] font-semibold shrink-0">
                  {copied === phone ? t("common.copied") : t("common.copy")}
                </button>
              </div>
              <ForwardSetup s={info!} onCarrier={onCarrier} copy={copy} copied={copied} />
            </div>
          ) : (
            <div className="rounded-xl p-4 space-y-2.5" style={card} aria-live="polite">
              {waiting ? (
                <p className="text-[14px] flex items-center gap-2.5" style={{ color: "var(--ob-text)" }}>
                  <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[var(--accent-color)] animate-spin" aria-hidden />
                  {t("fwd_step.getting_number")}
                </p>
              ) : (
                <>
                  <p className="text-[14px]" style={{ color: "var(--ob-text)" }}>{t("forward.pending_title")}</p>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--ob-text-secondary)" }}>{missing.length ? t("forward.pending_body") : t("fwd_step.slow")}</p>
                  {missing.length > 0 && (
                    <ul className="space-y-1">
                      {missing.map((m) => (
                        <li key={m} className="flex gap-2 text-[13px]" style={{ color: "var(--ob-text-secondary)" }}><span className="text-[var(--accent-color)]" aria-hidden>•</span>{t(`forward.step_${m}`)}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--ob-text-muted)" }}>{t("fwd_step.in_settings")}</p>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="flex-none border-t" style={{ backgroundColor: "var(--ob-bg)", borderColor: "var(--ob-border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="max-w-md mx-auto px-4 py-3 flex gap-3">
          {phone ? (
            <>
              <button onClick={onDone} className="flex-none px-4 py-3 rounded-xl text-sm font-medium" style={{ color: "var(--ob-text-secondary)", ...card }}>
                {t("fwd_step.later")}
              </button>
              <button onClick={onDone} className="flex-1 py-3 rounded-xl text-sm font-semibold text-[var(--accent-fg)] hover:brightness-110" style={{ backgroundColor: "var(--ob-accent)" }}>
                {t("fwd_step.done")}
              </button>
            </>
          ) : (
            <button onClick={onDone} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ color: "var(--ob-text)", ...card }}>
              {t("fwd_step.later")}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
