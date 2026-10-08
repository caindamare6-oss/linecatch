import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assignNumberSoon } from "@/lib/phone-numbers";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The barber's cover photo: the big photo at the top of their page (replaces the profile photo). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { t } = await getT();
  if (!user) return NextResponse.json({ error: t("portfolio.unauthorized") }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("cover");
  if (!(file instanceof File)) return NextResponse.json({ error: t("portfolio.err_no_photo") }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: t("portfolio.err_type") }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: t("portfolio.err_size") }, { status: 400 });

  const db = createAdminClient();
  const { data: before } = await db.from("users").select("cover_path").eq("user_id", user.id).maybeSingle();

  // A new name each time, so phones and the CDN never show the old cover.
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await db.storage
    .from("covers")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" });
  if (uploadError) {
    console.error("[cover upload]", uploadError);
    return NextResponse.json({ error: t("portfolio.err_upload") }, { status: 500 });
  }
  const coverUrl = db.storage.from("covers").getPublicUrl(path).data.publicUrl;

  const { error } = await db.from("users").update({ cover_url: coverUrl, cover_path: path }).eq("user_id", user.id);
  if (error) {
    await db.storage.from("covers").remove([path]);
    return NextResponse.json({ error: t("portfolio.err_save_photo") }, { status: 500 });
  }
  if (before?.cover_path && before.cover_path !== path) await db.storage.from("covers").remove([before.cover_path]);

  // The cover can be the last step before they get a LineCatch number.
  assignNumberSoon(user.id);
  return NextResponse.json({ coverUrl });
}
