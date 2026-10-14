"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useT } from "@/lib/i18n";
import { GoldButton, GhostButton } from "../ui";

/**
 * Settings → Payments → Add debit card. The number goes straight to Stripe (LineCatch only gets a
 * token); the card becomes where their payouts and instant cash-outs land.
 */
export function DebitCardForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const stripe = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);
  if (!stripe) return <p className="text-[12px] text-[var(--app-danger)]">{t("payments.unavailable")}</p>;
  return (
    <Elements stripe={stripe}>
      <Form onDone={onDone} onCancel={onCancel} />
    </Elements>
  );
}

function Form({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fg = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--app-fg").trim() || "#F2EEE6" : "#F2EEE6";

  async function save() {
    const card = elements?.getElement(CardElement);
    if (!stripe || !card) return;
    setBusy(true);
    setErr("");
    // currency usd: the token can be used as a payout destination.
    const { token, error } = await stripe.createToken(card, { currency: "usd" });
    if (error || !token) {
      setErr(error?.message || t("payouts.err_card"));
      setBusy(false);
      return;
    }
    const res = await fetch("/api/connect/debit-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.id }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(t(body.error || "payouts.err_card"));
    onDone();
  }

  return (
    <div className="mt-3">
      <div className="rounded-xl px-4 py-3.5 border border-white/[0.1] bg-white/[0.04]">
        <CardElement options={{ style: { base: { color: fg, fontSize: "16px", "::placeholder": { color: "rgba(150,140,128,0.7)" } }, invalid: { color: "#E5484D" } } }} />
      </div>
      <p className="text-[11px] text-white/35 mt-2 leading-snug">{t("payouts.debit_note")}</p>
      {err && <p className="text-[12px] text-[var(--app-danger)] mt-1.5" role="alert">{err}</p>}
      <div className="mt-3 flex gap-2">
        <GoldButton disabled={busy} onClick={save}>{busy ? t("payouts.saving") : t("payouts.save_card")}</GoldButton>
        <GhostButton disabled={busy} onClick={onCancel}>{t("common.cancel")}</GhostButton>
      </div>
    </div>
  );
}
