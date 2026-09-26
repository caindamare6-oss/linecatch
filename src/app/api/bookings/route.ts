import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, serviceId, customerPhone, bookingTime, firstName, consentText, source } = body;

  if (!userId || !serviceId || !customerPhone || !bookingTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const digits = customerPhone.replace(/\D/g, "");
  const normalized = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

  // Check vip_clients for consent
  const { data: vipClient } = await supabase
    .from("vip_clients")
    .select("id, is_opted_in, opted_out_at, opted_in_at, consent_text, first_name")
    .eq("user_id", userId)
    .eq("phone_number", normalized)
    .single();

  // Opted-out clients can still book — just no SMS
  if (vipClient?.opted_out_at) {
    if (firstName && !vipClient.first_name) {
      await supabase
        .from("vip_clients")
        .update({ first_name: firstName })
        .eq("id", vipClient.id);
    }
  } else if (!vipClient) {
    // No row exists — create one
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    if (consentText) {
      const { error: insertError } = await supabase.from("vip_clients").insert({
        user_id: userId,
        phone_number: normalized,
        opted_in_at: new Date().toISOString(),
        is_opted_in: true,
        opt_in_source: "booking_form",
        opt_in_ip: ip,
        opt_in_user_agent: userAgent,
        consent_text: consentText,
        first_name: firstName || null,
      });

      if (insertError) {
        console.error("VIP client creation error:", insertError);
        return NextResponse.json({ error: "Failed to record client" }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from("vip_clients").insert({
        user_id: userId,
        phone_number: normalized,
        is_opted_in: false,
        opt_in_source: "booking_form",
        first_name: firstName || null,
      });

      if (insertError) {
        console.error("VIP client creation error:", insertError);
        return NextResponse.json({ error: "Failed to record client" }, { status: 500 });
      }
    }
  } else if (!vipClient.is_opted_in) {
    // Row exists but not opted in
    if (consentText) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const userAgent = request.headers.get("user-agent") || "unknown";

      await supabase
        .from("vip_clients")
        .update({
          is_opted_in: true,
          opted_in_at: new Date().toISOString(),
          opt_in_source: "booking_form",
          opt_in_ip: ip,
          opt_in_user_agent: userAgent,
          consent_text: consentText,
          first_name: firstName || vipClient.first_name || null,
        })
        .eq("id", vipClient.id);
    } else if (firstName && !vipClient.first_name) {
      await supabase
        .from("vip_clients")
        .update({ first_name: firstName })
        .eq("id", vipClient.id);
    }
  } else {
    // Already opted in — update first_name if provided but don't overwrite consent fields
    if (firstName && !vipClient.first_name) {
      await supabase
        .from("vip_clients")
        .update({ first_name: firstName })
        .eq("id", vipClient.id);
    }
  }

  // Determine if this client is opted in for SMS (used later for confirmation)
  const clientOptedIn =
    (vipClient?.is_opted_in === true && !vipClient?.opted_out_at) ||
    (!vipClient && !!consentText) ||
    (vipClient && !vipClient.is_opted_in && !vipClient.opted_out_at && !!consentText);

  // Verify service exists
  const { data: service } = await supabase
    .from("services")
    .select("id, name, price, duration_minutes")
    .eq("id", serviceId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Check slot is still available
  const bTime = new Date(bookingTime);
  const startOfDay = new Date(bTime);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(bTime);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: existing } = await supabase
    .from("bookings")
    .select("id, booking_time, service_id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("booking_time", startOfDay.toISOString())
    .lte("booking_time", endOfDay.toISOString());

  if (existing) {
    const requestMinutes = bTime.getHours() * 60 + bTime.getMinutes();
    for (const b of existing) {
      const { data: bs } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", b.service_id)
        .single();
      const bt = new Date(b.booking_time);
      const bm = bt.getHours() * 60 + bt.getMinutes();
      const bd = bs?.duration_minutes || 30;
      if (requestMinutes < bm + bd && requestMinutes + service.duration_minutes > bm) {
        return NextResponse.json({ error: "This time slot is no longer available" }, { status: 409 });
      }
    }
  }

  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      user_id: userId,
      service_id: serviceId,
      customer_phone: normalized,
      booking_time: bTime.toISOString(),
      status: "confirmed",
      source: source || "direct",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    console.error("Booking creation error:", bookingError);
    return NextResponse.json({ error: `Failed to create booking: ${bookingError?.message || "unknown error"}` }, { status: 500 });
  }

  const clientName = firstName?.trim() || vipClient?.first_name || null;
  await supabase.from("activity_feed").insert({
    user_id: userId,
    event_type: "booking_created",
    client_name: clientName,
    client_phone: normalized,
    description: `${clientName || "New client"} booked ${service.name}`,
    metadata: { booking_id: booking.id, service_name: service.name, source: source || "direct" },
  });

  // Get barber info for confirmation SMS and barber notify
  const { data: barber } = await supabase
    .from("users")
    .select("phone_number, forwarding_number, business_name, booking_link, timezone, is_locked_out")
    .eq("user_id", userId)
    .single();

  if (barber?.phone_number && clientOptedIn) {
    const dateStr = bTime.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const timeStr = bTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const shopName = barber.business_name || "your barber";
    const link = barber.booking_link || `${process.env.NEXT_PUBLIC_APP_URL}/book/${userId}`;

    const msg = await buildSMS({
      userId,
      templateKey: "booking_confirm",
      clientPhone: normalized,
      vars: { shop_name: shopName, date: dateStr, time: timeStr, link },
    });

    if (msg) {
      try {
        await sendSMS(normalized, barber.phone_number, msg);
        await markFirstMessageSent(userId, normalized);
        await supabase.from("booking_reminders").insert({
          booking_id: booking.id,
          reminder_type: "confirmation",
        });
      } catch (err) {
        console.error("Confirmation SMS failed:", err);
      }
    }
  }

  // Notify barber of same-day booking if morning summary already sent
  if (barber && !barber.is_locked_out && barber.forwarding_number) {
    const tz = barber.timezone || "America/New_York";
    const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const bookingLocal = new Date(bTime.toLocaleString("en-US", { timeZone: tz }));
    const isSameDay =
      nowLocal.getFullYear() === bookingLocal.getFullYear() &&
      nowLocal.getMonth() === bookingLocal.getMonth() &&
      nowLocal.getDate() === bookingLocal.getDate();

    if (isSameDay && nowLocal.getHours() >= 9) {
      const timeStr = bTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });

      const barberMsg = await buildSMS({
        userId,
        templateKey: "barber_booking_notify",
        clientPhone: normalized,
        vars: {
          customer_name: clientName || normalized,
          service: service.name,
          time: timeStr,
        },
      });

      if (barberMsg) {
        try {
          await sendSMS(barber.forwarding_number, barber.phone_number, barberMsg);
        } catch (err) {
          console.error("Barber booking notify failed:", err);
        }
      }
    }
  }

  return NextResponse.json({ success: true, bookingId: booking.id });
}
