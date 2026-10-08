import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio";
import { keyword } from "@/lib/opt-out";
import { barberLocalToUTC } from "@/lib/format";
import { localParts } from "@/lib/revenue";
import { issueToken } from "@/lib/client-session";
import { SUPPORT_EMAIL, DEFAULT_TZ, appUrl } from "@/lib/config";

const AUTO_REPLY_COOLDOWN_HOURS = 12;

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

function helpReply(shop: string, lang: string) {
  return lang === "es"
    ? `${shop}: recordatorios y avisos de tus citas por LineCatch. Responde STOP para no recibir más mensajes. Ayuda: ${SUPPORT_EMAIL}`
    : `${shop}: appointment reminders & updates via LineCatch. Reply STOP to opt out. Help: ${SUPPORT_EMAIL}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  const signature = request.headers.get("x-twilio-signature") || "";
  const url = `${appUrl()}/api/twilio/sms`;

  if (!validateTwilioRequest(signature, url, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const from = params.From;
  const to = params.To;
  const rawBody = (params.Body || "").trim();
  // Keywords match the whole message, ignoring case and punctuation: "Stop.", "STOP!" and " stop " all count.
  const body = keyword(rawBody);

  const supabase = createAdminClient();

  const { data: barber } = await supabase
    .from("users")
    .select("user_id, is_locked_out, forwarding_number, timezone, business_name, first_name")
    .eq("phone_number", to)
    .single();

  if (!barber) {
    return twimlResponse("");
  }

  // The barber texting their own LineCatch number (e.g. LATE) isn't a client conversation.
  const fromBarber = !!barber.forwarding_number && from === barber.forwarding_number;
  if (!fromBarber && rawBody) {
    await supabase.from("sms_log").insert({
      user_id: barber.user_id,
      direction: "inbound",
      from_number: from,
      to_number: to,
      body: rawBody.slice(0, 1600),
      status: "received",
      template_key: null,
      language: null,
    });
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
  if (body === "help" || body === "ayuda") {
    const { data: c } = await supabase.from("vip_clients").select("client_language").eq("user_id", barber.user_id).eq("phone_number", from).maybeSingle();
    return twimlResponse(helpReply(barber.business_name || barber.first_name || "LineCatch", body === "ayuda" ? "es" : c?.client_language || "en"));
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

  // LATE — the barber (texting from their own cell) warns today's clients they're behind.
  // A client texting "late" about themselves must never trigger this.
  if (body === "late" && fromBarber && !barber.is_locked_out) {
    const tz = barber.timezone || DEFAULT_TZ;
    const { year, month, day } = localParts(new Date(), tz);
    const today = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayStart = barberLocalToUTC(today, "00:00", tz);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const { data: todayBookings } = await supabase
      .from("bookings")
      .select("customer_phone")
      .eq("user_id", barber.user_id)
      .eq("status", "confirmed")
      .gte("booking_time", new Date().toISOString())
      .lte("booking_time", dayEnd.toISOString());

    if (todayBookings && todayBookings.length > 0) {
      const { data: barberInfo } = await supabase
        .from("users")
        .select("business_name, first_name, phone_number")
        .eq("user_id", barber.user_id)
        .single();

      const shopName = barberInfo?.business_name?.trim() || barberInfo?.first_name?.trim() || "Your barber";
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

        const sms = await buildSMS({
          userId: barber.user_id,
          templateKey: "morning_late_broadcast",
          clientPhone: phone,
          vars: { shop_name: shopName },
        });

        if (sms && barberInfo) {
          try {
            await sendSMS({ to: phone, from: barberInfo.phone_number, body: sms.body, userId: barber.user_id, templateKey: "morning_late_broadcast", language: sms.language });
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

  if (!fromBarber && !barber.is_locked_out) {
    const reply = await autoReply(supabase, barber.user_id, from);
    if (reply) return twimlResponse(reply);
  }

  return twimlResponse("");
}

/**
 * A client texted something that isn't a keyword. Point them at their booking (or the booking page)
 * so "can I move my 3pm?" gets an answer even while the barber is cutting. Once per 12 hours per client.
 */
async function autoReply(supabase: ReturnType<typeof createAdminClient>, userId: string, phone: string): Promise<string | null> {
  const since = new Date(Date.now() - AUTO_REPLY_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const [{ data: vip }, { data: optOut }, { count: recent }] = await Promise.all([
    supabase.from("vip_clients").select("opted_out_at").eq("user_id", userId).eq("phone_number", phone).maybeSingle(),
    supabase.from("opt_outs").select("caller_phone").eq("user_id", userId).eq("caller_phone", phone).maybeSingle(),
    supabase.from("sms_log").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("to_number", phone).eq("template_key", "auto_reply_inbound").gte("created_at", since),
  ]);
  if (optOut || vip?.opted_out_at || (recent ?? 0) > 0) return null;

  const app = appUrl();
  const { data: next } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", userId)
    .eq("customer_phone", phone)
    .eq("status", "confirmed")
    .gt("booking_time", new Date().toISOString())
    .order("booking_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  let link: string;
  if (next) {
    link = `${app}/manage/${next.id}`;
  } else {
    // Texting from the phone proves who they are, so the link can recognize them.
    const token = await issueToken(supabase, { userId, phone, kind: "link", verified: true });
    link = `${app}/book/${userId}?src=sms_reply${token ? `&t=${token}` : ""}`;
  }

  const { buildSMS } = await import("@/lib/messages");
  const sms = await buildSMS({ userId, templateKey: "auto_reply_inbound", clientPhone: phone, vars: { link } });
  if (!sms) return null;

  // Logged like any other outbound text so it shows in the thread and counts toward the cooldown.
  await supabase.from("sms_log").insert({
    user_id: userId,
    to_number: phone,
    template_key: "auto_reply_inbound",
    language: sms.language,
    body: sms.body,
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  return sms.body;
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
      reason: "client_stop",
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
