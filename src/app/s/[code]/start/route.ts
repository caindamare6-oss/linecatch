import { NextResponse } from "next/server";
import { normalizeSticker, STICKER_COOKIE } from "@/lib/sticker-claim";

/** "Set up my shop" on an unclaimed sticker: remember the code through sign-up, then connect it at the end of setup. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeSticker((await params).code);
  const url = new URL("/login", request.url);
  url.searchParams.set("mode", "up");
  if (code) url.searchParams.set("sticker", code);
  const res = NextResponse.redirect(url);
  if (code) res.cookies.set(STICKER_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return res;
}
