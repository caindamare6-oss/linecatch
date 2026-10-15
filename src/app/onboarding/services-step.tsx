"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import StepShell, { obCard } from "./step-shell";

type Row = { key: string; id: string | null; name: string; description: string; price: string; duration: string; enabled: boolean };

let nextKey = 0;
const blankRow = (): Row => ({ key: `new-${nextKey++}`, id: null, name: "", description: "", price: "", duration: "30", enabled: true });

/**
 * Setup step 2: the starter services LineCatch made (Lineup, Taper…) with their prices and times,
 * ready to change, switch off, or add to. Clients pick from these on the booking page.
 */
export default function ServicesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d: { services?: { id: string; name: string; description: string | null; price: number | string; duration_minutes: number; is_active: boolean }[] }) => {
        if (!alive) return;
        const list = (d.services || []).map((s) => ({
          key: s.id,
          id: s.id,
          name: s.name,
          description: s.description || "",
          price: String(Number(s.price)),
          duration: String(s.duration_minutes),
          enabled: s.is_active,
        }));
        setRows(list.length ? list : [blankRow()]);
      })
      .catch(() => alive && setRows([blankRow()]));
    return () => { alive = false; };
  }, []);

  const edit = (key: string, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    if (!rows) return;
    // A new row left empty is just skipped.
    const keep = rows.filter((r) => r.id || r.name.trim());
    if (!keep.some((r) => r.enabled)) return setError(t("ob_services.err_none"));
    const bad = keep.find((r) => r.enabled && (!r.name.trim() || r.price === "" || !(Number(r.duration) >= 5)));
    if (bad) return setError(t("ob_services.err_row", { name: bad.name.trim() || t("ob_services.a_service") }));
    setError("");
    setSaving(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "services",
        data: {
          services: keep.map((r, i) => ({ id: r.id, name: r.name, description: r.description, price: Number(r.price), duration: Number(r.duration), enabled: r.enabled, sortOrder: i })),
        },
      }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) return setError(body.error || t("quick.err_generic"));
    // Saved rows now have ids, so Back then Continue updates them instead of adding copies.
    setRows(keep.map((r, i) => ({ ...r, id: body.ids?.[i] ?? r.id })));
    onNext();
  }

  const input = "h-10 rounded-lg px-2.5 text-[14px] focus:outline-none";
  const inputStyle = { backgroundColor: "var(--ob-input-bg)", border: "1px solid var(--ob-border)", color: "var(--ob-text)" };

  return (
    <StepShell step={2} title={t("ob_services.title")} subtitle={t("ob_services.subtitle")} error={error} saving={saving} onBack={onBack} onNext={save}>
      {!rows ? (
        <div className="h-40 rounded-xl animate-pulse" style={obCard} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key} className={`rounded-xl p-3.5 space-y-2.5 transition-opacity ${r.enabled ? "" : "opacity-50"}`} style={obCard}>
              <div className="flex items-center gap-2">
                <input
                  value={r.name}
                  onChange={(e) => edit(r.key, { name: e.target.value })}
                  placeholder={t("services.name_placeholder")}
                  aria-label={t("services.name_placeholder")}
                  maxLength={60}
                  className={`${input} flex-1 min-w-0 font-semibold`}
                  style={inputStyle}
                />
                {r.id ? (
                  <button
                    role="switch"
                    aria-checked={r.enabled}
                    aria-label={t("ob_services.offer", { name: r.name || t("ob_services.a_service") })}
                    onClick={() => edit(r.key, { enabled: !r.enabled })}
                    className={`relative w-[42px] h-[24px] rounded-full shrink-0 transition-colors ${r.enabled ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
                  >
                    <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-[var(--app-fg)] transition-[left] ${r.enabled ? "left-[21px]" : "left-[3px]"}`} />
                  </button>
                ) : (
                  <button
                    onClick={() => setRows((rs) => rs!.filter((x) => x.key !== r.key))}
                    aria-label={t("ob_services.remove")}
                    className="w-9 h-9 flex items-center justify-center rounded-lg shrink-0"
                    style={{ color: "var(--ob-text-muted)" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                value={r.description}
                onChange={(e) => edit(r.key, { description: e.target.value })}
                placeholder={t("services.details_placeholder")}
                aria-label={t("services.details_placeholder")}
                maxLength={80}
                className={`${input} w-full text-[13px]`}
                style={inputStyle}
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  <span className="text-[13px]" style={{ color: "var(--ob-text-muted)" }}>$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={r.price}
                    onChange={(e) => edit(r.key, { price: e.target.value })}
                    aria-label={t("services.price_aria", { name: r.name })}
                    placeholder="0"
                    className={`${input} w-20`}
                    style={inputStyle}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={5}
                    step={5}
                    value={r.duration}
                    onChange={(e) => edit(r.key, { duration: e.target.value })}
                    aria-label={t("services.minutes_aria", { name: r.name })}
                    className={`${input} w-16`}
                    style={inputStyle}
                  />
                  <span className="text-[13px]" style={{ color: "var(--ob-text-muted)" }}>{t("services.min")}</span>
                </label>
              </div>
            </li>
          ))}
          <li>
            <button
              onClick={() => setRows((rs) => [...rs!, blankRow()])}
              className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold border border-dashed"
              style={{ borderColor: "var(--ob-border)", color: "var(--ob-accent)" }}
            >
              <Plus className="w-4 h-4" />
              {t("ob_services.add")}
            </button>
          </li>
        </ul>
      )}
    </StepShell>
  );
}
