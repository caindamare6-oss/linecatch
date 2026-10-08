"use client";

import { useState } from "react";
import { formatPhone } from "@/lib/clients";
import { useT, useFormat } from "@/lib/i18n";
import { CARRIERS, CARRIER_LABELS, forwardingCode, type Carrier } from "@/lib/call-mode";

/** What ForwardSetup needs: the barber's LineCatch number, their carrier, and the last missed call. */
export type ForwardInfo = { phone_number: string | null; carrier: Carrier | null; lastMissedCallAt: string | null };

// Tap-to-dial needs "#" written as %23.
const dial = (code: string) => `tel:${code.replace(/#/g, "%23")}`;

/** Forwarded mode: the one code for the barber's carrier, or steps when there's no code. */
export default function ForwardSetup({ s, onCarrier, copy, copied }: { s: ForwardInfo; onCarrier: (c: Carrier) => Promise<string | null>; copy: (v: string) => void; copied: string }) {
  const t = useT();
  const fmt = useFormat();
  const [changing, setChanging] = useState(false);
  const [err, setErr] = useState("");
  const lc = s.phone_number!;
  const code = forwardingCode(s.carrier, lc);
  const picking = !s.carrier || changing;

  return (
    <div className="space-y-3">
      {picking ? (
        <div className="space-y-2">
          <p className="text-[13px] text-white/60">{t("forward.which_carrier")}</p>
          <div role="radiogroup" aria-label={t("forward.carrier")} className="flex flex-wrap gap-1.5">
            {CARRIERS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={s.carrier === c}
                onClick={async () => {
                  const e = await onCarrier(c);
                  setErr(e ? t(e) : "");
                  if (!e) setChanging(false);
                }}
                className={`h-8 px-3 rounded-lg text-[12px] ${s.carrier === c ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold" : "bg-white/[0.06] text-white/60"}`}
              >
                {c === "other" ? t("forward.carrier_other") : CARRIER_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-white/60">
          {t("forward.your_carrier")} <span className="text-white/85 font-semibold">{s.carrier === "other" ? t("forward.carrier_other") : CARRIER_LABELS[s.carrier as Exclude<Carrier, "other">]}</span>
          {" · "}
          <button onClick={() => setChanging(true)} className="text-[var(--accent-color)]">{t("forward.change")}</button>
        </p>
      )}

      {code && !picking && (
        <div className="rounded-xl bg-white/[0.03] px-3.5 py-3.5 space-y-3">
          <a href={dial(code.on)} className="flex items-center justify-center h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] text-[14px] font-semibold">{t("forward.turn_on")}</a>
          <p className="text-[12px] text-white/50 leading-relaxed">{t("forward.turn_on_hint")}</p>
          <ul className="space-y-1 text-[12px] text-white/65">
            {(s.carrier === "verizon" ? ["what_unanswered", "what_decline"] : ["what_10s", "what_decline", "what_off"]).map((k) => (
              <li key={k} className="flex gap-2"><span className="text-[var(--accent-color)]" aria-hidden>•</span>{t(`forward.${k}`)}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.06]">
            <span className="text-[11px] text-white/35">{t("forward.code")}</span>
            <span className="font-mono text-[13px] text-white/70">{code.on}</span>
            <button onClick={() => copy(code.on)} className="text-[11px] text-white/45 underline-offset-2 hover:underline">{copied === code.on ? t("common.copied") : t("common.copy")}</button>
          </div>
          {code.plain && (
            <p className="text-[11px] text-white/35 leading-relaxed">
              {t("forward.if_error")} <a href={dial(code.plain)} className="font-mono text-white/60">{code.plain}</a>
            </p>
          )}
          <p className="text-[11px] text-white/35">{t("forward.off")} <a href={dial(code.off)} className="font-mono text-white/60">{code.off}</a></p>
        </div>
      )}

      {s.carrier === "other" && !picking && (
        <div className="rounded-xl bg-white/[0.03] px-3.5 py-3.5 space-y-3 text-[12px] text-white/65 leading-relaxed">
          <p className="text-[13px] text-white/80">{t("forward.other_title", { number: formatPhone(lc) })}</p>
          <div>
            <p className="font-semibold text-white/80">{t("forward.other_android")}</p>
            <p>{t("forward.other_android_steps", { number: formatPhone(lc) })}</p>
          </div>
          <div>
            <p className="font-semibold text-white/80">{t("forward.other_iphone")}</p>
            <p>{t("forward.other_iphone_steps", { number: formatPhone(lc) })}</p>
          </div>
          <p className="text-white/45">{t("forward.other_avoid")}</p>
        </div>
      )}

      {!picking && (
        <p className={`text-[12px] leading-relaxed ${s.lastMissedCallAt ? "text-[#7FC79A]" : "text-white/45"}`}>
          {s.lastMissedCallAt ? `✓ ${t("forward.working", { when: fmt.dateTime(s.lastMissedCallAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) })}` : t("forward.test_it")}
        </p>
      )}
      {err && <p className="text-[12px] text-[#F08A8A]" role="alert">{err}</p>}
    </div>
  );
}
