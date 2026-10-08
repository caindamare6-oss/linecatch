import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimSticker } from "@/lib/sticker-claim";
import { getT } from "@/lib/i18n-server";

export async function POST(request: Request) {
  const { t } = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: t("claim.err_unauthorized") }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: t("claim.err_required") }, { status: 400 });
  }

  const result = await claimSticker(createAdminClient(), user.id, code);
  if (result.ok) return NextResponse.json({ success: true, code: result.code });
  const status = { not_found: 404, have_one: 409, own: 409, taken: 409, retired: 410, failed: 500 }[result.error];
  return NextResponse.json({ error: t(`claim.err_${result.error}`), existingCode: result.existingCode }, { status });
}
