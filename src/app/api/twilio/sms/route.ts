import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio";

const STOP_KEYWORDS_EN = ["stop", "unsubscribe", "cancel", "end", "quit"];
const STOP_KEYWORDS_ES = ["parar", "alto", "salir", "cancelar"];
const STOP_KEYWORDS_PT = ["sair", "cancelar"];
const START_KEYWORDS = ["start", "unstop"];

const LANGUAGE_KEYWORDS: Record<string, string> = {
  en: "en", english: "en",
  es: "es", spanish: "es",
  pt: "pt", portuguese: "pt",
};

const OPT_OUT_REPLIES: Record<string, string> = {
  en: "You've been unsubscribed. You will not receive further texts. Reply START to resubscribe.",
  es: "Te has dado de baja. No recibirás más mensajes. Responde START para volver a suscribirte.",
  pt: "Você foi descadastrado. Não receberá mais mensagens. Responda START para se reinscrever.",
};

const OPT_IN_REPLIES: Record<string, string> = {
  en: "You've been resubscribed. You'll receive texts again.",
  es: "Te has vuelto a suscribir. Recibirás mensajes de nuevo.",
  pt: "Você foi reinscrito. Receberá mensagens novamente.",
};

const LANGUAGE_CHANGE_REPLIES: Record<string, string> = {
  en: "Language set to English. Future messages will be in English.",
  es: "Idioma cambiado a español. Los mensajes futuros serán en español.",
  pt: "Idioma alterado para português. Mensagens futuras serão em português.",
};

const HELP_REPLY = "LineCatch: appointment reminders & updates. Reply STOP to opt out. Contact: caindamare6@gmail.com";

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  const signature = request.headers.get("x-twilio-signature") || "";
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/sms`;

  if (!validateTwilioRequest(signature, url, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const from = params.From;
  const to = params.To;
  const body = (params.Body || "").trim().toLowerCase();

  const supabase = createAdminClient();

  const { data: barber } = await supabase
    .from("users")
    .select("user_id, is_locked_out")
    .eq("phone_number", to)
    .single();

  if (!barber) {
    return twimlResponse("");
  }

  // STOP/HELP always process regardless of lockout (carrier obligations)

  // Determine opt-out language
  let optOutLang: string | null = null;
  if (STOP_KEYWORDS_EN.includes(body)) {
    optOutLang = "en";
  } else if (body === "cancelar") {
    // Ambiguous: valid in both ES and PT. Use client's existing language, default to ES.
    const { data: langClient } = await supabase
      .from("vip_clients")
      .select("client_language")
      .eq("user_id", barber.user_id)
      .eq("phone_number", from)
      .single();
    optOutLang = langClient?.client_language === "pt" ? "pt" : "es";
  } else if (STOP_KEYWORDS_ES.includes(body)) {
    optOutLang = "es";
  } else if (STOP_KEYWORDS_PT.includes(body)) {
    optOutLang = "pt";
  }

  if (optOutLang) {
    await handleOptOut(supabase, barber.user_id, from, optOutLang);
    return twimlResponse(OPT_OUT_REPLIES[optOutLang]);
  }

  // HELP
  if (body === "help") {
    return twimlResponse(HELP_REPLY);
  }

  // START / re-subscribe
  if (START_KEYWORDS.includes(body)) {
    await supabase
      .from("opt_outs")
      .delete()
      .eq("user_id", barber.user_id)
      .eq("caller_phone", from);

    await supabase
      .from("vip_clients")
      .update({ opted_out_at: null })
      .eq("user_id", barber.user_id)
      .eq("phone_number", from);

    const { data: client } = await supabase
      .from("vip_clients")
      .select("client_language")
      .eq("user_id", barber.user_id)
      .eq("phone_number", from)
      .single();

    const lang = client?.client_language || "en";
    return twimlResponse(OPT_IN_REPLIES[lang] || OPT_IN_REPLIES.en);
  }

  // LATE — barber broadcasts delay to today's booked clients
  if (body === "late" && !barber.is_locked_out) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("customer_phone")
      .eq("user_id", barber.user_id)
      .eq("status", "confirmed")
      .gte("booking_time", dayStart.toISOString())
      .lte("booking_time", dayEnd.toISOString());

    if (todayBookings && todayBookings.length > 0) {
      const { data: barberInfo } = await supabase
        .from("users")
        .select("business_name, phone_number")
        .eq("user_id", barber.user_id)
        .single();

      const shopName = barberInfo?.business_name || "Your barber";
      const { buildSMS, markFirstMessageSent } = await import("@/lib/messages");
      const { sendSMS } = await import("@/lib/twilio");

      const phones = [...new Set(todayBookings.map((b) => b.customer_phone))];
      let broadcastCount = 0;

      for (const phone of phones) {
        const { data: vip } = await supabase
          .from("vip_clients")
          .select("is_opted_in, opted_out_at")
          .eq("user_id", barber.user_id)
          .eq("phone_number", phone)
          .single();

        if (!vip || !vip.is_opted_in || vip.opted_out_at) continue;

        const msg = await buildSMS({
          userId: barber.user_id,
          templateKey: "morning_late_broadcast",
          clientPhone: phone,
          vars: { shop_name: shopName },
        });

        if (msg && barberInfo) {
          try {
            await sendSMS(phone, barberInfo.phone_number, msg);
            await markFirstMessageSent(barber.user_id, phone);
            broadcastCount++;
          } catch (err) {
            console.error(`Late broadcast failed for ${phone}:`, err);
          }
        }
      }

      return twimlResponse(`Got it! Sent a heads-up to ${broadcastCount} client${broadcastCount !== 1 ? "s" : ""}.`);
    }

    return twimlResponse("No bookings found for today.");
  }

  // Language change — only process if not locked out
  if (!barber.is_locked_out && LANGUAGE_KEYWORDS[body]) {
    const newLang = LANGUAGE_KEYWORDS[body];
    await supabase
      .from("vip_clients")
      .update({ client_language: newLang })
      .eq("user_id", barber.user_id)
      .eq("phone_number", from);

    return twimlResponse(LANGUAGE_CHANGE_REPLIES[newLang] || LANGUAGE_CHANGE_REPLIES.en);
  }

  return twimlResponse("");
}

async function handleOptOut(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  callerPhone: string,
  language: string
) {
  // Legacy opt_outs table
  await supabase.from("opt_outs").upsert(
    {
      user_id: userId,
      caller_phone: callerPhone,
      opted_out_at: new Date().toISOString(),
    },
    { onConflict: "user_id,caller_phone" }
  );

  // vip_clients opted_out_at
  await supabase
    .from("vip_clients")
    .update({
      opted_out_at: new Date().toISOString(),
      client_language: language,
    })
    .eq("user_id", userId)
    .eq("phone_number", callerPhone);
}

function twimlResponse(message: string) {
  const body = message
    ? `<Message>${escapeXml(message)}</Message>`
    : "";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>${body}</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
