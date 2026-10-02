import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { summarizeClients } from "@/lib/clients";
import { toPlan } from "@/lib/loyalty-rules";
import { appUrl } from "@/lib/config";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function loadAll(supabase: Supa, userId: string, phone?: string) {
  let vipsQ = supabase.from("vip_clients").select("phone_number, first_name, is_opted_in, opted_out_at, cut_count, opt_in_source").eq("user_id", userId);
  let contactsQ = supabase.from("contacts").select("caller_phone, name, notes").eq("user_id", userId);
  let bookingsQ = supabase.from("bookings").select("id, customer_phone, booking_time, status, service_id").eq("user_id", userId);
  let optOutsQ = supabase.from("opt_outs").select("caller_phone").eq("user_id", userId);
  if (phone) {
    vipsQ = vipsQ.eq("phone_number", phone);
    contactsQ = contactsQ.eq("caller_phone", phone);
    bookingsQ = bookingsQ.eq("customer_phone", phone);
    optOutsQ = optOutsQ.eq("caller_phone", phone);
  }
  const [barber, vips, contacts, bookings, services, optOuts] = await Promise.all([
    supabase.from("users").select("plan").eq("user_id", userId).single(),
    vipsQ,
    contactsQ,
    bookingsQ.order("booking_time", { ascending: false }).limit(phone ? 200 : 5000),
    supabase.from("services").select("id, name, price").eq("user_id", userId),
    optOutsQ,
  ]);
  const prices = Object.fromEntries((services.data || []).map((s) => [s.id, Number(s.price)]));
  const serviceNames = Object.fromEntries((services.data || []).map((s) => [s.id, s.name as string]));
  const plan = toPlan(barber.data?.plan);
  const clients = summarizeClients({
    vips: vips.data || [],
    contacts: contacts.data || [],
    bookings: bookings.data || [],
    prices,
    optOuts: (optOuts.data || []).map((o) => o.caller_phone),
    plan,
  });
  return { clients, bookings: bookings.data || [], vips: vips.data || [], contacts: contacts.data || [], prices, serviceNames, plan };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("phone");
  if (!raw) {
    const { clients } = await loadAll(supabase, user.id);
    return NextResponse.json({ clients, vipLink: `${appUrl()}/vip/${user.id}` });
  }

  const p = normalizePhone(raw);
  if (!p.valid) return NextResponse.json({ error: p.error }, { status: 400 });
  const data = await loadAll(supabase, user.id, p.e164);
  const client = data.clients[0];
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const vip = data.vips[0];
  return NextResponse.json({
    client,
    barberId: user.id,
    notes: data.contacts[0]?.notes ?? "",
    source: vip?.opt_in_source ?? null,
    plan: data.plan,
    history: data.bookings.map((b) => ({
      id: b.id,
      time: b.booking_time,
      status: b.status,
      service: data.serviceNames[b.service_id] ?? "Service",
      price: data.prices[b.service_id] ?? 0,
    })),
  });
}

/** Barber edits the name or private notes for a client. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const p = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (!p.valid) return NextResponse.json({ error: p.error }, { status: 400 });

  const update: { user_id: string; caller_phone: string; name?: string | null; notes?: string | null } = { user_id: user.id, caller_phone: p.e164 };
  if ("name" in body) update.name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : null;
  if ("notes" in body) {
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > 1000) return NextResponse.json({ error: "Notes are limited to 1000 characters" }, { status: 400 });
    update.notes = notes || null;
  }

  const { error } = await supabase.from("contacts").upsert(update, { onConflict: "user_id,caller_phone" });
  if (error) {
    console.error("[clients PATCH]", error);
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
