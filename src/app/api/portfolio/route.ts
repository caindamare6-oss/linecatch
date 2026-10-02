import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureSlug } from "@/lib/portfolio";
import { checkSlug } from "@/lib/slug";
import { DEFAULT_THEME, THEME_IDS, isAccent, type ThemeId } from "@/lib/themes";

async function currentUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const slug = await ensureSlug(db, userId);
  const [{ data: user }, { data: photos }] = await Promise.all([
    db.from("users").select("theme, avatar_url, accent_color").eq("user_id", userId).single(),
    db.from("portfolio_photos").select("id, url, thumb_url, width, height, sort_order").eq("user_id", userId).order("sort_order"),
  ]);
  return NextResponse.json({ slug, theme: user?.theme ?? DEFAULT_THEME, avatarUrl: user?.avatar_url ?? null, accentColor: user?.accent_color ?? null, photos: photos || [] });
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: (await getT()).t("portfolio.unauthorized") }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const db = createAdminClient();
  const { t } = await getT();

  if (body.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase();
    const problem = checkSlug(slug);
    if (problem === "format") {
      return NextResponse.json({ error: t("portfolio.err_slug_format") }, { status: 400 });
    }
    if (problem === "reserved") {
      return NextResponse.json({ error: t("portfolio.err_slug_reserved") }, { status: 400 });
    }
    const { error } = await db.from("users").update({ slug }).eq("user_id", userId);
    if (error?.code === "23505") return NextResponse.json({ error: t("portfolio.err_slug_taken") }, { status: 409 });
    if (error) return NextResponse.json({ error: t("portfolio.err_save_link") }, { status: 500 });
  }

  if (body.theme !== undefined) {
    if (!THEME_IDS.includes(body.theme as ThemeId)) {
      return NextResponse.json({ error: t("portfolio.err_theme") }, { status: 400 });
    }
    const { error } = await db.from("users").update({ theme: body.theme }).eq("user_id", userId);
    if (error) return NextResponse.json({ error: t("portfolio.err_save_theme") }, { status: 500 });
  }

  if (body.accentColor !== undefined) {
    if (!isAccent(body.accentColor)) return NextResponse.json({ error: t("portfolio.err_color") }, { status: 400 });
    const { error } = await db.from("users").update({ accent_color: body.accentColor }).eq("user_id", userId);
    if (error) return NextResponse.json({ error: t("portfolio.err_save_color") }, { status: 500 });
  }

  if (Array.isArray(body.order)) {
    const ids = body.order.map(String);
    const { data: owned } = await db.from("portfolio_photos").select("id").eq("user_id", userId);
    const ownedIds = new Set((owned || []).map((p) => p.id));
    if (ids.length !== ownedIds.size || ids.some((id: string) => !ownedIds.has(id))) {
      return NextResponse.json({ error: t("portfolio.err_order") }, { status: 409 });
    }
    for (const [i, id] of ids.entries()) {
      await db.from("portfolio_photos").update({ sort_order: i }).eq("id", id).eq("user_id", userId);
    }
  }

  return NextResponse.json({ success: true });
}
