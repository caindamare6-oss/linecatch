import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { normalizePhone } from "@/lib/phone";
import { buildInbox, type SmsRow } from "@/lib/conversations";

const COLS = "id, to_number, from_number, direction, template_key, body, status, created_at";

async function nameMap(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [{ data: vips }, { data: contacts }] = await Promise.all([
    supabase.from("vip_clients").select("phone_number, first_name").eq("user_id", userId),
    supabase.from("contacts").select("caller_phone, name").eq("user_id", userId),
  ]);
  const names: Record<string, string> = {};
  for (const v of vips || []) if (v.first_name?.trim()) names[v.phone_number] = v.first_name.trim();
  for (const c of contacts || []) if (c.name?.trim()) names[c.caller_phone] = c.name.trim();
  return names;
}

/** Can the barber text this person a one-off message right now? */
async function canText(admin: ReturnType<typeof createAdminClient>, userId: string, phone: string) {
  const [{ data: vip }, { data: optOut }, { count: inbound }] = await Promise.all([
    admin.from("vip_clients").select("is_opted_in, opted_out_at").eq("user_id", userId).eq("phone_number", phone).maybeSingle(),
    admin.from("opt_outs").select("caller_phone").eq("user_id", userId).eq("caller_phone", phone).maybeSingle(),
    admin.from("sms_log").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("direction", "inbound").eq("from_number", phone),
  ]);
  if (optOut || vip?.opted_out_at) return { ok: false, reason: "They opted out of texts." };
  // Opted in, or they texted first: replying is a conversation, not marketing.
  if (vip?.is_opted_in || (inbound ?? 0) > 0) return { ok: true, reason: null };
  return { ok: false, reason: "They haven't opted in to texts yet. Send them your VIP link in person." };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const phoneParam = url.searchParams.get("phone");
  const names = await nameMap(supabase, user.id);

  if (phoneParam) {
    const p = normalizePhone(phoneParam);
    if (!p.valid) return NextResponse.json({ error: p.error }, { status: 400 });
    const phone = p.e164;
    const [{ data: out }, { data: inb }, allowed] = await Promise.all([
      supabase.from("sms_log").select(COLS).eq("user_id", user.id).eq("direction", "outbound").eq("to_number", phone).order("created_at", { ascending: false }).limit(200),
      supabase.from("sms_log").select(COLS).eq("user_id", user.id).eq("direction", "inbound").eq("from_number", phone).order("created_at", { ascending: false }).limit(200),
      canText(createAdminClient(), user.id, phone),
    ]);
    const messages = [...(out || []), ...(inb || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json({ phone, name: names[phone] || null, messages, canText: allowed.ok, cantTextReason: allowed.reason });
  }

  const filter = (["all", "sent", "received"] as const).find((f) => f === url.searchParams.get("filter")) ?? "all";
  const { data: rows, error } = await supabase
    .from("sms_log")
    .select(COLS)
    .eq("user_id", user.id)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(600);
  if (error) {
    console.error("[messages]", error);
    return NextResponse.json({ error: "Couldn't load messages" }, { status: 500 });
  }
  return NextResponse.json({ items: buildInbox((rows || []) as SmsRow[], names, filter) });
}

/** One-off text from the barber to a client, from the shop's LineCatch number. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { phone: rawPhone, body: rawBody } = await request.json().catch(() => ({}));
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (!body || body.length > 320) return NextResponse.json({ error: "Message must be 1–320 characters" }, { status: 400 });
  const p = normalizePhone(typeof rawPhone === "string" ? rawPhone : "");
  if (!p.valid) return NextResponse.json({ error: p.error }, { status: 400 });

  const admin = createAdminClient();
  const { data: barber } = await admin.from("users").select("phone_number, is_locked_out").eq("user_id", user.id).single();
  if (!barber?.phone_number) return NextResponse.json({ error: "Your LineCatch number isn't set up yet" }, { status: 400 });
  if (barber.is_locked_out) return NextResponse.json({ error: "Texting is paused on your account. Contact support." }, { status: 402 });

  const allowed = await canText(admin, user.id, p.e164);
  if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: 403 });

  const sent = await sendSMS({ to: p.e164, from: barber.phone_number, body, userId: user.id, templateKey: "direct", language: "en" });
  if (!sent) return NextResponse.json({ error: "Text didn't send. Try again in a minute." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

