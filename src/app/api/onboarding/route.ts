import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { step, data } = body;
  const admin = createAdminClient();

  if (step === "who") {
    const update: Record<string, unknown> = {};
    if (data.language) update.barber_language = data.language;
    if (data.firstName !== undefined) update.first_name = data.firstName || null;

    const { error } = await admin
      .from("users")
      .update(update)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "business") {
    const { error } = await admin
      .from("users")
      .update({
        business_name: data.businessName || null,
        forwarding_number: data.phone || null,
        email: data.email || user.email || null,
      })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "services") {
    for (const svc of data.services) {
      if (svc.id) {
        const { error } = await admin
          .from("services")
          .update({
            name: svc.name,
            price: svc.price,
            duration_minutes: svc.duration,
            is_active: svc.enabled,
          })
          .eq("id", svc.id);

        if (error) {
          return NextResponse.json({ error: `Failed to update service "${svc.name}": ${error.message}` }, { status: 500 });
        }
      } else {
        const { error } = await admin.from("services").insert({
          user_id: user.id,
          name: svc.name,
          price: svc.price,
          duration_minutes: svc.duration,
          is_active: svc.enabled,
          sort_order: svc.sortOrder || 0,
        });

        if (error) {
          return NextResponse.json({ error: `Failed to create service "${svc.name}": ${error.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (step === "hours") {
    const update: Record<string, unknown> = {
      business_hours: data.businessHours,
    };
    if (data.timezone) {
      update.timezone = data.timezone;
    }

    const { error } = await admin
      .from("users")
      .update(update)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "preferences") {
    const update: Record<string, unknown> = {};
    if (typeof data.featureAutotext === "boolean") update.feature_autotext = data.featureAutotext;
    if (typeof data.featureWednesday === "boolean") update.feature_wednesday = data.featureWednesday;
    if (typeof data.featureReviews === "boolean") update.feature_reviews = data.featureReviews;
    if (data.googleReviewUrl !== undefined) update.google_review_url = data.googleReviewUrl || null;

    const { error } = await admin
      .from("users")
      .update(update)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "complete") {
    const { error } = await admin
      .from("users")
      .update({ onboarding_completed: true, is_locked_out: true })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to complete onboarding: ${error.message}` }, { status: 500 });
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
      "first_name, email, business_name, forwarding_number, accent_color, business_hours, barber_language, timezone, avatar_url, feature_autotext, feature_wednesday, feature_reviews, google_review_url"
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
