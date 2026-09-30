import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectVisit } from "@/lib/loyalty";

export async function GET(request: Request) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 60);
  if (ids.length === 0) return NextResponse.json({ badges: {} });

  const db = createAdminClient();
  const { data: owned } = await db
    .from("bookings")
    .select("id, group_id")
    .eq("user_id", user.id)
    .in("id", ids);

  const badges: Record<string, { rewardDue: boolean; nextRewardCut: number; firstOfVisit: boolean; partySize: number }> = {};
  const byVisit = new Map<string, Awaited<ReturnType<typeof projectVisit>>>();

  for (const b of owned || []) {
    const key = b.group_id || b.id;
    if (!byVisit.has(key)) byVisit.set(key, await projectVisit(db, b.id));
    const p = byVisit.get(key);
    if (!p) continue;
    badges[b.id] = {
      rewardDue: p.due,
      nextRewardCut: p.upcomingRewardCut,
      firstOfVisit: p.firstBookingId === b.id,
      partySize: p.partySize,
    };
  }

  return NextResponse.json({ badges });
}
