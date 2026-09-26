import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id, status")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: service } = await supabase
    .from("services")
    .select("name, price, duration_minutes")
    .eq("id", booking.service_id)
    .single();

  const { data: barber } = await supabase
    .from("users")
    .select("business_name")
    .eq("user_id", booking.user_id)
    .single();

  return NextResponse.json({
    id: booking.id,
    status: booking.status,
    bookingTime: booking.booking_time,
    userId: booking.user_id,
    serviceId: booking.service_id,
    service: service ? { name: service.name, price: service.price, duration_minutes: service.duration_minutes } : null,
    businessName: barber?.business_name || null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action, newTime, source } = body;

  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, customer_phone, booking_time, service_id, status")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: barber } = await supabase
    .from("users")
    .select("phone_number, business_name, booking_link, google_review_url")
    .eq("user_id", booking.user_id)
    .single();

  const { data: service } = await supabase
    .from("services")
    .select("name, price")
    .eq("id", booking.service_id)
    .single();

  const shopName = barber?.business_name || "your barber";
  const link = barber?.booking_link || `${process.env.NEXT_PUBLIC_APP_URL}/book/${booking.user_id}`;

  if (action === "complete") {
    if (booking.status !== "confirmed") {
      return NextResponse.json({ error: "Booking is not active" }, { status: 400 });
    }

    const { error: completeError } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", id);

    if (completeError) {
      return NextResponse.json(
        { error: `Failed to complete booking: ${completeError.message}` },
        { status: 500 }
      );
    }

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

    // Increment cut_count and set last_cut_date
    const { data: vipClient } = await supabase
      .from("vip_clients")
      .select("id, cut_count, has_claimed_onboarding_discount")
      .eq("user_id", booking.user_id)
      .eq("phone_number", booking.customer_phone)
      .single();

    if (vipClient) {
      const newCutCount = vipClient.cut_count + 1;

      await supabase
        .from("vip_clients")
        .update({
          cut_count: newCutCount,
          last_cut_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", vipClient.id);

      // Check loyalty discount via SQL function
      const { data: loyaltyResult } = await supabase.rpc("loyalty_discount_due", {
        p_cut_count: newCutCount,
        p_claimed: vipClient.has_claimed_onboarding_discount,
      });

      if (loyaltyResult === true && barber?.phone_number) {
        if (newCutCount === 1 && !vipClient.has_claimed_onboarding_discount) {
          await supabase
            .from("vip_clients")
            .update({ has_claimed_onboarding_discount: true })
            .eq("id", vipClient.id);
        }

        const msg = await buildSMS({
          userId: booking.user_id,
          templateKey: "loyalty_earned",
          clientPhone: booking.customer_phone,
          vars: { shop_name: shopName, link },
        });

        if (msg) {
          try {
            await sendSMS(booking.customer_phone, barber.phone_number, msg);
            await markFirstMessageSent(booking.user_id, booking.customer_phone);
            await supabase.from("activity_feed").insert({
              user_id: booking.user_id,
              event_type: "loyalty_claimed",
              client_name: completedClientName,
              client_phone: booking.customer_phone,
              description: `${completedClientName || "Client"} earned $5 loyalty discount`,
              metadata: { cut_count: newCutCount },
            });
          } catch (err) {
            console.error("Loyalty SMS failed:", err);
          }
        }
      } else if (barber?.phone_number) {
        // Send progress message
        const { data: cutsLeft } = await supabase.rpc("loyalty_cuts_until_next", {
          p_cut_count: newCutCount,
          p_claimed: newCutCount >= 1 || vipClient.has_claimed_onboarding_discount,
        });

        if (cutsLeft && cutsLeft > 0) {
          const msg = await buildSMS({
            userId: booking.user_id,
            templateKey: "loyalty_progress",
            clientPhone: booking.customer_phone,
            vars: { shop_name: shopName, cuts_left: String(cutsLeft) },
          });

          if (msg) {
            try {
              await sendSMS(booking.customer_phone, barber.phone_number, msg);
              await markFirstMessageSent(booking.user_id, booking.customer_phone);
            } catch (err) {
              console.error("Loyalty progress SMS failed:", err);
            }
          }
        }
      }

      // Schedule review request 3 hours after completion (30-day cooldown)
      if (newCutCount >= 2 && barber?.google_review_url) {
        const { data: vipForReview } = await supabase
          .from("vip_clients")
          .select("last_review_request_at, is_opted_in, opted_out_at")
          .eq("id", vipClient.id)
          .single();

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const cooldownPassed = !vipForReview?.last_review_request_at ||
          vipForReview.last_review_request_at < thirtyDaysAgo;

        if (
          vipForReview &&
          cooldownPassed &&
          vipForReview.is_opted_in &&
          !vipForReview.opted_out_at
        ) {
          await supabase.from("booking_reminders").insert({
            booking_id: id,
            reminder_type: "review",
          });
        }
      }
    }

    return NextResponse.json({ success: true, status: "completed" });
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "Booking is not active" }, { status: 400 });
  }

  if (action === "cancel") {
    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (cancelError) {
      return NextResponse.json(
        { error: `Failed to cancel booking: ${cancelError.message}` },
        { status: 500 }
      );
    }

    if (barber?.phone_number) {
      const msg = await buildSMS({
        userId: booking.user_id,
        templateKey: "cancelled",
        clientPhone: booking.customer_phone,
        vars: { shop_name: shopName, link },
      });

      if (msg) {
        try {
          await sendSMS(booking.customer_phone, barber.phone_number, msg);
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

        const oldTime = new Date(booking.booking_time);
        const barberMsg = await buildSMS({
          userId: booking.user_id,
          templateKey: "barber_cancel_notify",
          clientPhone: booking.customer_phone,
          vars: {
            customer_name: vip?.first_name || booking.customer_phone,
            date: oldTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
            time: oldTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          },
        });
        if (barberMsg) {
          try {
            await sendSMS(barber.phone_number, barber.phone_number, barberMsg);
          } catch (err) {
            console.error("Barber cancel notify failed:", err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, status: "cancelled" });
  }

  if (action === "reschedule" && newTime) {
    const oldBookingTime = new Date(booking.booking_time);
    const newBookingTime = new Date(newTime);

    const { error: rescheduleError } = await supabase
      .from("bookings")
      .update({ booking_time: newBookingTime.toISOString() })
      .eq("id", id);

    if (rescheduleError) {
      return NextResponse.json(
        { error: `Failed to reschedule booking: ${rescheduleError.message}` },
        { status: 500 }
      );
    }

    if (barber?.phone_number) {
      const dateStr = newBookingTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const timeStr = newBookingTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      const msg = await buildSMS({
        userId: booking.user_id,
        templateKey: "rescheduled",
        clientPhone: booking.customer_phone,
        vars: { shop_name: shopName, date: dateStr, time: timeStr, link },
      });

      if (msg) {
        try {
          await sendSMS(booking.customer_phone, barber.phone_number, msg);
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

        const barberMsg = await buildSMS({
          userId: booking.user_id,
          templateKey: "barber_reschedule_notify",
          clientPhone: booking.customer_phone,
          vars: {
            customer_name: vip?.first_name || booking.customer_phone,
            old_date: oldBookingTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            old_time: oldBookingTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            date: dateStr,
            time: timeStr,
          },
        });
        if (barberMsg) {
          try {
            await sendSMS(barber.phone_number, barber.phone_number, barberMsg);
          } catch (err) {
            console.error("Barber reschedule notify failed:", err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, status: "rescheduled" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
