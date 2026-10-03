import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/twilio";
import { isSlotFree, withinBusinessHours } from "@/lib/availability";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { formatCasualDate, formatCasualTime } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { DEFAULT_TZ, appUrl } from "@/lib/config";
import { completeBookingLoyalty, closeVisitIfResolved, projectVisit } from "@/lib/loyalty";
import { hasTextConsent } from "@/lib/opt-out";

const CLIENT_CUTOFF_HOURS = 3;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { t } = await getT();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id, status, group_id")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: t("manage.err_not_found") }, { status: 404 });
  }

  const { data: service } = await supabase
    .from("services")
    .select("name, price, duration_minutes")
    .eq("id", booking.service_id)
    .single();

  const { data: barber } = await supabase
    .from("users")
    .select("business_name, timezone, accent_color")
    .eq("user_id", booking.user_id)
    .single();

  let partySize = 1;
  if (booking.group_id) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("group_id", booking.group_id)
      .eq("status", booking.status);
    partySize = count || 1;
  }

  const loyalty = booking.status === "confirmed" ? await projectVisit(supabase, booking.id) : null;

  return NextResponse.json({
    accentColor: barber?.accent_color ?? null,
    partySize,
    rewardDue: !!loyalty?.due,
    id: booking.id,
    status: booking.status,
    bookingTime: booking.booking_time,
    userId: booking.user_id,
    serviceId: booking.service_id,
    service: service ? { name: service.name, price: service.price, duration_minutes: service.duration_minutes } : null,
    businessName: barber?.business_name || null,
    timezone: barber?.timezone || DEFAULT_TZ,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action, newTime } = body;
  const { t } = await getT();

  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id, status, group_id")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: t("manage.err_not_found") }, { status: 404 });
  }

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const isOwner = !!user && user.id === booking.user_id;
  const source = isOwner ? "barber" : "client";

  // A client acts on their whole group; the barber acts on the single row they tapped.
  let members: { id: string; booking_time: string }[] = [{ id: booking.id, booking_time: booking.booking_time }];
  if (!isOwner && booking.group_id) {
    const { data: group } = await supabase
      .from("bookings")
      .select("id, booking_time")
      .eq("group_id", booking.group_id)
      .eq("status", "confirmed")
      .order("booking_time", { ascending: true });
    if (group && group.length > 0) members = group;
  }
  const memberIds = members.map((m) => m.id);

  if (!isOwner) {
    if (action !== "cancel" && action !== "reschedule") {
      return NextResponse.json({ error: t("manage.err_not_allowed") }, { status: 403 });
    }
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: t("manage.err_not_active") }, { status: 400 });
    }
    const hoursUntil = (new Date(members[0].booking_time).getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntil <= CLIENT_CUTOFF_HOURS) {
      return NextResponse.json(
        { error: t("manage.err_cutoff", { hours: CLIENT_CUTOFF_HOURS }) },
        { status: 403 }
      );
    }
  }

  const { data: barber } = await supabase
    .from("users")
    .select("phone_number, forwarding_number, business_name, first_name, booking_link, google_review_url, feature_reviews, timezone, business_hours")
    .eq("user_id", booking.user_id)
    .single();

  const { data: service } = await supabase
    .from("services")
    .select("name, price, duration_minutes")
    .eq("id", booking.service_id)
    .single();

  const shopName = barber?.business_name?.trim() || barber?.first_name?.trim() || "your barber";
  const link = barber?.booking_link || `${appUrl()}/book/${booking.user_id}`;
  const tz = barber?.timezone || DEFAULT_TZ;
  // Texts to the client (loyalty, cancel, reschedule) only go to someone who agreed to get texts.
  const clientConsented = await hasTextConsent(supabase as unknown as Parameters<typeof hasTextConsent>[0], booking.user_id, booking.customer_phone);

  // Once every person in the visit is completed or cancelled: one loyalty text + review request.
  async function closeOutVisit() {
    const closeout = await closeVisitIfResolved(supabase, id);
    if (!closeout || closeout.cutCount === null || closeout.nextCut === null || !barber?.phone_number) return;
    const templateKey = closeout.visitRewarded ? "loyalty_earned" : "loyalty_progress";
    const loyaltySms = await buildSMS({
      userId: booking!.user_id,
      templateKey,
      clientPhone: booking!.customer_phone,
      vars: {
        shop_name: shopName,
        link,
        cuts: String(closeout.cutCount),
        next_cut: String(closeout.nextCut),
        cuts_left: String(closeout.nextCut - closeout.cutCount),
      },
    });
    if (!loyaltySms || !clientConsented) return;
    try {
      await sendSMS({ to: booking!.customer_phone, from: barber.phone_number, body: loyaltySms.body, userId: booking!.user_id, templateKey, language: loyaltySms.language });
      await markFirstMessageSent(booking!.user_id, booking!.customer_phone);
    } catch (err) {
      console.error("Loyalty SMS failed:", err);
    }
  }

  if (action === "complete") {
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: t("manage.err_not_active") }, { status: 400 });
    }

    let result: Awaited<ReturnType<typeof completeBookingLoyalty>>;
    try {
      result = await completeBookingLoyalty(supabase, id, tz);
    } catch (err) {
      console.error("[bookings/complete]", err);
      return NextResponse.json({ error: t("manage.err_complete") }, { status: 500 });
    }
    if (!result) {
      return NextResponse.json({ error: t("manage.err_not_active") }, { status: 400 });
    }
    const { projection, rewardedNow } = result;

    // Get client name for activity feed
    const { data: vipForName } = await supabase
      .from("vip_clients")
      .select("first_name")
      .eq("user_id", booking.user_id)
      .eq("phone_number", booking.customer_phone)
      .single();
    const completedClientName = vipForName?.first_name || null;

    await supabase.from("activity_feed").insert({
      user_id: booking.user_id,
      event_type: "booking_completed",
      client_name: completedClientName,
      client_phone: booking.customer_phone,
      description: `${completedClientName || "Client"}'s ${service?.name || "cut"} completed`,
      metadata: { booking_id: id, service_name: service?.name || null },
    });

    // Delete unsent reminders
    await supabase
      .from("booking_reminders")
      .delete()
      .eq("booking_id", id)
      .in("reminder_type", ["24h", "2h"]);

    if (rewardedNow && projection) {
      await supabase.from("activity_feed").insert({
        user_id: booking.user_id,
        event_type: "loyalty_claimed",
        client_name: completedClientName,
        client_phone: booking.customer_phone,
        description: `${completedClientName || "Client"} got $5 off (cut #${projection.rewardCut})`,
        metadata: { booking_id: id, visit_key: projection.visitKey, cut_count: projection.rewardCut },
      });
    }

    await closeOutVisit();

    return NextResponse.json({ success: true, status: "completed" });
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: t("manage.err_not_active") }, { status: 400 });
  }

  // Barber marks a client who never showed. No stamp, no texts; reminders that haven't gone out are dropped.
  if (action === "no_show") {
    if (!isOwner) return NextResponse.json({ error: t("manage.err_not_allowed") }, { status: 403 });
    if (new Date(booking.booking_time).getTime() > Date.now()) {
      return NextResponse.json({ error: t("manage.err_no_show_early") }, { status: 400 });
    }
    const { error: nsError } = await supabase.from("bookings").update({ status: "no_show" }).eq("id", id).eq("status", "confirmed");
    if (nsError) {
      console.error("[bookings/no_show]", nsError);
      return NextResponse.json({ error: t("manage.err_update") }, { status: 500 });
    }
    await supabase.from("booking_reminders").delete().eq("booking_id", id).in("reminder_type", ["24h", "2h"]);
    await closeOutVisit();
    return NextResponse.json({ success: true, status: "no_show" });
  }

  if (action === "cancel") {
    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", memberIds);

    if (cancelError) {
      console.error("[bookings/cancel]", cancelError);
      return NextResponse.json(
        { error: t("manage.err_cancel") },
        { status: 500 }
      );
    }

    if (barber?.phone_number) {
      const cancelSms = await buildSMS({
        userId: booking.user_id,
        templateKey: "cancelled",
        clientPhone: booking.customer_phone,
        vars: { shop_name: shopName, link, date: formatCasualDate(new Date(members[0].booking_time), tz) },
      });

      if (cancelSms && clientConsented) {
        try {
          await sendSMS({ to: booking.customer_phone, from: barber.phone_number, body: cancelSms.body, userId: booking.user_id, templateKey: "cancelled", language: cancelSms.language });
          await markFirstMessageSent(booking.user_id, booking.customer_phone);
        } catch (err) {
          console.error("Cancel SMS failed:", err);
        }
      }

      if (source === "client") {
        const { data: vip } = await supabase
          .from("vip_clients")
          .select("first_name")
          .eq("user_id", booking.user_id)
          .eq("phone_number", booking.customer_phone)
          .single();

        const oldTime = new Date(members[0].booking_time);
        const cancelNotifySms = await buildSMS({
          userId: booking.user_id,
          templateKey: "barber_cancel_notify",
          clientPhone: booking.customer_phone,
          vars: {
            customer_name: vip?.first_name || booking.customer_phone,
            date: formatCasualDate(oldTime, tz),
            time: formatCasualTime(oldTime, tz),
          },
        });
        if (cancelNotifySms && barber.forwarding_number) {
          try {
            await sendSMS({ to: barber.forwarding_number, from: barber.phone_number, body: cancelNotifySms.body, userId: booking.user_id, templateKey: "barber_cancel_notify", language: cancelNotifySms.language, audience: "barber" });
          } catch (err) {
            console.error("Barber cancel notify failed:", err);
          }
        }
      }
    }

    // Cancelling the last unresolved person of a partly-completed group finishes that visit.
    await closeOutVisit();

    return NextResponse.json({ success: true, status: "cancelled" });
  }

  if (action === "reschedule" && newTime) {
    const oldBookingTime = new Date(members[0].booking_time);
    const newBookingTime = new Date(newTime);
    const duration = service?.duration_minutes || 30;
    const totalMinutes = duration * members.length;

    if (isNaN(newBookingTime.getTime()) || newBookingTime.getTime() <= Date.now()) {
      return NextResponse.json({ error: t("manage.err_past") }, { status: 400 });
    }
    if (!isOwner && !withinBusinessHours(barber?.business_hours ?? null, newBookingTime, totalMinutes, tz)) {
      return NextResponse.json({ error: t("manage.err_outside_hours") }, { status: 400 });
    }
    if (!(await isSlotFree(supabase, booking.user_id, newBookingTime, totalMinutes, memberIds))) {
      return NextResponse.json({ error: t("manage.err_taken") }, { status: 409 });
    }

    let rescheduleError: { message: string } | null = null;
    for (const [i, m] of members.entries()) {
      const { error } = await supabase
        .from("bookings")
        .update({ booking_time: new Date(newBookingTime.getTime() + i * duration * 60 * 1000).toISOString() })
        .eq("id", m.id);
      if (error) { rescheduleError = error; break; }
    }

    // Reminders already sent were for the old time; the new time gets its own 24h and 2h reminders.
    if (!rescheduleError) {
      await supabase.from("booking_reminders").delete().in("booking_id", memberIds).in("reminder_type", ["24h", "2h"]);
    }

    if (rescheduleError) {
      console.error("[bookings/reschedule]", rescheduleError);
      return NextResponse.json(
        { error: t("manage.err_reschedule") },
        { status: 500 }
      );
    }

    if (barber?.phone_number) {
      const dateStr = formatCasualDate(newBookingTime, tz);
      const timeStr = formatCasualTime(newBookingTime, tz);

      const rescheduleSms = await buildSMS({
        userId: booking.user_id,
        templateKey: "rescheduled",
        clientPhone: booking.customer_phone,
        vars: { shop_name: shopName, date: dateStr, time: timeStr, link },
      });

      if (rescheduleSms && clientConsented) {
        try {
          await sendSMS({ to: booking.customer_phone, from: barber.phone_number, body: rescheduleSms.body, userId: booking.user_id, templateKey: "rescheduled", language: rescheduleSms.language });
          await markFirstMessageSent(booking.user_id, booking.customer_phone);
        } catch (err) {
          console.error("Reschedule SMS failed:", err);
        }
      }

      if (source === "client") {
        const { data: vip } = await supabase
          .from("vip_clients")
          .select("first_name")
          .eq("user_id", booking.user_id)
          .eq("phone_number", booking.customer_phone)
          .single();

        const rescheduleNotifySms = await buildSMS({
          userId: booking.user_id,
          templateKey: "barber_reschedule_notify",
          clientPhone: booking.customer_phone,
          vars: {
            customer_name: vip?.first_name || booking.customer_phone,
            old_date: formatCasualDate(oldBookingTime, tz),
            old_time: formatCasualTime(oldBookingTime, tz),
            date: dateStr,
            time: timeStr,
          },
        });
        if (rescheduleNotifySms && barber.forwarding_number) {
          try {
            await sendSMS({ to: barber.forwarding_number, from: barber.phone_number, body: rescheduleNotifySms.body, userId: booking.user_id, templateKey: "barber_reschedule_notify", language: rescheduleNotifySms.language, audience: "barber" });
          } catch (err) {
            console.error("Barber reschedule notify failed:", err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, status: "rescheduled" });
  }

  return NextResponse.json({ error: t("manage.err_invalid_action") }, { status: 400 });
}
