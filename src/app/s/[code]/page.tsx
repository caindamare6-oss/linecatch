import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Old QR stickers (the sticker program is retired). A sticker that was connected to a shop still
 * opens that shop's page; any other code goes to the LineCatch homepage. Nothing here breaks.
 */
export default async function OldStickerLink({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.trim().toUpperCase();
  if (/^[A-Z0-9]{4,12}$/.test(code)) {
    const db = createAdminClient();
    const { data: sticker } = await db.from("sticker_codes").select("owner_user_id").eq("code", code).maybeSingle();
    if (sticker?.owner_user_id) {
      const { data: owner } = await db.from("users").select("slug, is_active").eq("user_id", sticker.owner_user_id).maybeSingle();
      if (owner?.is_active !== false) redirect(owner?.slug ? `/${owner.slug}` : `/book/${sticker.owner_user_id}`);
    }
  }
  redirect("/");
}
