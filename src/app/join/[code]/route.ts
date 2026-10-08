import { NextResponse } from "next/server";
import { normalizeCode, REF_COOKIE } from "@/lib/referrals";

/** Share link: linecatch.app/join/CODE. Remembers the code for 30 days, then goes to sign-up. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  const url = new URL("/login", request.url);
  url.searchParams.set("mode", "up");
  if (code) url.searchParams.set("ref", code);
  const res = NextResponse.redirect(url);
  if (code) res.cookies.set(REF_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return res;
}
