import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = 20;

  let query = supabase
    .from("activity_feed")
    .select("id, event_type, client_name, client_phone, description, metadata, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: events } = await query;

  const hasMore = (events?.length || 0) > limit;
  const items = (events || []).slice(0, limit);
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

  return NextResponse.json({ items, nextCursor });
}
