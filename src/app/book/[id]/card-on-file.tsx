"use client";

import { useEffect, useMemo } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useT } from "@/lib/i18n";

/** Saves the card from Stripe's form. Resolves with the SetupIntent id, or an error to show. */
export type CardSaver = (clientSecret: string) => Promise<{ setupIntentId: string } | { error: string }>;

const cache = new Map<string, Promise<Stripe | null>>();
function stripeFor(account: string) {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!cache.has(account)) cache.set(account, loadStripe(key, { stripeAccount: account }));
  return cache.get(account)!;
}

/**
 * No-show protection on the booking page. The card goes straight to Stripe (on the barber's own
 * account); LineCatch never sees the number. Nothing is charged until the cut is done.
 */
export function CardOnFile({ account, feePercent, onSaver }: { account: string; feePercent: number; onSaver: (saver: CardSaver | null) => void }) {
  const t = useT();
  const stripe = useMemo(() => stripeFor(account), [account]);
  if (!stripe) return <p className="text-xs text-[var(--app-danger)]">{t("pay.card_unavailable")}</p>;
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-[18px]">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40">{t("pay.card_title")}</p>
      <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{t("pay.card_note", { percent: feePercent })}</p>
      <div className="mt-3 rounded-xl px-4 py-3.5 border-[1.5px] border-white/[0.08] bg-white/[0.04]">
        <Elements stripe={stripe}>
          <CardField onSaver={onSaver} />
        </Elements>
      </div>
      <p className="text-[11px] text-white/30 mt-2">{t("pay.card_secure")}</p>
    </div>
  );
}

function CardField({ onSaver }: { onSaver: (saver: CardSaver | null) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useT();

  useEffect(() => {
    if (!stripe || !elements) return;
    onSaver(async (clientSecret) => {
      const card = elements.getElement(CardElement);
      if (!card) return { error: t("pay.card_unavailable") };
      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
      if (error || !setupIntent || setupIntent.status !== "succeeded") return { error: error?.message || t("pay.card_failed") };
      return { setupIntentId: setupIntent.id };
    });
    return () => onSaver(null);
  }, [stripe, elements, onSaver, t]);

  // Stripe's field lives in its own frame, so it gets plain colors read from the app theme.
  const fg = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--app-fg").trim() || "#F2EEE6" : "#F2EEE6";
  return (
    <CardElement
      options={{
        hidePostalCode: false,
        style: { base: { color: fg, fontSize: "16px", "::placeholder": { color: "rgba(150,140,128,0.7)" } }, invalid: { color: "#E5484D" } },
      }}
    />
  );
}
