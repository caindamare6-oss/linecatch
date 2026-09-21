import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { url } = await request.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ valid: false, reason: "No URL provided" });
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ valid: false, reason: "Must be an http or https link" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (res.ok || res.status === 405) {
      return NextResponse.json({ valid: true, status: res.status });
    }

    return NextResponse.json({
      valid: false,
      reason: `Link returned status ${res.status}`,
      status: res.status,
    });
  } catch {
    return NextResponse.json({
      valid: false,
      reason: "Could not reach this link. Check the URL and try again.",
    });
  }
}
