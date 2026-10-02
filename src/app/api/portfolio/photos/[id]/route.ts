import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: photo } = await db.from("portfolio_photos").select("id, storage_path, thumb_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const { error } = await db.from("portfolio_photos").delete().eq("id", photo.id);
  if (error) return NextResponse.json({ error: "Could not remove the photo." }, { status: 500 });
  await db.storage.from("portfolio").remove(photo.thumb_path ? [photo.storage_path, photo.thumb_path] : [photo.storage_path]);
  return NextResponse.json({ success: true });
}
