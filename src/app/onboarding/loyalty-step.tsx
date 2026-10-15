"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { CARD_SIZE, DEFAULT_LOYALTY, REWARD_TYPES, toLoyalty, type Loyalty } from "@/lib/loyalty-rules";
import StepShell, { obCard } from "./step-shell";

/** Setup step 4: the loyalty punch card, on or off, and whether the 10th cut is half off or free. */
export default function LoyaltyStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const t = useT();
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setLoyalty(s ? toLoyalty(s) : DEFAULT_LOYALTY))
      .catch(() => alive && setLoyalty(DEFAULT_LOYALTY));
    return () => { alive = false; };
  }, []);

  async function save() {
    if (!loyalty) return;
    setError("");
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loyalty_enabled: loyalty.enabled, loyalty_reward_type: loyalty.reward }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setError(t("quick.err_generic"));
    onNext();
  }

  return (
    <StepShell step={4} title={t("ob_loyalty.title")} subtitle={t("ob_loyalty.subtitle", { n: CARD_SIZE })} error={error} saving={saving} onBack={onBack} onNext={save}>
      {!loyalty ? (
        <div className="h-40 rounded-xl animate-pulse" style={obCard} />
      ) : (
        <div className="rounded-xl p-4 space-y-4" style={obCard}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--ob-text)" }}>{t("loyalty_settings.toggle")}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--ob-text-muted)" }}>{t(loyalty.enabled ? "ob_loyalty.on" : "ob_loyalty.off")}</p>
            </div>
            <button
              role="switch"
              aria-checked={loyalty.enabled}
              aria-label={t("loyalty_settings.toggle")}
              onClick={() => setLoyalty({ ...loyalty, enabled: !loyalty.enabled })}
              className={`relative w-[46px] h-[26px] rounded-full shrink-0 transition-colors ${loyalty.enabled ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
            >
              <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-[var(--app-fg)] transition-[left] ${loyalty.enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>

          {loyalty.enabled && (
            <div>
              <p className="text-[13px] font-medium mb-2" style={{ color: "var(--ob-text-secondary)" }}>{t("loyalty_settings.amount")}</p>
              <div role="radiogroup" aria-label={t("loyalty_settings.amount")} className="grid grid-cols-2 gap-2">
                {REWARD_TYPES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={loyalty.reward === r}
                    onClick={() => setLoyalty({ ...loyalty, reward: r })}
                    className={`min-h-12 rounded-xl text-[15px] font-semibold transition-colors ${loyalty.reward === r ? "bg-[var(--accent-color)] text-[var(--accent-fg)]" : "bg-white/[0.06] text-white/70"}`}
                  >
                    {t(`loyalty_settings.${r}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}
