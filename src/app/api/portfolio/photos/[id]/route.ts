import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
