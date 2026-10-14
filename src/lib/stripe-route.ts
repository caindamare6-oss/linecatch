import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** The signed-in barber's id, or a 401 response. */
export async function signedInBarber(): Promise<{ userId: string } | { response: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId: user.id };
}

/** Stripe problems go to the server logs; the barber gets a plain message. */
export function stripeFailed(where: string, err: unknown) {
  console.error(`[stripe:${where}]`, err);
  return NextResponse.json({ error: "payments.unavailable" }, { status: 503 });
}
