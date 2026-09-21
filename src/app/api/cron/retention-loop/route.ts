import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  let sent = 0;
  let checked = 0;

  // Find barbers where local time is Wednesday 12:00–12:59 PM
  const { data: barbers } = await supabase
    .from("users")
    .select("user_id, phone_number, business_name, booking_link, timezone, is_locked_out, is_active")
    .eq("is_active", true)
    .eq("is_locked_out", false);

  if (!barbers || barbers.length === 0) {
    return NextResponse.json({ sent: 0, checked: 0 });
  }

  const now = new Date();

  for (const barber of barbers) {
    // Check if it's Wednesday 12:00-12:59 in barber's timezone
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: barber.timezone || "America/New_York" }));
    const dayOfWeek = localTime.getDay(); // 0=Sun, 3=Wed
    const hour = localTime.getHours();

    if (dayOfWeek !== 3 || hour !== 12) continue;

    checked++;

    // Find VIP clients due for re-engagement
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const twentyEightDaysAgo = new Date(now);
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const twentyOneDaysAgo = new Date(now);
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

    const { data: clients } = await supabase
      .from("vip_clients")
      .select("id, phone_number, client_language, first_name, last_reengagement_sent_at")
      .eq("user_id", barber.user_id)
      .eq("is_opted_in", true)
      .is("opted_out_at", null)
      .gte("last_cut_date", twentyEightDaysAgo.toISOString().split("T")[0])
      .lte("last_cut_date", fourteenDaysAgo.toISOString().split("T")[0]);

    if (!clients || clients.length === 0) continue;

    for (const client of clients) {
      // 21-day re-engagement guard
      if (client.last_reengagement_sent_at) {
        const lastSent = new Date(client.last_reengagement_sent_at);
        if (lastSent > twentyOneDaysAgo) continue;
      }

      // Check no active booking (must be a live subquery, not a cached boolean)
      const { data: activeBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("user_id", barber.user_id)
        .eq("customer_phone", client.phone_number)
        .eq("status", "confirmed")
        .gt("booking_time", now.toISOString())
        .limit(1)
        .single();

      if (activeBooking) continue;

      // Check opt_outs table too
      const { data: optOut } = await supabase
        .from("opt_outs")
        .select("caller_phone")
        .eq("user_id", barber.user_id)
        .eq("caller_phone", client.phone_number)
        .single();

      if (optOut) continue;

      const shopName = barber.business_name || "your barber";
      const baseLink = barber.booking_link || `${process.env.NEXT_PUBLIC_APP_URL}/book/${barber.user_id}`;
      const linkUrl = new URL(baseLink);
      linkUrl.searchParams.set("src", "cron_reengagement");
      const link = linkUrl.toString();

      const msg = await buildSMS({
        userId: barber.user_id,
        templateKey: "wednesday_dropin",
        clientPhone: client.phone_number,
        vars: { shop_name: shopName, link },
      });

      if (!msg) continue;

      try {
        await sendSMS(client.phone_number, barber.phone_number, msg);
        await markFirstMessageSent(barber.user_id, client.phone_number);

        await supabase
          .from("vip_clients")
          .update({ last_reengagement_sent_at: now.toISOString() })
          .eq("id", client.id);

        await supabase.from("activity_feed").insert({
          user_id: barber.user_id,
          event_type: "cron_reengagement",
          client_name: client.first_name || null,
          client_phone: client.phone_number,
          description: `Re-engagement text sent to ${client.first_name || "client"}`,
          metadata: {},
        });

        sent++;
      } catch (err) {
        console.error(`Re-engagement failed for ${client.phone_number}:`, err);
      }
    }
  }

  return NextResponse.json({ sent, checked });
}
