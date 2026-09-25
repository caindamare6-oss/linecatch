import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStickerCode } from "@/lib/sticker-codes";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { step, data } = body;
  const admin = createAdminClient();

  if (step === "profile") {
    const { error } = await admin
      .from("users")
      .update({
        business_name: data.businessName || null,
        accent_color: data.accentColor || "#00F5A0",
      })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save profile: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "info") {
    const { error } = await admin
      .from("users")
      .update({
        first_name: data.firstName || null,
        email: data.email || user.email || null,
        forwarding_number: data.phone || null,
      })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save info: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (step === "hours") {
    const { error } = await admin
      .from("users")
      .update({ business_hours: data.businessHours })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to save hours: ${error.message}` }, { status: 500 });
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

  if (step === "complete") {
    const { error } = await admin
      .from("users")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: `Failed to complete onboarding: ${error.message}` }, { status: 500 });
    }

    // Auto-create one sticker code for the new barber
    const stickerResult = await createStickerCode(user.id, "onboarding");
    if ("error" in stickerResult) {
      console.error("Failed to create onboarding sticker code:", stickerResult.error);
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
    .select("first_name, email, business_name, forwarding_number, accent_color, business_hours")
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
