import { appUrl } from "@/lib/config";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { cleanHours, cleanOptionalPhone, cleanText, cleanUrl } from "@/lib/validate";
import { hasActiveSticker, marketingState } from "@/lib/marketing";
import { cleanAddress, requestSticker } from "@/lib/sticker-request";
import { assignNumberSoon, missingSteps } from "@/lib/phone-numbers";
import { isCallMode, isCarrier } from "@/lib/call-mode";
import { detectCarrier } from "@/lib/carrier";
import { isMissedCallStyle } from "@/lib/missed-call-text";
import { MIN_REWARD_CENTS, MAX_REWARD_CENTS } from "@/lib/loyalty-rules";

const FIELDS =
  "first_name, email, business_name, phone_number, forwarding_number, google_review_url, booking_link, custom_message, business_hours, timezone, feature_autotext, feature_wednesday, feature_reviews, barber_language, accent_color, slug, winback_offer, plan, is_locked_out, feature_marketing, shipping_address, sticker_requested_at, call_mode, missed_call_style, carrier, loyalty_enabled, loyalty_reward_cents";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data, error } = await supabase.from("users").select(FIELDS).eq("user_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Couldn't load settings" }, { status: 500 });
  const sticker = await hasActiveSticker(createAdminClient(), user.id);
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
  return NextResponse.json({ ...data, numberMissing, missedCallPresets, lastMissedCallAt: last?.received_at ?? null, hasActiveSticker: sticker, marketing: marketingState(data.feature_marketing), user_id: user.id, email: data.email || user.email, isAdmin: isAdmin(user.id), appUrl: appUrl() });
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
  if ("google_review_url" in body) {
    const u = cleanUrl(body.google_review_url);
    if (!u.ok) return bad(u.error);
    update.google_review_url = u.value;
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
  if ("loyalty_reward_cents" in body) {
    const c = Number(body.loyalty_reward_cents);
    if (!Number.isInteger(c) || c < MIN_REWARD_CENTS || c > MAX_REWARD_CENTS) return bad("The reward must be between $1 and $50");
    update.loyalty_reward_cents = c;
  }
  if ("winback_offer" in body) update.winback_offer = cleanText(body.winback_offer, 40);
  if ("business_hours" in body) {
    const h = cleanHours(body.business_hours);
    if (!h.ok) return bad(h.error);
    update.business_hours = h.value;
  }
  for (const key of ["feature_autotext", "feature_wednesday", "feature_reviews"] as const) {
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
  if (update.feature_reviews === true && !("google_review_url" in update)) {
    const { data } = await supabase.from("users").select("google_review_url").eq("user_id", user.id).single();
    if (!data?.google_review_url) return bad("Add your Google review link first");
  }
  // Optional paid QR sticker add-on: ordered with request_sticker plus a shop address.
  let shipTo: Parameters<typeof requestSticker>[2] | null = null;
  if ("shipping_address" in body) {
    const a = cleanAddress(body.shipping_address);
    if (!a.ok) return bad(a.error);
    update.shipping_address = a.value;
    shipTo = a.value;
  }
  // SMS marketing is the barber's call; texts still only reach clients who opted in.
  if ("feature_marketing" in body) {
    if (typeof body.feature_marketing !== "boolean") return bad("Invalid toggle");
    update.feature_marketing = body.feature_marketing;
    if (body.feature_marketing) update.feature_wednesday = true;
    if (!body.feature_marketing) {
      // Marketing off also stops the marketing automations.
      update.feature_wednesday = false;
      update.feature_reviews = false;
    }
  }
  if (Object.keys(update).length === 0) return bad("Nothing to save");

  const admin = createAdminClient();
  const { error } = await admin.from("users").update(update).eq("user_id", user.id);
  if (error) {
    console.error("[settings]", error);
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  if (shipTo && body.request_sticker === true) await requestSticker(admin, user.id, shipTo);
  assignNumberSoon(user.id);
  return NextResponse.json({ ok: true, saved: update });
}
