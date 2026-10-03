import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { fixWebhooks, twilioStatus } from "@/lib/twilio-setup";

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isAdmin(user.id);
}

/** Founder only: is Twilio connected, and is every barber's number wired to this app? */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json(await twilioStatus(createAdminClient()));
}

/** Founder only: point every barber's number at this app's call and text webhooks. */
export async function POST() {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const db = createAdminClient();
  const result = await fixWebhooks(db);
  return NextResponse.json({ ...result, status: await twilioStatus(db) });
}
