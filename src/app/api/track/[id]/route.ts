import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    if (barber?.booking_link) {
      const url = new URL(barber.booking_link);
      url.searchParams.set("src", "missed_call");
      return NextResponse.redirect(url.toString());
    }
  }

  return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL || "/");
}
