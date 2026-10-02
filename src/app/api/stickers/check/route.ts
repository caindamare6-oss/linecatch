import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pendingSticker } from "@/lib/sticker-claim";

/** Public: can this sticker still be set up? Returns the shop it was handed to, nothing else. */
export async function GET(request: Request) {
  const p = await pendingSticker(createAdminClient(), new URL(request.url).searchParams.get("code"));
  return NextResponse.json(p ? { valid: true, code: p.code, shop: p.shop } : { valid: false });
}
