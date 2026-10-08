import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanService } from "@/lib/validate";

/**
 * Tag a photo with the cut it shows: one of the barber's services (`serviceId`), none (`null`),
 * or a new cut (`newService`) that is added to their services first, so clients can book it.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { t } = await getT();
  if (!user) return NextResponse.json({ error: t("portfolio.unauthorized") }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const db = createAdminClient();
  const { data: photo } = await db.from("portfolio_photos").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!photo) return NextResponse.json({ error: t("portfolio.err_not_found") }, { status: 404 });

  let serviceId: string | null = null;
  let created: { id: string; name: string; description: string | null; price: number; duration_minutes: number } | null = null;

  if (body.newService !== undefined) {
    const clean = cleanService(body.newService);
    if (!clean || clean.price <= 0) return NextResponse.json({ error: t("portfolio.err_new_cut") }, { status: 400 });
    const { data: mine } = await db.from("services").select("name, sort_order").eq("user_id", user.id);
    if ((mine || []).some((s) => s.name.trim().toLowerCase() === clean.name.toLowerCase())) {
      return NextResponse.json({ error: t("portfolio.err_cut_exists", { name: clean.name }) }, { status: 409 });
    }
    const nextOrder = Math.max(-1, ...(mine || []).map((s) => s.sort_order ?? 0)) + 1;
    const { data: row, error } = await db
      .from("services")
      .insert({ user_id: user.id, name: clean.name, description: clean.description, price: clean.price, duration_minutes: clean.duration, is_active: true, sort_order: nextOrder })
      .select("id, name, description, price, duration_minutes")
      .single();
    if (error || !row) return NextResponse.json({ error: t("portfolio.err_save_tag") }, { status: 500 });
    created = row;
    serviceId = row.id;
  } else if (body.serviceId === null) {
    serviceId = null;
  } else if (typeof body.serviceId === "string") {
    // Only the barber's own services; someone else's id matches nothing.
    const { data: svc } = await db.from("services").select("id").eq("id", body.serviceId).eq("user_id", user.id).maybeSingle();
    if (!svc) return NextResponse.json({ error: t("portfolio.err_tag_service") }, { status: 400 });
    serviceId = svc.id;
  } else {
    return NextResponse.json({ error: t("portfolio.err_tag_service") }, { status: 400 });
  }

  const { error } = await db.from("portfolio_photos").update({ service_id: serviceId }).eq("id", photo.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: t("portfolio.err_save_tag") }, { status: 500 });
  return NextResponse.json({ serviceId, service: created });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { t } = await getT();
  if (!user) return NextResponse.json({ error: t("portfolio.unauthorized") }, { status: 401 });

  const db = createAdminClient();
  const { data: photo } = await db.from("portfolio_photos").select("id, storage_path, thumb_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!photo) return NextResponse.json({ error: t("portfolio.err_not_found") }, { status: 404 });

  const { error } = await db.from("portfolio_photos").delete().eq("id", photo.id);
  if (error) return NextResponse.json({ error: t("portfolio.err_remove") }, { status: 500 });
  await db.storage.from("portfolio").remove(photo.thumb_path ? [photo.storage_path, photo.thumb_path] : [photo.storage_path]);
  return NextResponse.json({ success: true });
}
