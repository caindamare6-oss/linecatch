import { NextResponse } from "next/server";
import { scheduleLink } from "@/lib/next-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/twilio";
import { isSlotFree, withinBusinessHours } from "@/lib/availability";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { formatCasualDate, formatCasualTime } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { DEFAULT_TZ, appUrl } from "@/lib/config";
import { projectVisit } from "@/lib/loyalty";
import { completeBooking, markNoShow, closeOutVisit } from "@/lib/complete-booking";
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

  if (action === "complete") {
    if (!isOwner) return NextResponse.json({ error: t("manage.err_not_allowed") }, { status: 403 });
    const r = await completeBooking(supabase, id, "barber");
    if (!r.ok) {
      return NextResponse.json({ error: t(r.error === "failed" ? "manage.err_complete" : "manage.err_not_active") }, { status: r.error === "failed" ? 500 : 400 });
    }
    return NextResponse.json({ success: true, status: "completed" });
  }

  // Barber marks a client who never showed: a booking still waiting, or one already marked done
  // (by them or automatically) within 24 hours. No stamp, no texts.
  if (action === "no_show") {
    if (!isOwner) return NextResponse.json({ error: t("manage.err_not_allowed") }, { status: 403 });
    const r = await markNoShow(supabase, id);
    if (!r.ok) {
      const key = r.error === "too_early" ? "manage.err_no_show_early" : r.error === "too_late" ? "manage.err_no_show_late" : r.error === "failed" ? "manage.err_update" : "manage.err_not_active";
      return NextResponse.json({ error: t(key) }, { status: r.error === "failed" ? 500 : 400 });
    }
    return NextResponse.json({ success: true, status: "no_show" });
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: t("manage.err_not_active") }, { status: 400 });
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
            // The freed day on their schedule.
            const body = `${cancelNotifySms.body}\n${scheduleLink(appUrl(), booking.id, oldTime, tz)}`;
            await sendSMS({ to: barber.forwarding_number, from: barber.phone_number, body, userId: booking.user_id, templateKey: "barber_cancel_notify", language: cancelNotifySms.language, audience: "barber" });
          } catch (err) {
            console.error("Barber cancel notify failed:", err);
          }
        }
      }
    }

    // Cancelling the last unresolved person of a partly-completed group finishes that visit.
    await closeOutVisit(supabase, id);

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
            const body = `${rescheduleNotifySms.body}\n${scheduleLink(appUrl(), booking.id, newBookingTime, tz)}`;
            await sendSMS({ to: barber.forwarding_number, from: barber.phone_number, body, userId: booking.user_id, templateKey: "barber_reschedule_notify", language: rescheduleNotifySms.language, audience: "barber" });
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
