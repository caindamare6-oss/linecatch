import { createAdminClient } from "@/lib/supabase/admin";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";

type Admin = ReturnType<typeof createAdminClient>;

export const MAX_PORTFOLIO_PHOTOS = 50;

/** Gives a barber a unique slug from their shop name if they don't have one yet. */
export async function ensureSlug(db: Admin, userId: string): Promise<string | null> {
  const { data: user } = await db.from("users").select("slug, business_name, first_name").eq("user_id", userId).single();
  if (!user) return null;
  if (user.slug) return user.slug;

  const base = slugify(user.business_name?.trim() || user.first_name?.trim() || "barber");
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const { error } = await db.from("users").update({ slug: candidate }).eq("user_id", userId).is("slug", null);
    if (!error) {
      const { data: after } = await db.from("users").select("slug").eq("user_id", userId).single();
      return after?.slug ?? candidate;
    }
    if (error.code !== "23505") throw error;
  }
  return null;
}
