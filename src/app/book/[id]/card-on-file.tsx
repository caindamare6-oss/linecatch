"use client";

import { useEffect, useMemo } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
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

/** Stripe's form lives in its own frame, so it gets plain colors read from the app theme. */
function themeColors() {
  if (typeof window === "undefined") return { fg: "#F2EEE6", bg: "#1B1A18", accent: "#D4AF7A" };
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { fg: v("--app-fg", "#F2EEE6"), bg: v("--app-card", "#1B1A18"), accent: v("--accent-color", "#D4AF7A") };
}

/**
 * No-show protection on the booking page. Card, Apple Pay or Google Pay (whichever the phone
 * supports) is saved straight to Stripe on the barber's own account; LineCatch never sees the
 * number. Nothing is charged until the cut is done.
 */
export function CardOnFile({ account, feePercent, onSaver }: { account: string; feePercent: number; onSaver: (saver: CardSaver | null) => void }) {
  const t = useT();
  const stripe = useMemo(() => stripeFor(account), [account]);
  const colors = useMemo(() => themeColors(), []);
  if (!stripe) return <p className="text-xs text-[var(--app-danger)]">{t("pay.card_unavailable")}</p>;
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-[18px]">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40">{t("pay.card_title")}</p>
      <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{t("pay.card_note", { percent: feePercent })}</p>
      <div className="mt-3">
        <Elements
          stripe={stripe}
          options={{
            // Saved for later (charged after the cut), so only reusable methods show: cards and wallets.
            mode: "setup",
            currency: "usd",
            appearance: {
              theme: "night",
              variables: { colorPrimary: colors.accent, colorText: colors.fg, colorBackground: colors.bg, borderRadius: "12px", fontSizeBase: "15px" },
            },
          }}
        >
          <PaymentFields onSaver={onSaver} />
        </Elements>
      </div>
      <p className="text-[11px] text-white/30 mt-2">{t("pay.card_secure")}</p>
    </div>
  );
}

function PaymentFields({ onSaver }: { onSaver: (saver: CardSaver | null) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const t = useT();

  useEffect(() => {
    if (!stripe || !elements) return;
    onSaver(async (clientSecret) => {
      const { error: invalid } = await elements.submit();
      if (invalid) return { error: invalid.message || t("pay.card_failed") };
      const { setupIntent, error } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (error || !setupIntent || setupIntent.status !== "succeeded") return { error: error?.message || t("pay.card_failed") };
      return { setupIntentId: setupIntent.id };
    });
    return () => onSaver(null);
  }, [stripe, elements, onSaver, t]);

  return <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />;
}
