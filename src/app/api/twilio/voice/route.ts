import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio";
import { appUrl } from "@/lib/config";
import { handleMissedCall } from "@/lib/missed-call";
import { forwardedCallLine, numberChangedLine, type CallLang } from "@/lib/call-mode";

function twiml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${body}\n</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

const say = (lang: CallLang, text: string) => `  <Say language="${lang === "es" ? "es-MX" : "en-US"}">${text}</Say>`;

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  const signature = request.headers.get("x-twilio-signature") || "";
  const url = `${appUrl()}/api/twilio/voice`;

  if (!validateTwilioRequest(signature, url, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const to = params.To;
  const supabase = createAdminClient();

  const { data: barber } = await supabase
    .from("users")
    .select("forwarding_number, is_active, call_mode, barber_language")
    .eq("phone_number", to)
    .maybeSingle();

  if (!barber || !barber.is_active) {
    // A number recently freed from a barber who left: tell their old clients it changed.
    const { data: pooled } = await supabase.from("phone_numbers").select("phone").eq("phone", to).is("assigned_user_id", null).maybeSingle();
    return twiml(`${say("en", pooled ? numberChangedLine("en") : "Sorry, this number is not available right now. Please try again later.")}\n  <Hangup/>`);
  }

  const lang: CallLang = barber.barber_language === "es" ? "es" : "en";

  // Forwarded mode: the barber's own phone already rang and wasn't answered, and the carrier sent
  // the call here. Never dial the barber again (it would loop back through the forward): text the
  // caller now, tell them in one short line, and hang up. Twilio keeps the original caller in From.
  if (barber.call_mode !== "direct") {
    const outcome = await handleMissedCall(supabase, { to, from: params.From, callSid: params.CallSid || null });
    // cooldown / no_consent: the link was texted to them before, so it's already on their phone.
    const line = outcome === "texted" ? "texted" : outcome === "cooldown" || outcome === "no_consent" ? "already" : "none";
    const spoken = forwardedCallLine(lang, line);
    return twiml(`${spoken ? `${say(lang, spoken)}\n` : ""}  <Hangup/>`);
  }

  // Direct mode: clients call the LineCatch number, which rings the barber's cell first.
  if (!barber.forwarding_number) {
    return twiml(`${say("en", "Sorry, this number is not available right now. Please try again later.")}`);
  }

  const statusCallbackUrl = `${appUrl()}/api/twilio/voice-status`;
  // Ring the barber for 15 seconds. Most cell voicemail picks up around 20–25 seconds, and a call
  // voicemail answers counts as "answered", so a longer ring would skip the missed-call text.
  return twiml(`  <Dial timeout="15" action="${statusCallbackUrl}">
    <Number>${barber.forwarding_number}</Number>
  </Dial>`);
}
