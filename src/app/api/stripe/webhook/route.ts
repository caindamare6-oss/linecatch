import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "@/lib/stripe-billing";
import { syncAccount } from "@/lib/stripe-connect";

/**
 * Stripe tells the app about payments and account changes here. Two endpoints in the Stripe
 * dashboard point at this URL: one for "Your account" events (STRIPE_WEBHOOK_SECRET) and one for
 * "Connected accounts" events (STRIPE_CONNECT_WEBHOOK_SECRET).
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  // STRIPE_WEBHOOK is the name the first secret was saved under in Vercel.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
  if (!signature || secrets.length === 0) return NextResponse.json({ error: "Not configured" }, { status: 400 });

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = await getStripeClient().webhooks.constructEventAsync(body, signature, secret);
      break;
    } catch {}
  }
  if (!event) return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  const db = createAdminClient();
  // Stripe can send the same event twice: only the first one does anything.
  const { error: seen } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seen?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (seen) {
    // Not a repeat: the database had a problem. Stripe retries on a 500.
    console.error("[stripe:webhook] couldn't record event", seen);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const sub = await getStripeClient().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          await syncSubscription(db, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(db, event.data.object as Stripe.Subscription);
        break;
      case "account.updated":
        await syncAccount(db, event.data.object as Stripe.Account);
        break;
      case "payout.paid":
      case "payout.failed": {
        const p = event.data.object as Stripe.Payout;
        await db.from("payouts").update({ status: p.status }).eq("stripe_payout_id", p.id);
        break;
      }
    }
  } catch (err) {
    // Let Stripe retry: forget the event so the retry is handled.
    await db.from("stripe_events").delete().eq("id", event.id);
    console.error("[stripe:webhook]", event.type, err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
