import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { createStickerBatch } from "@/lib/sticker-codes";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.id)) {
    return null;
  }
  return user;
}

export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const batch = searchParams.get("batch");

  const admin = createAdminClient();
  let query = admin
    .from("sticker_codes")
    .select("code, owner_user_id, status, claimed_at, created_at, batch_label, tracking_number, shipped_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (status) query = query.eq("status", status);
  if (batch) query = query.eq("batch_label", batch);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch barber names for display
  const ownerIds = [...new Set((data || []).map((d) => d.owner_user_id).filter(Boolean))];
  let barbers: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: users } = await admin
      .from("users")
      .select("user_id, business_name, first_name, email")
      .in("user_id", ownerIds);

    if (users) {
      for (const u of users) {
        barbers[u.user_id] = u.business_name || u.first_name || u.email || u.user_id;
      }
    }
  }

  return NextResponse.json({ codes: data || [], barbers });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;
  const admin = createAdminClient();

  if (action === "generate") {
    const { count, batchLabel } = body;
    if (!count || count < 1 || count > 500) {
      return NextResponse.json({ error: "Count must be 1-500" }, { status: 400 });
    }
    if (!batchLabel || typeof batchLabel !== "string") {
      return NextResponse.json({ error: "Batch label is required" }, { status: 400 });
    }

    const result = await createStickerBatch(count, batchLabel.trim());
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.linecatch.app";
    const csv = [
      "code,url",
      ...result.codes.map((c) => `${c},${baseUrl}/s/${c}`),
    ].join("\n");

    return NextResponse.json({ codes: result.codes, csv });
  }

  if (action === "reassign") {
    const { code, newOwnerUserId } = body;
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = newOwnerUserId
      ? { owner_user_id: newOwnerUserId, status: "active", claimed_at: new Date().toISOString() }
      : { owner_user_id: null, status: "unclaimed", claimed_at: null };

    const { error } = await admin
      .from("sticker_codes")
      .update(updateData)
      .eq("code", code);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "assign_and_ship") {
    const { code, ownerUserId, trackingNumber } = body;
    if (!code || !ownerUserId) {
      return NextResponse.json({ error: "Code and barber are required" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("sticker_codes")
      .update({
        owner_user_id: ownerUserId,
        status: "active",
        claimed_at: new Date().toISOString(),
        tracking_number: trackingNumber || null,
        shipped_at: new Date().toISOString(),
      })
      .eq("code", code)
      .eq("status", "unclaimed")
      .select("code")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Code is not unclaimed or does not exist" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "retire") {
    const { code } = body;
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const { error } = await admin
      .from("sticker_codes")
      .update({ status: "retired" })
      .eq("code", code);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
