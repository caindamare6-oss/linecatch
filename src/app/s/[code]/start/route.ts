import { NextResponse } from "next/server";

/** Old "Set up my shop" sticker link: sign-up is the normal flow now. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/login?mode=up", request.url));
}
