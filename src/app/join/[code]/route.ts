import { NextResponse } from "next/server";
import { normalizeCode, REF_COOKIE } from "@/lib/referrals";

/** Share link: linecatch.app/join/CODE. Remembers the code for 30 days, then shows the landing page. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  const url = new URL("/", request.url);
  if (code) url.searchParams.set("ref", code);
  const res = NextResponse.redirect(url);
  if (code) res.cookies.set(REF_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return res;
}
