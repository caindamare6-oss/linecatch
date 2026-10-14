import { appUrl } from "@/lib/config";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { cleanHandle, cleanHours, cleanOptionalPhone, cleanText, cleanUrl } from "@/lib/validate";
import { assignNumberSoon, missingSteps } from "@/lib/phone-numbers";
import { isCallMode, isCarrier } from "@/lib/call-mode";
import { detectCarrier } from "@/lib/carrier";
import { isMissedCallStyle } from "@/lib/missed-call-text";
import { REWARD_TYPES, type RewardType } from "@/lib/loyalty-rules";
import { MIN_FEE_PERCENT, MAX_FEE_PERCENT } from "@/lib/billing-rules";

const FIELDS =
  "first_name, email, business_name, phone_number, forwarding_number, instagram_handle, booking_link, custom_message, business_hours, timezone, feature_autotext, barber_language, accent_color, slug, cover_url, plan, is_locked_out, call_mode, missed_call_style, carrier, loyalty_enabled, loyalty_reward_type, protection_enabled, no_show_fee_percent";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data, error } = await supabase.from("users").select(FIELDS).eq("user_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Couldn't load settings" }, { status: 500 });
  // Until they have a LineCatch number: what's left before one is assigned.
  const admin = createAdminClient();
  const numberMissing = data.phone_number ? [] : await missingSteps(admin, user.id);
  // Find the barber's carrier once, so Settings can show the one forwarding code that works for them.
  if (data.forwarding_number && !data.carrier) {
    const carrier = await detectCarrier(data.forwarding_number);
    if (carrier) {
      await admin.from("users").update({ carrier }).eq("user_id", user.id).is("carrier", null);
      data.carrier = carrier;
    }
  }
  // Proof forwarding works: the last missed call that reached their LineCatch number.
  const { data: last } = await admin.from("missed_calls").select("received_at").eq("user_id", user.id).order("received_at", { ascending: false }).limit(1).maybeSingle();
  // Casual and Professional wording as the founder set it on Admin → Texts, for the Settings preview.
  const { data: presetRows } = await admin.from("message_templates").select("template_key, custom_message, custom_message_es").is("user_id", null).in("template_key", ["missed_call_casual", "missed_call_professional"]);
  const missedCallPresets = Object.fromEntries((presetRows || []).map((r) => [r.template_key.replace("missed_call_", ""), { en: r.custom_message, es: r.custom_message_es || r.custom_message }]));
  return NextResponse.json({ ...data, numberMissing, missedCallPresets, lastMissedCallAt: last?.received_at ?? null, user_id: user.id, email: data.email || user.email, isAdmin: isAdmin(user.id), appUrl: appUrl() });
}

/** Partial update: only the keys sent are validated and saved. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const update: Record<string, unknown> = {};
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

  if ("first_name" in body) update.first_name = cleanText(body.first_name, 40);
  if ("business_name" in body) update.business_name = cleanText(body.business_name, 60);
  if ("forwarding_number" in body) {
    const p = cleanOptionalPhone(body.forwarding_number);
    if (!p.ok) return bad(p.error);
    update.forwarding_number = p.value;
    // A new cell may be on another carrier: look it up again.
    const { data: cur } = await createAdminClient().from("users").select("forwarding_number").eq("user_id", user.id).maybeSingle();
    if (cur?.forwarding_number !== p.value) update.carrier = null;
  }
  if ("carrier" in body) {
    if (body.carrier !== null && !isCarrier(body.carrier)) return bad("Invalid carrier");
    update.carrier = body.carrier;
  }
  // Their Instagram: the button on their booking page.
  if ("instagram_handle" in body) {
    const h = cleanHandle(body.instagram_handle);
    if (!h.ok) return bad(h.error);
    update.instagram_handle = h.value;
  }
  if ("booking_link" in body) {
    const u = cleanUrl(body.booking_link);
    if (!u.ok) return bad(u.error);
    update.booking_link = u.value;
  }
  if ("custom_message" in body) {
    const msg = cleanText(body.custom_message, 300);
    if (!msg) return bad("Your missed-call text can't be empty");
    if (!msg.includes("{link}")) return bad("Keep {link} in the message so callers can book");
    update.custom_message = msg;
  }
  if ("missed_call_style" in body) {
    if (!isMissedCallStyle(body.missed_call_style)) return bad("Invalid text style");
    update.missed_call_style = body.missed_call_style;
  }
  if ("loyalty_enabled" in body) {
    if (typeof body.loyalty_enabled !== "boolean") return bad("Invalid request");
    update.loyalty_enabled = body.loyalty_enabled;
  }
  if ("loyalty_reward_type" in body) {
    if (!REWARD_TYPES.includes(body.loyalty_reward_type as RewardType)) return bad("Invalid request");
    update.loyalty_reward_type = body.loyalty_reward_type;
  }
  if ("protection_enabled" in body) {
    if (typeof body.protection_enabled !== "boolean") return bad("Invalid request");
    if (body.protection_enabled) {
      // Only once Stripe has verified them and they can take cards.
      const { data: acct } = await createAdminClient().from("users").select("stripe_charges_enabled").eq("user_id", user.id).single();
      if (!acct?.stripe_charges_enabled) return bad("payments.err_finish_setup");
    }
    update.protection_enabled = body.protection_enabled;
  }
  if ("no_show_fee_percent" in body) {
    const pct = Number(body.no_show_fee_percent);
    if (!Number.isInteger(pct) || pct < MIN_FEE_PERCENT || pct > MAX_FEE_PERCENT) return bad("payments.err_fee");
    update.no_show_fee_percent = pct;
  }
  if ("business_hours" in body) {
    const h = cleanHours(body.business_hours);
    if (!h.ok) return bad(h.error);
    update.business_hours = h.value;
  }
  for (const key of ["feature_autotext"] as const) {
    if (key in body) {
      if (typeof body[key] !== "boolean") return bad("Invalid toggle");
      update[key] = body[key];
    }
  }
  if ("call_mode" in body) {
    if (!isCallMode(body.call_mode)) return bad("Invalid call mode");
    update.call_mode = body.call_mode;
  }
  if ("barber_language" in body) {
    if (!["en", "es"].includes(body.barber_language)) return bad("Unsupported language");
    update.barber_language = body.barber_language;
  }
  // SMS marketing is the barber's call; texts still only reach clients who opted in.
  if (Object.keys(update).length === 0) return bad("Nothing to save");

  const admin = createAdminClient();
  const { error } = await admin.from("users").update(update).eq("user_id", user.id);
  if (error) {
    console.error("[settings]", error);
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  assignNumberSoon(user.id);
  return NextResponse.json({ ok: true, saved: update });
}
