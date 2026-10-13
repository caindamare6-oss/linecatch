import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronNow } from "@/lib/cron";
import { sendSMS } from "@/lib/twilio";
import { appUrl, DEFAULT_TZ } from "@/lib/config";
import { billingState, daysSinceTrialEnd, CARD_TEXT_DAYS, type BillingStatus } from "@/lib/billing-rules";

export const maxDuration = 60;

const TEXTS = {
  en: {
    d0: "LineCatch: your free trial is over. Add your card to keep your missed calls getting texted back. Texts keep running 7 more days: {link}",
    d3: "LineCatch: 4 days left to add your card before your texts pause: {link}",
    d6: "LineCatch: your texts pause tomorrow. Add your card to keep your clients: {link}",
  },
  es: {
    d0: "LineCatch: tu prueba gratis terminó. Añade tu tarjeta para que tus llamadas perdidas sigan recibiendo respuesta. Los textos siguen 7 días más: {link}",
    d3: "LineCatch: te quedan 4 días para añadir tu tarjeta antes de que se pausen tus textos: {link}",
    d6: "LineCatch: tus textos se pausan mañana. Añade tu tarjeta para no perder a tus clientes: {link}",
  },
};

/**
 * Hourly (texts go out at 10 AM the barber's time). No card prompts during the trial; once it
 * ends, pay-link texts on that day and 3 and 6 days later, then accounts with no card pause after
 * the 7-day grace (failed payments after theirs). Adding a card turns everything back on (Stripe webhook).
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const now = cronNow(request);

  const { data: barbers } = await db
    .from("users")
    .select("user_id, billing_status, trial_ends_at, billing_grace_until, stripe_subscription_id, billing_texts_sent, is_locked_out, is_active, phone_number, forwarding_number, timezone, barber_language")
    .neq("billing_status", "active")
    .eq("is_active", true);

  let texted = 0;
  let paused = 0;
  for (const b of barbers || []) {
    const state = billingState(
      { billing_status: b.billing_status as BillingStatus, trial_ends_at: b.trial_ends_at, billing_grace_until: b.billing_grace_until, stripe_subscription_id: b.stripe_subscription_id },
      now.getTime()
    );

    if (state.shouldPause && !b.is_locked_out) {
      await db.from("users").update({ is_locked_out: true, billing_status: state.status === "canceled" ? "canceled" : "paused" }).eq("user_id", b.user_id);
      paused++;
      continue;
    }

    // After the trial, without a card on file: each text once, at 10 AM their time.
    if (b.billing_status !== "trialing" || b.stripe_subscription_id || !b.trial_ends_at || !b.phone_number || !b.forwarding_number) continue;
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: b.timezone || DEFAULT_TZ, hour: "numeric", hourCycle: "h23" }).format(now));
    if (hour !== 10) continue;
    const since = daysSinceTrialEnd(b.trial_ends_at, now.getTime());
    const due = CARD_TEXT_DAYS.find((d) => d === since);
    const key = due !== undefined ? (`d${due}` as const) : null;
    if (!key || (b.billing_texts_sent || []).includes(key)) continue;

    const lang = b.barber_language === "es" ? "es" : "en";
    const body = TEXTS[lang][key].replace("{link}", `${appUrl()}/dashboard/settings#billing`);
    // Mark first so a slow send can't double-text on the next run.
    await db.from("users").update({ billing_texts_sent: [...(b.billing_texts_sent || []), key] }).eq("user_id", b.user_id);
    try {
      if (await sendSMS({ to: b.forwarding_number, from: b.phone_number, body, userId: b.user_id, templateKey: "billing_trial", language: lang, audience: "barber" })) texted++;
    } catch (err) {
      console.error("[cron:billing] trial text failed", err);
    }
  }
  return NextResponse.json({ texted, paused });
}
