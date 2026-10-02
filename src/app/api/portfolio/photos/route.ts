import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PORTFOLIO_PHOTOS } from "@/lib/portfolio";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Photo is over 5 MB." }, { status: 400 });

  const toDim = (v: FormDataEntryValue | null | undefined) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
  };

  const db = createAdminClient();
  const { data: existing } = await db.from("portfolio_photos").select("sort_order").eq("user_id", user.id).order("sort_order", { ascending: false });
  if ((existing?.length ?? 0) >= MAX_PORTFOLIO_PHOTOS) {
    return NextResponse.json({ error: `You can show up to ${MAX_PORTFOLIO_PHOTOS} photos. Remove one first.` }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const path = `${user.id}/${id}.${ext}`;
  const { error: uploadError } = await db.storage
    .from("portfolio")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" });
  if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });

  const { data: urlData } = db.storage.from("portfolio").getPublicUrl(path);

  // Optional small copy for the grid; the page falls back to the full photo without it.
  let thumbPath: string | null = null;
  let thumbUrl: string | null = null;
  const thumb = form?.get("thumb");
  if (thumb instanceof File && TYPES[thumb.type] && thumb.size <= MAX_SIZE) {
    thumbPath = `${user.id}/${id}-thumb.${TYPES[thumb.type]}`;
    const { error: thumbError } = await db.storage
      .from("portfolio")
      .upload(thumbPath, Buffer.from(await thumb.arrayBuffer()), { contentType: thumb.type, cacheControl: "31536000" });
    if (thumbError) thumbPath = null;
    else thumbUrl = db.storage.from("portfolio").getPublicUrl(thumbPath).data.publicUrl;
  }
  const { data: photo, error: insertError } = await db
    .from("portfolio_photos")
    .insert({
      user_id: user.id,
      storage_path: path,
      url: urlData.publicUrl,
      thumb_url: thumbUrl,
      thumb_path: thumbPath,
      width: toDim(form?.get("width")),
      height: toDim(form?.get("height")),
      sort_order: (existing?.[0]?.sort_order ?? -1) + 1,
    })
    .select("id, url, thumb_url, width, height, sort_order")
    .single();

  if (insertError || !photo) {
    await db.storage.from("portfolio").remove(thumbPath ? [path, thumbPath] : [path]);
    return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
  }
  return NextResponse.json({ photo });
}
