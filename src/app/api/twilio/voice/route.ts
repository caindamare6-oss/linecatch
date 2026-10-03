import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioRequest } from "@/lib/twilio";
import { appUrl } from "@/lib/config";

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
    .select("forwarding_number, is_active")
    .eq("phone_number", to)
    .single();

  if (!barber || !barber.is_active || !barber.forwarding_number) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not available right now. Please try again later.</Say>
</Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const statusCallbackUrl = `${appUrl()}/api/twilio/voice-status`;
  // Ring the barber for 15 seconds. Most cell voicemail picks up around 20–25 seconds, and a call
  // voicemail answers counts as "answered", so a longer ring would skip the missed-call text.

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="15" action="${statusCallbackUrl}">
    <Number>${barber.forwarding_number}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
