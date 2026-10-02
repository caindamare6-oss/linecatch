import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { marketingAllowedIds } from "@/lib/marketing";
import { wednesdayText, inWednesdayWindow, cronNow } from "@/lib/retention";
import { issueToken } from "@/lib/client-session";
import { DEFAULT_TZ, appUrl } from "@/lib/config";

// Leave room under the platform limit; whatever isn't reached goes out on the next hourly run.
export const maxDuration = 300;
const TIME_BUDGET_MS = 240_000;
const CONCURRENCY = 5;

/** Run `fn` over items, a few at a time, starting nothing new once `stop()` says so. */
async function runPool<T>(items: T[], n: number, stop: () => boolean, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !stop()) await fn(items[i++]);
    })
  );
}

/** Wednesday Engine: runs hourly, texts only on Wednesday afternoons (see lib/retention). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = cronNow(request);
  const deadline = Date.now() + TIME_BUDGET_MS;
  let sent = 0;
  let checked = 0;
  let deferred = false;

  const { data: barbers } = await supabase
    .from("users")
    .select("user_id, phone_number, business_name, first_name, booking_link, timezone, winback_offer")
    .eq("is_active", true)
    .eq("is_locked_out", false)
    .neq("feature_wednesday", false);

  if (!barbers || barbers.length === 0) {
    return NextResponse.json({ sent: 0, checked: 0 });
  }

  // Marketing texts: only barbers who turned SMS marketing on (texts still only reach opted-in clients).
  const allowed = await marketingAllowedIds(supabase, barbers.map((b) => b.user_id));

  for (const barber of barbers) {
    if (!allowed.has(barber.user_id) || !barber.phone_number) continue;
    if (!inWednesdayWindow(now, barber.timezone || DEFAULT_TZ)) continue;
    checked++;

    const since = new Date(now.getTime() - 120 * 86_400_000).toISOString();
    const [{ data: clients }, { data: upcoming }, { data: optOuts }, { data: inbound }] = await Promise.all([
      supabase
        .from("vip_clients")
        .select("id, phone_number, first_name, last_cut_date, reengagement_stage, reengagement_index, last_reengagement_sent_at, has_claimed_winback")
        .eq("user_id", barber.user_id)
        .eq("is_opted_in", true)
        .is("opted_out_at", null)
        .not("last_cut_date", "is", null),
      supabase.from("bookings").select("customer_phone").eq("user_id", barber.user_id).eq("status", "confirmed").gt("booking_time", now.toISOString()),
      supabase.from("opt_outs").select("caller_phone").eq("user_id", barber.user_id),
      supabase.from("sms_log").select("from_number, created_at").eq("user_id", barber.user_id).eq("direction", "inbound").gte("created_at", since),
    ]);

    const booked = new Set((upcoming || []).map((b) => b.customer_phone));
    const out = new Set((optOuts || []).map((o) => o.caller_phone));
    const lastInbound = new Map<string, string>();
    for (const m of inbound || []) {
      if (m.from_number && (!lastInbound.has(m.from_number) || m.created_at > lastInbound.get(m.from_number)!)) lastInbound.set(m.from_number, m.created_at);
    }
    const shopName = barber.business_name?.trim() || barber.first_name?.trim() || "your barber";

    const due = (clients || []).flatMap((client) => {
      const rung = wednesdayText(
        {
          lastCutDate: client.last_cut_date,
          lastSentAt: client.last_reengagement_sent_at,
          variantIndex: client.reengagement_index ?? 0,
          claimedOffer: !!client.has_claimed_winback,
          optedOut: out.has(client.phone_number),
          hasFutureBooking: booked.has(client.phone_number),
          lastInboundAt: lastInbound.get(client.phone_number) ?? null,
        },
        { now, offer: barber.winback_offer }
      );
      return rung ? [{ client, rung }] : [];
    });

    await runPool(due, CONCURRENCY, () => Date.now() > deadline, async ({ client, rung }) => {
      // Mark first, only if nobody else did: an overlapping run can't text the same person twice.
      const claim = supabase
        .from("vip_clients")
        .update({
          reengagement_stage: rung.first ? 1 : 2,
          reengagement_index: rung.nextVariantIndex,
          last_reengagement_sent_at: now.toISOString(),
          ...(rung.usesOffer ? { has_claimed_winback: true } : {}),
        })
        .eq("id", client.id);
      const { data: claimed } = await (client.last_reengagement_sent_at
        ? claim.eq("last_reengagement_sent_at", client.last_reengagement_sent_at)
        : claim.is("last_reengagement_sent_at", null)
      ).select("id");
      if (!claimed?.length) return;
      const undo = () =>
        supabase
          .from("vip_clients")
          .update({
            reengagement_stage: client.reengagement_stage ?? 0,
            reengagement_index: client.reengagement_index ?? 0,
            last_reengagement_sent_at: client.last_reengagement_sent_at,
            has_claimed_winback: !!client.has_claimed_winback,
          })
          .eq("id", client.id);

      try {
        // Their own link: opening it recognizes them, so rebooking is a couple of taps.
        let link: string;
        if (barber.booking_link) {
          const u = new URL(barber.booking_link);
          u.searchParams.set("src", "cron_reengagement");
          link = u.toString();
        } else {
          const token = await issueToken(supabase, { userId: barber.user_id, phone: client.phone_number, kind: "link", verified: true });
          link = `${appUrl()}/book/${barber.user_id}?src=cron_reengagement${token ? `&t=${token}` : ""}`;
        }
        const sms = await buildSMS({ userId: barber.user_id, templateKey: rung.templateKey, clientPhone: client.phone_number, vars: { shop_name: shopName, link } });
        const ok = sms && (await sendSMS({ to: client.phone_number, from: barber.phone_number!, body: sms.body, userId: barber.user_id, templateKey: rung.templateKey, language: sms.language }));
        if (!ok) {
          // Not sent (blocked, capped or a carrier error): a later run this Wednesday can try again.
          await undo();
          return;
        }
        await markFirstMessageSent(barber.user_id, client.phone_number);
        await supabase.from("activity_feed").insert({
          user_id: barber.user_id,
          event_type: "cron_reengagement",
          client_name: client.first_name || null,
          client_phone: client.phone_number,
          description: `${rung.first ? "Check-in" : "Wednesday reminder"} text sent to ${client.first_name || "client"}`,
          metadata: { first: rung.first, template: rung.templateKey },
        });
        sent++;
      } catch (err) {
        console.error(`Wednesday text failed for ${client.phone_number}:`, err);
        await undo();
      }
    });
    if (Date.now() > deadline) {
      deferred = true;
      break;
    }
  }

  // Anyone left over goes out on the next hourly run this Wednesday.
  return NextResponse.json({ sent, checked, deferred });
}
