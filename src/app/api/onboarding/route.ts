import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanAddress, requestSticker } from "@/lib/sticker-request";
import { cleanAccent, cleanHours, cleanOptionalPhone, cleanService, cleanText, cleanUrl } from "@/lib/validate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { step } = body;
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const admin = createAdminClient();

  if (step === "who") {
    const update: Record<string, unknown> = {};
    if (["en", "es", "pt"].includes(data.language)) update.barber_language = data.language;
    if (data.firstName !== undefined) update.first_name = cleanText(data.firstName, 40);
    // Only the offered accents are saved; a stale pick is ignored rather than failing the step.
    const accent = cleanAccent(data.accentColor);
    if (accent) update.accent_color = accent;

    const { error } = await admin
      .from("users")
      .update(update)
      .eq("user_id", user.id);

    if (error) {
      console.error("[onboarding]", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "business") {
    const phone = cleanOptionalPhone(data.phone);
    if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 });
    const { error } = await admin
      .from("users")
      .update({
        business_name: cleanText(data.businessName, 60),
        forwarding_number: phone.value,
        email: cleanText(data.email, 120) || user.email || null,
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("[onboarding]", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "services") {
    if (!Array.isArray(data.services) || data.services.length > 30) {
      return NextResponse.json({ error: "Invalid services" }, { status: 400 });
    }
    // Returns each row's id so the client can send it back on the next save (Back then Continue
    // must update, not insert a second copy).
    const ids: (string | null)[] = [];
    for (const svc of data.services) {
      const enabled = !!svc?.enabled;
      const isNew = !svc?.id;
      if (isNew && !enabled) {
        ids.push(null);
        continue;
      }
      const clean = cleanService(svc);
      if (!clean) {
        return NextResponse.json({ error: `Check the price and minutes for "${String(svc?.name || "a service").slice(0, 40)}"` }, { status: 400 });
      }
      const sortOrder = Number.isInteger(svc.sortOrder) ? svc.sortOrder : 0;
      if (!isNew) {
        // Scoped to this barber: a service id from someone else's shop matches nothing.
        const { error } = await admin
          .from("services")
          .update({ name: clean.name, price: clean.price, duration_minutes: clean.duration, is_active: enabled, sort_order: sortOrder })
          .eq("id", svc.id)
          .eq("user_id", user.id);
        if (error) {
          console.error("[onboarding]", error);
          return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
        }
        ids.push(svc.id);
      } else {
        const { data: row, error } = await admin
          .from("services")
          .insert({ user_id: user.id, name: clean.name, price: clean.price, duration_minutes: clean.duration, is_active: true, sort_order: sortOrder })
          .select("id")
          .single();
        if (error || !row) {
          console.error("[onboarding]", error);
          return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
        }
        ids.push(row.id);
      }
    }

    return NextResponse.json({ ok: true, ids });
  }

  if (step === "hours") {
    const hours = cleanHours(data.businessHours);
    if (!hours.ok) return NextResponse.json({ error: hours.error }, { status: 400 });
    const update: Record<string, unknown> = { business_hours: hours.value };
    if (typeof data.timezone === "string" && isTimeZone(data.timezone)) {
      update.timezone = data.timezone;
    }

    const { error } = await admin
      .from("users")
      .update(update)
      .eq("user_id", user.id);

    if (error) {
      console.error("[onboarding]", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "preferences") {
    const update: Record<string, unknown> = {};
    if (typeof data.featureAutotext === "boolean") update.feature_autotext = data.featureAutotext;
    if (typeof data.featureWednesday === "boolean") update.feature_wednesday = data.featureWednesday;
    if (typeof data.featureReviews === "boolean") update.feature_reviews = data.featureReviews;
    if (typeof data.featureMarketing === "boolean") {
      update.feature_marketing = data.featureMarketing;
      if (data.featureMarketing) {
        // Marketing needs the QR sticker at the chair, so we need somewhere to ship it.
        const addr = cleanAddress(data.shippingAddress);
        if (!addr.ok) return NextResponse.json({ error: addr.error }, { status: 400 });
        update.shipping_address = addr.value;
        await requestSticker(admin, user.id, addr.value);
      }
    }
    if (data.googleReviewUrl !== undefined) {
      const url = cleanUrl(data.googleReviewUrl);
      if (!url.ok) return NextResponse.json({ error: url.error }, { status: 400 });
      update.google_review_url = url.value;
    }

    const { error } = await admin
      .from("users")
      .update(update)
      .eq("user_id", user.id);

    if (error) {
      console.error("[onboarding]", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "complete") {
    const { error } = await admin
      .from("users")
      // Service texts work right away; marketing waits for the QR sticker (see lib/marketing).
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);

    if (error) {
      console.error("[onboarding]", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid step" }, { status: 400 });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select(
      "first_name, email, business_name, forwarding_number, accent_color, business_hours, barber_language, timezone, avatar_url, feature_autotext, feature_wednesday, feature_reviews, feature_marketing, shipping_address, google_review_url"
    )
    .eq("user_id", user.id)
    .single();

  const { data: services } = await admin
    .from("services")
    .select("id, name, price, duration_minutes, is_active, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  const googleName = user.user_metadata?.full_name || user.user_metadata?.name || "";
  const googleEmail = user.email || "";

  return NextResponse.json({
    profile: profile || {},
    services: services || [],
    googleName,
    googleEmail,
  });
}

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
