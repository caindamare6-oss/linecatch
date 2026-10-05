import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/config";
import { isShortCode } from "@/lib/short-link";

/** A short link from a text: send the phone on to the full link. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (isShortCode(code)) {
    const { data } = await createAdminClient().from("short_links").select("target").eq("code", code).maybeSingle();
    // Targets are always paths on this app, so a short link can never send someone elsewhere.
    if (data?.target?.startsWith("/") && !data.target.startsWith("//")) return NextResponse.redirect(`${appUrl()}${data.target}`);
  }
  return NextResponse.redirect(appUrl());
}
