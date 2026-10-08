import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { TEXT_CATALOG, MAX_TEXT_LENGTH, missingFillIns, unknownFillIns } from "@/lib/text-catalog";
import { MISSED_CALL_PRESETS } from "@/lib/missed-call-text";

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isAdmin(user.id);
}

/** Built-in wording, for texts that have no row yet (the missed-call styles before their migration). */
const BUILT_IN: Record<string, { en: string; es: string }> = {
  missed_call_casual: MISSED_CALL_PRESETS.casual,
  missed_call_professional: MISSED_CALL_PRESETS.professional,
};

/** Founder only: every default text, as clients get it today. */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { data: rows } = await createAdminClient()
    .from("message_templates")
    .select("template_key, custom_message, custom_message_es, updated_at")
    .is("user_id", null)
    .in("template_key", TEXT_CATALOG.map((t) => t.key));
  const byKey = new Map((rows || []).map((r) => [r.template_key, r]));
  const texts = TEXT_CATALOG.map((item) => {
    const r = byKey.get(item.key);
    return { ...item, en: r?.custom_message ?? BUILT_IN[item.key]?.en ?? "", es: r?.custom_message_es ?? BUILT_IN[item.key]?.es ?? "", updatedAt: r?.updated_at ?? null };
  });
  return NextResponse.json({ texts });
}

/** Founder only: save one default text (English required, Spanish optional). */
export async function PUT(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const item = TEXT_CATALOG.find((t) => t.key === body?.key);
  if (!item) return NextResponse.json({ error: "Unknown text" }, { status: 400 });
  const en = typeof body.en === "string" ? body.en.trim() : "";
  const es = typeof body.es === "string" ? body.es.trim() : "";
  if (!en) return NextResponse.json({ error: "The English text can't be empty" }, { status: 400 });
  for (const [lang, text] of [["English", en], ["Spanish", es]] as const) {
    if (!text) continue;
    if (text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: `The ${lang} text is over ${MAX_TEXT_LENGTH} characters` }, { status: 400 });
    const missing = missingFillIns(text, item);
    if (missing.length) return NextResponse.json({ error: `The ${lang} text needs ${missing.map((k) => `{${k}}`).join(" and ")}` }, { status: 400 });
    const unknown = unknownFillIns(text, item);
    if (unknown.length) return NextResponse.json({ error: `The ${lang} text has ${unknown.map((k) => `{${k}}`).join(", ")}, which this text can't fill in` }, { status: 400 });
  }

  const db = createAdminClient();
  const values = { custom_message: en, custom_message_es: es || null, updated_at: new Date().toISOString() };
  // (user_id, template_key) is unique, but a null user_id never conflicts, so update first.
  const { data: updated, error } = await db.from("message_templates").update(values).is("user_id", null).eq("template_key", item.key).select("template_key");
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  if (!updated?.length) {
    const { error: insertError } = await db.from("message_templates").insert({ user_id: null, template_key: item.key, ...values });
    if (insertError) return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
