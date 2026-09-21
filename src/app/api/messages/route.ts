import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTwilioClient } from "@/lib/twilio";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: barber } = await supabase
    .from("users")
    .select("phone_number")
    .eq("user_id", user.id)
    .single();

  if (!barber?.phone_number) {
    return NextResponse.json({ messages: [] });
  }

  const twilioClient = getTwilioClient();
  const barberPhone = barber.phone_number;

  const [sent, received] = await Promise.all([
    twilioClient.messages.list({ from: barberPhone, limit: 200 }),
    twilioClient.messages.list({ to: barberPhone, limit: 100 }),
  ]);

  const messages = [...sent, ...received].map((m) => ({
    sid: m.sid,
    from: m.from,
    to: m.to,
    body: m.body,
    status: m.status,
    direction: m.direction,
    dateSent: m.dateSent?.toISOString() || m.dateCreated.toISOString(),
  }));

  messages.sort(
    (a, b) => new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime()
  );

  return NextResponse.json({ messages });
}
