"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { DAY_KEYS, type Hours } from "@/lib/validate";
import StepShell, { obCard } from "./step-shell";

/** Setup step 3: which days they work and when. Clients can only book inside these hours. */
export default function HoursStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const t = useT();
  const [hours, setHours] = useState<Hours | null>(null);
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d: { profile?: { business_hours?: Hours | null; timezone?: string } }) => {
        if (!alive) return;
        setHours(d.profile?.business_hours || {});
        setTimezone(d.profile?.timezone || "");
      })
      .catch(() => alive && setHours({}));
    return () => { alive = false; };
  }, []);

  const update = (day: (typeof DAY_KEYS)[number], val: { open: string; close: string } | null) => setHours((h) => ({ ...h, [day]: val }));

  async function save() {
    if (!hours) return;
    if (!DAY_KEYS.some((d) => hours[d])) return setError(t("ob_hours.err_none"));
    setError("");
    setSaving(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "hours", data: { businessHours: hours } }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) return setError(body.error || t("quick.err_generic"));
    onNext();
  }

  const time = "flex-1 min-w-0 h-10 rounded-lg px-2 text-[14px] [color-scheme:dark] focus:outline-none";
  const timeStyle = { backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" };

  return (
    <StepShell step={3} title={t("ob_hours.title")} subtitle={t("ob_hours.subtitle")} error={error} saving={saving} onBack={onBack} onNext={save}>
      {!hours ? (
        <div className="h-72 rounded-xl animate-pulse" style={obCard} />
      ) : (
        <div className="rounded-xl p-3.5" style={obCard}>
          <ul className="space-y-3.5">
            {DAY_KEYS.map((day) => {
              const v = hours[day];
              return (
                // Open days put their times on a second line: side by side they're too narrow on a
                // phone and AM/PM gets cut off.
                <li key={day} className="flex flex-wrap items-center gap-x-2.5 gap-y-2 min-h-10">
                  <button
                    role="switch"
                    aria-checked={!!v}
                    aria-label={t("settings.open_day", { day: t(`days.${day}`) })}
                    onClick={() => update(day, v ? null : { open: "10:00", close: "19:00" })}
                    className={`relative w-[42px] h-[24px] rounded-full shrink-0 transition-colors ${v ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
                  >
                    <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-[var(--app-fg)] transition-[left] ${v ? "left-[21px]" : "left-[3px]"}`} />
                  </button>
                  <span className="w-10 text-[14px] font-semibold" style={{ color: "var(--ob-text)" }}>{t(`days.${day}`)}</span>
                  {v ? (
                    <span className="flex items-center gap-2 basis-full pl-[52px]">
                      <input aria-label={t("settings.day_open", { day: t(`days.${day}`) })} type="time" value={v.open} onChange={(e) => update(day, { ...v, open: e.target.value })} className={time} style={timeStyle} />
                      <span className="text-[12px]" style={{ color: "var(--ob-text-muted)" }}>{t("settings.to")}</span>
                      <input aria-label={t("settings.day_close", { day: t(`days.${day}`) })} type="time" value={v.close} onChange={(e) => update(day, { ...v, close: e.target.value })} className={time} style={timeStyle} />
                    </span>
                  ) : (
                    <span className="text-[14px]" style={{ color: "var(--ob-text-muted)" }}>{t("settings.closed")}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {timezone && <p className="text-[12px] mt-3" style={{ color: "var(--ob-text-muted)" }}>{t("settings.tz_note", { tz: timezone.replace(/_/g, " ") })}</p>}
        </div>
      )}
    </StepShell>
  );
}
