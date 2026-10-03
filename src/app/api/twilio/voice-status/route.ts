import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio";
import { appUrl } from "@/lib/config";
import { handleMissedCall } from "@/lib/missed-call";

// Twilio runs whatever this returns on the caller's line (it's the <Dial action>), so it must be TwiML.
// Plain "OK" made the caller hear "an application error has occurred" after every missed call.
function done() {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = Object.fromEntries(formData.entries()) as Record<string, string>;

  const signature = request.headers.get("x-twilio-signature") || "";
  const url = `${appUrl()}/api/twilio/voice-status`;

  if (!validateTwilioRequest(signature, url, params)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const dialCallStatus = params.DialCallStatus || params.CallStatus;
  const to = params.To;
  const from = params.From;
  const callSid = params.CallSid || null;

  if (!["no-answer", "busy", "failed", "canceled"].includes(dialCallStatus)) {
    return done();
  }

  await handleMissedCall(createAdminClient(), { to, from, callSid });
  return done();
}
