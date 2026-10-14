import { NextResponse } from "next/server";
import { scheduleLink } from "@/lib/next-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { buildSMS, markFirstMessageSent } from "@/lib/messages";
import { normalizePhone } from "@/lib/phone";
import { consentText } from "@/lib/consent";
import { getT } from "@/lib/i18n-server";
import { CLIENT_PAYMENTS, DEFAULT_TZ, appUrl } from "@/lib/config";
import { isLocale, translate } from "@/lib/i18n-shared";
import { formatCasualDate, formatCasualTime } from "@/lib/format";
import { isSlotFree, withinBusinessHours, MAX_PARTY_SIZE } from "@/lib/availability";
import { projectVisit, rewardVars, DEFAULT_LOYALTY } from "@/lib/loyalty";
import { findToken, issueToken, touchToken } from "@/lib/client-session";
import { attachCardToBookings } from "@/lib/stripe-connect";

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, serviceId, customerPhone, bookingTime, source, sessionToken } = body;
  const partySize = Number(body.partySize ?? 1);
  const { t } = await getT();
  // The language the client booked in; later texts go out in it. A barber booking on someone's behalf doesn't set it.
  const clientLanguage = source !== "barber" && isLocale(body.language) ? body.language : null;

  if (!userId || !serviceId || !bookingTime || (!customerPhone && !sessionToken)) {
    return NextResponse.json({ error: t("book.err_missing") }, { status: 400 });
  }
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
    return NextResponse.json({ error: t("book.err_party_size", { max: MAX_PARTY_SIZE }) }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Returning clients book with their saved token instead of retyping their phone.
  const session = sessionToken ? await findToken(supabase, userId, sessionToken) : null;
  let normalized: string;
  if (customerPhone) {
    const phoneResult = normalizePhone(customerPhone);
    if (!phoneResult.valid) {
      return NextResponse.json({ error: t("book.err_phone") }, { status: 400 });
    }
    normalized = phoneResult.e164;
  } else if (session) {
    normalized = session.phone_number;
  } else {
    return NextResponse.json({ error: t("book.err_session_expired"), sessionExpired: true }, { status: 401 });
  }
  const sameClient = session?.phone_number === normalized;
  const firstName: string | undefined =
    body.firstName?.trim() || (sameClient ? session?.display_name ?? undefined : undefined);

  const { data: vipClient } = await supabase
    .from("vip_clients")
    .select("id, is_opted_in, opted_out_at, first_name, client_language")
    .eq("user_id", userId)
    .eq("phone_number", normalized)
    .maybeSingle();

  // Booking agrees to appointment texts (the line under the Book button). Recorded only when the
  // client books themselves; that record is also who gets broadcasts. STOP always wins.
  const selfBooked = source !== "barber";
  const consent = selfBooked
    ? {
        is_opted_in: true,
        opted_in_at: new Date().toISOString(),
        opt_in_source: "booking_form",
        opt_in_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        opt_in_user_agent: request.headers.get("user-agent") || "unknown",
        consent_text: consentText(clientLanguage),
      }
    : null;

  if (!vipClient) {
    const { error: insertError } = await supabase.from("vip_clients").insert({
      user_id: userId,
      phone_number: normalized,
      ...(consent ?? { is_opted_in: false, opt_in_source: "booking_form" }),
      first_name: firstName || null,
      ...(clientLanguage ? { client_language: clientLanguage } : {}),
    });
    if (insertError) {
      console.error("Client creation error:", insertError);
      return NextResponse.json({ error: t("book.err_record_client") }, { status: 500 });
    }
  } else {
    const update: Record<string, unknown> = {};
    if (firstName && !vipClient.first_name) update.first_name = firstName;
    if (consent && !vipClient.is_opted_in && !vipClient.opted_out_at) Object.assign(update, consent);
    if (Object.keys(update).length) await supabase.from("vip_clients").update(update).eq("id", vipClient.id);
  }

  // Existing client: remember the language they just booked in.
  if (vipClient && clientLanguage && vipClient.client_language !== clientLanguage) {
    await supabase.from("vip_clients").update({ client_language: clientLanguage }).eq("id", vipClient.id);
  }
  const smsLanguage = clientLanguage || vipClient?.client_language || "en";


  // One cut per person, in order (the person booking first). Older pages send one serviceId for everyone.
  const ids: string[] = Array.isArray(body.serviceIds) ? body.serviceIds : Array(partySize).fill(serviceId);
  if (ids.length !== partySize || !ids.every((x) => typeof x === "string" && x)) {
    return NextResponse.json({ error: t("book.err_missing") }, { status: 400 });
  }
  const { data: found } = await supabase
    .from("services")
    .select("id, name, price, duration_minutes")
    .in("id", [...new Set(ids)])
    .eq("user_id", userId)
    .eq("is_active", true);
  const byId = new Map((found || []).map((s) => [s.id, s]));
  const party = ids.map((id) => byId.get(id));
  if (party.some((s) => !s)) {
    return NextResponse.json({ error: t("book.err_service_not_found") }, { status: 404 });
  }
  const partyServices = party as NonNullable<(typeof party)[number]>[];

  const { data: barberHours } = await supabase
    .from("users")
    .select("timezone, business_hours, stripe_account_id, protection_enabled, stripe_charges_enabled")
    .eq("user_id", userId)
    .single();
  const tz = barberHours?.timezone || DEFAULT_TZ;

  const bTime = new Date(bookingTime);
  const totalMinutes = partyServices.reduce((m, s) => m + s.duration_minutes, 0);
  const TAKEN = t("book.err_taken");

  if (isNaN(bTime.getTime()) || bTime.getTime() <= Date.now()) {
    return NextResponse.json({ error: t("book.err_past") }, { status: 400 });
  }
  if (!withinBusinessHours(barberHours?.business_hours ?? null, bTime, totalMinutes, tz)) {
    return NextResponse.json({ error: t("book.err_outside_hours") }, { status: 400 });
  }
  if (!(await isSlotFree(supabase, userId, bTime, totalMinutes))) {
    return NextResponse.json({ error: TAKEN }, { status: 409 });
  }

  // No-show protection: clients booking themselves save a card first (charged only when the cut is done).
  // The client can choose to pay in store instead.
  const needsCard = CLIENT_PAYMENTS && source !== "barber" && body.payment !== "store" && !!barberHours?.protection_enabled && !!barberHours?.stripe_charges_enabled && !!barberHours?.stripe_account_id;
  const setupIntentId = typeof body.setupIntentId === "string" ? body.setupIntentId : "";
  if (needsCard && !setupIntentId) {
    return NextResponse.json({ error: t("pay.card_required"), cardRequired: true }, { status: 402 });
  }

  const groupId = partySize > 1 ? crypto.randomUUID() : null;
  // Back to back, each person's cut taking its own time.
  const startMin = partyServices.map((_, i) => partyServices.slice(0, i).reduce((m, s) => m + s.duration_minutes, 0));
  const rows = partyServices.map((s, i) => ({
    user_id: userId,
    service_id: s.id,
    customer_phone: normalized,
    booking_time: new Date(bTime.getTime() + startMin[i] * 60 * 1000).toISOString(),
    status: "confirmed",
    source: source || "direct",
    ...(groupId ? { group_id: groupId } : {}),
  }));

  const { data: created, error: bookingError } = await supabase
    .from("bookings")
    .insert(rows)
    .select("id, booking_time")
    .order("booking_time", { ascending: true });

  if (bookingError?.code === "23505") {
    // Unique index on (user_id, booking_time): double tap or two people grabbing the same slot
    return NextResponse.json({ error: TAKEN }, { status: 409 });
  }
  if (bookingError || !created || created.length === 0) {
    console.error("Booking creation error:", bookingError);
    return NextResponse.json({ error: t("book.err_create") }, { status: 500 });
  }
  const createdIds = created.map((b) => b.id);

  // Two people can pass the check above at the same moment; re-check now that our rows exist.
  if (!(await isSlotFree(supabase, userId, bTime, totalMinutes, createdIds))) {
    await supabase.from("bookings").delete().in("id", createdIds);
    return NextResponse.json({ error: TAKEN }, { status: 409 });
  }

  if (needsCard) {
    let saved = false;
    try {
      saved = await attachCardToBookings(supabase, { userId, accountId: barberHours!.stripe_account_id!, setupIntentId, phone: normalized, bookingIds: createdIds });
    } catch (err) {
      console.error("[stripe:attach-card]", err);
    }
    if (!saved) {
      await supabase.from("bookings").delete().in("id", createdIds);
      return NextResponse.json({ error: t("pay.card_failed"), cardRequired: true }, { status: 402 });
    }
  }

  const booking = created[0];
  const serviceLabel = partyServices.map((s) => s.name).join(" + ");
  const clientName = firstName?.trim() || vipClient?.first_name || null;
  await supabase.from("activity_feed").insert({
    user_id: userId,
    event_type: "booking_created",
    client_name: clientName,
    client_phone: normalized,
    description: `${clientName || "New client"} booked ${serviceLabel}`,
    metadata: { booking_id: booking.id, group_id: groupId, party_size: partySize, service_name: serviceLabel, price: partyServices.reduce((sum, s) => sum + Number(s.price), 0), source: source || "direct" },
  });

  // Get barber info for confirmation SMS and barber notify
  const { data: barber } = await supabase
    .from("users")
    .select("phone_number, forwarding_number, business_name, first_name, booking_link, timezone, is_locked_out")
    .eq("user_id", userId)
    .single();

  const loyalty = await projectVisit(supabase, booking.id);
  const rewardDue = !!loyalty?.due;

  // Confirmation text (sendSMS skips anyone who replied STOP).
  if (barber?.phone_number) {
    const tz = barber.timezone || DEFAULT_TZ;
    // The weekday must match the template's language ("viernes", not "Friday", in a Spanish text).
    const dateStr = smsLanguage === "es" ? bTime.toLocaleDateString("es-US", { weekday: "long", timeZone: tz }) : formatCasualDate(bTime, tz);
    const timeStr = formatCasualTime(bTime, tz);
    const shopName = barber.business_name?.trim() || barber.first_name?.trim() || translate(smsLanguage === "es" ? "es" : "en", "book.your_barber");
    const manageLink = `${appUrl()}/manage/${booking.id}`;

    const confirmSms = await buildSMS({
      userId,
      templateKey: "booking_confirm",
      clientPhone: normalized,
      vars: {
        shop_name: shopName,
        date: dateStr,
        time: timeStr,
        link: manageLink,
        party: partySize > 1 ? `, party of ${partySize}` : "",
        party_es: partySize > 1 ? `, grupo de ${partySize}` : "",
        ...rewardVars(rewardDue, loyalty?.loyalty ?? DEFAULT_LOYALTY, loyalty?.rewardCents ?? 0),
      },
    });

    if (confirmSms) {
      try {
        await sendSMS({ to: normalized, from: barber.phone_number, body: confirmSms.body, userId, templateKey: "booking_confirm", language: confirmSms.language });
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
    const tz = barber.timezone || DEFAULT_TZ;
    const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const bookingLocal = new Date(bTime.toLocaleString("en-US", { timeZone: tz }));
    const isSameDay =
      nowLocal.getFullYear() === bookingLocal.getFullYear() &&
      nowLocal.getMonth() === bookingLocal.getMonth() &&
      nowLocal.getDate() === bookingLocal.getDate();

    if (isSameDay && nowLocal.getHours() >= 9) {
      const timeStr = formatCasualTime(bTime, tz);

      const notifySms = await buildSMS({
        userId,
        templateKey: "barber_booking_notify",
        clientPhone: normalized,
        vars: {
          customer_name: clientName || normalized,
          service: serviceLabel,
          time: timeStr,
        },
      });

      if (notifySms) {
        try {
          // A link straight to the booking on their schedule (the login is remembered on the phone).
          const body = `${notifySms.body}\n${scheduleLink(appUrl(), booking.id, bTime, tz)}`;
          await sendSMS({ to: barber.forwarding_number, from: barber.phone_number, body, userId, templateKey: "barber_booking_notify", language: notifySms.language, audience: "barber" });
        } catch (err) {
          console.error("Barber booking notify failed:", err);
        }
      }
    }
  }

  // Remember this device for next time. A typed phone number is unverified: the token
  // only ever shows back the name typed here, never what's on file for that number.
  let nextToken: string | null = null;
  if (session && sameClient && session.kind === "session") {
    nextToken = sessionToken;
    await touchToken(supabase, session.id);
  } else {
    nextToken = await issueToken(supabase, {
      userId,
      phone: normalized,
      kind: "session",
      verified: sameClient && !!session?.verified,
      displayName: firstName,
    });
  }

  return NextResponse.json({ success: true, bookingId: booking.id, bookingIds: createdIds, partySize, rewardDue, rewardCents: loyalty?.rewardCents ?? 0, rewardType: loyalty?.loyalty.reward ?? DEFAULT_LOYALTY.reward, sessionToken: nextToken });
}
