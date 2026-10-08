import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { assignNumber, numberPool, releaseNumber } from "@/lib/phone-numbers";

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isAdmin(user.id);
}

/** Founder only: every LineCatch number we own, who has it, and when free ones can be reused. */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({ pool: await numberPool(createAdminClient()) });
}

/**
 * Founder only.
 *   { action: "release", userId }  take a number back from a barber; it stays ours and is reused after 30 days
 *   { action: "assign", userId }   give a fully set-up barber a number now
 */
export async function POST(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Missing barber" }, { status: 400 });
  const db = createAdminClient();
  if (body.action === "release") {
    const r = await releaseNumber(db, userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, phone: r.phone, pool: await numberPool(db) });
  }
  if (body.action === "assign") {
    const r = await assignNumber(db, userId);
    return NextResponse.json({ ...r, pool: await numberPool(db) }, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
