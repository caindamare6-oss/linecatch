import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params;
  const supabase = createAdminClient();

  // Log the click
  await supabase.from("link_clicks").insert({
    call_id: callId,
    clicked_at: new Date().toISOString(),
  });

  // Get the barber's booking link for this call
  const { data: call } = await supabase
    .from("missed_calls_log")
    .select("user_id")
    .eq("call_id", callId)
    .single();

  if (call) {
    const { data: barber } = await supabase
      .from("users")
      .select("booking_link")
      .eq("user_id", call.user_id)
      .single();

    const base = appUrl();
    let url: URL;
    try {
      url = new URL(barber?.booking_link || `${base}/book/${call.user_id}`);
    } catch {
      url = new URL(`${base}/book/${call.user_id}`);
    }
    url.searchParams.set("src", "missed_call");
    // Only hand the client token to our own booking page, never a third-party link.
    const token = new URL(request.url).searchParams.get("t");
    if (token && url.origin === new URL(base).origin && url.pathname.startsWith("/book/")) {
      url.searchParams.set("t", token);
    }
    return NextResponse.redirect(url.toString());
  }

  return NextResponse.redirect(appUrl());
}
