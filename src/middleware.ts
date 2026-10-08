import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SLUGS } from "@/lib/slug";
import { safeNext } from "@/lib/next-path";

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: options?.maxAge ?? 60 * 60 * 24 * 365,
            });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isApiRoute = path.startsWith("/api");
  const isCallbackRoute = path.startsWith("/auth/callback");
  const isOnboarding = path.startsWith("/onboarding");
  const isVip = path.startsWith("/vip/");
  const isPublicPage = path === "/privacy" || path === "/terms" || path === "/robots.txt" || path === "/manifest.webmanifest";
  const isBooking = path.startsWith("/book/");
  const isManage = path.startsWith("/manage/");
  const isSticker = path.startsWith("/s/");
  const isShortLink = path.startsWith("/c/");
  const isJoin = path.startsWith("/join/");
  // Barber portfolio: a single path segment that isn't one of the app's own routes.
  const segments = path.split("/").filter(Boolean);
  const isPortfolio = segments.length === 1 && !RESERVED_SLUGS.has(segments[0]);

  if (isApiRoute || isCallbackRoute || isVip || isPublicPage || isBooking || isManage || isSticker || isShortLink || isJoin || isPortfolio) {
    return supabaseResponse;
  }

  // A redirect must carry any login cookies getUser() just refreshed. Supabase refresh tokens are
  // single-use: dropping the new ones would log the barber out on a later request.
  const redirect = (url: URL) => {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // After logging in, land on the page the link pointed to (e.g. a booking from a text).
    url.search = "";
    if (path !== "/" && path !== "/dashboard") url.searchParams.set("next", path + request.nextUrl.search);
    return redirect(url);
  }

  if (user && isAuthRoute) {
    return redirect(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
  }

  if (user && !isOnboarding && !isAuthRoute) {
    const { data: profile } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single();

    if (profile && !profile.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
