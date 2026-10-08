import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applyReferral, ensureReferralCode, qualifyReferral, HEARD_FROM, REF_COOKIE, normalizeCode } from "@/lib/referrals";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanAddress, requestSticker } from "@/lib/sticker-request";
import { claimSticker, pendingSticker, STICKER_COOKIE } from "@/lib/sticker-claim";
import { cleanAccent, cleanHours, cleanOptionalPhone, cleanService, cleanText, cleanUrl } from "@/lib/validate";
import { assignNumberSoon } from "@/lib/phone-numbers";
import { THEME_IDS } from "@/lib/themes";

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
    if (HEARD_FROM.includes(data.heardFrom)) update.referral_source = data.heardFrom;
    if (typeof data.referralCode === "string" && data.referralCode.trim()) {
      const r = await applyReferral(admin, user.id, data.referralCode);
      if (!r.ok) return NextResponse.json({ error: r.error, field: "referralCode" }, { status: 400 });
    }
    if (["en", "es"].includes(data.language)) update.barber_language = data.language;
    if (data.firstName !== undefined) update.first_name = cleanText(data.firstName, 40);
    // Only the offered accents are saved; a stale pick is ignored rather than failing the step.
    // null means "use my theme's own color".
    const accent = cleanAccent(data.accentColor);
    if (accent) update.accent_color = accent;
    else if (data.accentColor === null) update.accent_color = null;
    // Their colors: the portfolio, booking pages and their own app all use this theme.
    if (THEME_IDS.includes(data.theme)) update.theme = data.theme;

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
          .update({ name: clean.name, description: clean.description, price: clean.price, duration_minutes: clean.duration, is_active: enabled, sort_order: sortOrder })
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
          .insert({ user_id: user.id, name: clean.name, description: clean.description, price: clean.price, duration_minutes: clean.duration, is_active: true, sort_order: sortOrder })
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
    if (typeof data.featureMarketing === "boolean") update.feature_marketing = data.featureMarketing;
    // Optional paid add-on: a QR sticker for the chair, only when they chose it.
    if (data.wantsSticker === true) {
      const addr = cleanAddress(data.shippingAddress);
      if (!addr.ok) return NextResponse.json({ error: addr.error }, { status: 400 });
      update.shipping_address = addr.value;
      await requestSticker(admin, user.id, addr.value);
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
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);

    if (error) {
      console.error("[onboarding]", error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    // Their own code for referring others, and the referral (if any) now counts.
    await ensureReferralCode(admin, user.id);
    await qualifyReferral(admin, user.id);

    // A sticker handed to them in person connects now. If it can't (someone else set it up first),
    // setup still finishes; the sticker is optional.
    const jar = await cookies();
    let sticker: string | null = null;
    const pending = jar.get(STICKER_COOKIE)?.value;
    if (pending) {
      const claimed = await claimSticker(admin, user.id, pending);
      if (claimed.ok) sticker = claimed.code;
      jar.delete(STICKER_COOKIE);
    }
    assignNumberSoon(user.id);
    return NextResponse.json({ ok: true, sticker });
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
      "first_name, email, business_name, forwarding_number, theme, accent_color, business_hours, barber_language, timezone, cover_url, feature_autotext, feature_wednesday, feature_reviews, feature_marketing, shipping_address, google_review_url, referral_source, referred_by"
    )
    .eq("user_id", user.id)
    .single();

  const { data: services } = await admin
    .from("services")
    .select("id, name, description, price, duration_minutes, is_active, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  const googleName = user.user_metadata?.full_name || user.user_metadata?.name || "";
  const googleEmail = user.email || "";

  // A code from a share link (/join/CODE) waits in a cookie until signup.
  const jar = await cookies();
  const pendingCode = normalizeCode(jar.get(REF_COOKIE)?.value);
  // A sticker handed out in person (/s/CODE → "Set up my shop"): shorter setup, no address.
  const sticker = await pendingSticker(admin, jar.get(STICKER_COOKIE)?.value);
  let referral: { code: string; name: string | null } | null = null;
  if (profile?.referred_by) {
    const [{ data: ref }, { data: who }] = await Promise.all([
      admin.from("referrals").select("code").eq("referred_user_id", user.id).maybeSingle(),
      admin.from("users").select("business_name, first_name").eq("user_id", profile.referred_by).maybeSingle(),
    ]);
    if (ref) referral = { code: ref.code, name: who?.business_name || who?.first_name || null };
  }

  return NextResponse.json({
    profile: profile || {},
    services: services || [],
    googleName,
    googleEmail,
    pendingCode,
    referral,
    sticker,
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
