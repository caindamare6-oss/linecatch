import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { cleanHours, cleanOptionalPhone, cleanText, cleanUrl } from "@/lib/validate";

const FIELDS =
  "first_name, email, business_name, phone_number, forwarding_number, google_review_url, booking_link, custom_message, business_hours, timezone, feature_autotext, feature_wednesday, feature_reviews, barber_language, accent_color, slug, winback_offer, plan, is_locked_out";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data, error } = await supabase.from("users").select(FIELDS).eq("user_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Couldn't load settings" }, { status: 500 });
  return NextResponse.json({ ...data, user_id: user.id, email: data.email || user.email, isAdmin: isAdmin(user.id), appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://linecatch.app" });
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
  if ("barber_language" in body) {
    if (!["en", "es", "pt"].includes(body.barber_language)) return bad("Unsupported language");
    update.barber_language = body.barber_language;
  }
  if (update.feature_reviews === true && !("google_review_url" in update)) {
    const { data } = await supabase.from("users").select("google_review_url").eq("user_id", user.id).single();
    if (!data?.google_review_url) return bad("Add your Google review link first");
  }
  if (Object.keys(update).length === 0) return bad("Nothing to save");

  const { error } = await createAdminClient().from("users").update(update).eq("user_id", user.id);
  if (error) {
    console.error("[settings]", error);
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: update });
}
