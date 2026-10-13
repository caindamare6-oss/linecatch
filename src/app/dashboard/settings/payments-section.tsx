"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionLabel, Card, GoldButton, GhostButton, Segmented, SERIF } from "../ui";
import { useT, useLocale } from "@/lib/i18n";
import { money } from "@/lib/config";
import { SOLO_PRICE_CENTS } from "@/lib/billing-rules";

type Status = {
  billing: { status: string; banner: "trial" | "add_card" | "past_due" | "paused" | null; daysLeft: number | null; hasCard: boolean };
  connect: {
    started: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    protectionEnabled: boolean;
    feePercent: number;
    balance: { available: number; pending: number; instant: number } | null;
    stripeOk: boolean;
  };
  recent: { booking_id: string; status: string; amount_cents: number | null; reward_cents: number; card_brand: string | null; card_last4: string | null; charged_at: string | null; failure_message: string | null }[];
};

const FEES = ["25", "50", "75", "100"] as const;

/** Opens a Stripe page (checkout, portal, onboarding, Express dashboard) from one of our routes. */
async function go(path: string): Promise<string | null> {
  const res = await fetch(path, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.url) {
    window.location.href = body.url;
    return null;
  }
  return body.error || "payments.unavailable";
}

export function useStripeStatus() {
  const [s, setS] = useState<Status | null>(null);
  const load = useCallback(() => fetch("/api/connect/status").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {}), []);
  useEffect(() => {
    load();
  }, [load]);
  return { s, reload: load };
}

/** Settings → Billing: the barber's own $49/month plan. */
export function BillingSection({ s }: { s: Status | null }) {
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!s) return null;
  const b = s.billing;
  const price = money(SOLO_PRICE_CENTS, locale);

  const line =
    b.status === "active"
      ? t("billing.active", { price })
      : b.status === "past_due"
        ? t("billing.past_due")
        : b.status === "paused" || b.status === "canceled"
          ? t("billing.paused")
          : b.hasCard
            ? t("billing.card_on_file", { n: Math.max(b.daysLeft ?? 0, 0) })
            : (b.daysLeft ?? 0) > 0
              ? t(b.daysLeft === 1 ? "billing.trial_one" : "billing.trial", { n: b.daysLeft ?? 0 })
              : t("billing.trial_over");

  const managed = b.status === "active" || b.status === "past_due" || b.hasCard;
  return (
    <section id="billing">
      <SectionLabel>{t("billing.section")}</SectionLabel>
      <Card className="p-4">
        <p className="text-[14px] text-white/85">{t("billing.plan", { price })}</p>
        <p className={`text-[12px] mt-0.5 leading-snug ${b.status === "past_due" || b.status === "paused" ? "text-[var(--app-danger)]" : "text-white/45"}`}>{line}</p>
        <div className="mt-3">
          {managed ? (
            <GhostButton disabled={busy} onClick={async () => { setBusy(true); setErr(await go("/api/billing/portal") || ""); setBusy(false); }}>
              {t("billing.manage")}
            </GhostButton>
          ) : (
            <GoldButton disabled={busy} onClick={async () => { setBusy(true); setErr(await go("/api/billing/checkout") || ""); setBusy(false); }}>
              {t("billing.add_card")}
            </GoldButton>
          )}
        </div>
        <p className="text-[11px] text-white/35 mt-2.5 leading-snug">{t("billing.note")}</p>
        {err && <p className="text-[12px] text-[var(--app-danger)] mt-1.5" role="alert">{t(err)}</p>}
      </Card>
    </section>
  );
}

/** Settings → Payments: no-show protection, the fee, and getting paid. */
export function PaymentsSection({ s, reload, patch }: { s: Status | null; reload: () => void; patch: (body: Record<string, unknown>) => Promise<string | null> }) {
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [paid, setPaid] = useState("");
  if (!s) return null;
  const c = s.connect;
  const ready = c.chargesEnabled;
  const instant = { amount: c.balance?.instant ?? 0 };

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setErr("");
    const e = await fn();
    if (e) setErr(e);
    setBusy(false);
  };

  return (
    <section id="payments">
      <SectionLabel>{t("payments.section")}</SectionLabel>
      <div className="space-y-2">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-white/85">{t("payments.protection")}</p>
              <p className="text-[12px] text-white/40 mt-0.5 leading-snug">{t("payments.protection_hint")}</p>
            </div>
            {ready && (
              <button
                role="switch"
                aria-checked={c.protectionEnabled}
                aria-label={t("payments.protection")}
                disabled={busy}
                onClick={() => run(async () => { const e = await patch({ protection_enabled: !c.protectionEnabled }); reload(); return e; })}
                className={`relative w-[46px] h-[26px] rounded-full shrink-0 transition-colors disabled:opacity-40 ${c.protectionEnabled ? "bg-[var(--accent-color)]" : "bg-white/[0.14]"}`}
              >
                <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-[var(--app-fg)] shadow transition-[left] duration-200 ${c.protectionEnabled ? "left-[23px]" : "left-[3px]"}`} />
              </button>
            )}
          </div>
          {!ready && (
            <div className="mt-3">
              <GoldButton disabled={busy} onClick={() => run(() => go("/api/connect/onboard"))}>
                {c.started ? t("payments.finish_setup") : t("payments.set_up")}
              </GoldButton>
              <p className="text-[11px] text-white/35 mt-2.5 leading-snug">{t("payments.setup_note")}</p>
            </div>
          )}
        </Card>

        {ready && (
          <Card className="p-4">
            <p className="text-[14px] text-white/85">{t("payments.fee")}</p>
            <p className="text-[12px] text-white/40 mt-0.5 mb-3 leading-snug">{t("payments.fee_hint")}</p>
            <Segmented
              label={t("payments.fee")}
              value={(FEES as readonly string[]).includes(String(c.feePercent)) ? (String(c.feePercent) as (typeof FEES)[number]) : "50"}
              options={FEES.map((f) => ({ value: f, label: `${f}%` }))}
              onChange={(v) => run(async () => { const e = await patch({ no_show_fee_percent: Number(v) }); reload(); return e; })}
            />
          </Card>
        )}

        {ready && c.balance && (
          <Card className="p-4">
            <p className="text-[12px] uppercase tracking-wider text-white/40">{t("payments.balance")}</p>
            <p className={`${SERIF} text-[30px] leading-none font-semibold mt-2`}>{money(c.balance.available + c.balance.pending, locale)}</p>
            <p className="text-[12px] text-white/45 mt-1.5">{t("payments.balance_sub", { available: money(c.balance.instant, locale) })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <GoldButton
                disabled={busy || instant.amount <= 0 || !c.payoutsEnabled}
                onClick={() =>
                  run(async () => {
                    const res = await fetch("/api/connect/cashout", { method: "POST" });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) return body.error || "payments.unavailable";
                    setPaid(t("payments.cashed_out", { amount: money(body.amount, locale) }));
                    reload();
                    return null;
                  })
                }
              >
                {instant.amount > 0 ? t("payments.cash_out", { amount: money(instant.amount, locale) }) : t("payments.cash_out_none")}
              </GoldButton>
            </div>
            <p className="text-[11px] text-white/35 mt-2.5 leading-snug">
              {t("payments.fee_rule")}
            </p>
            {paid && <p className="text-[12px] text-[var(--app-ok)] mt-1.5" role="status">{paid}</p>}
          </Card>
        )}

        {s.recent.length > 0 && (
          <Card className="p-4">
            <p className="text-[12px] uppercase tracking-wider text-white/40 mb-2">{t("payments.recent")}</p>
            <ul className="divide-y divide-white/[0.06]">
              {s.recent.map((r) => (
                <li key={r.booking_id} className="py-2 flex items-center gap-3 text-[13px]">
                  <span className="flex-1 min-w-0 text-white/70 truncate">
                    {t(`payments.kind_${r.status}`)}
                    {r.card_last4 ? ` · ${r.card_brand ?? ""} ${r.card_last4}` : ""}
                    {r.reward_cents > 0 ? ` · ${t("payments.reward_off", { amount: money(r.reward_cents, locale) })}` : ""}
                  </span>
                  <span className={r.status === "failed" ? "text-[var(--app-danger)]" : "text-white/85"}>{money(r.amount_cents ?? 0, locale)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {!c.stripeOk && <p className="text-[12px] text-white/40">{t("payments.stripe_down")}</p>}
        {err && <p className="text-[12px] text-[var(--app-danger)]" role="alert">{t(err)}</p>}
      </div>
    </section>
  );
}
