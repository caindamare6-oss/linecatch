import { createAdminClient } from "@/lib/supabase/admin";
import type { ShippingAddress } from "@/lib/marketing";
import { STICKER_PRICE_CENTS } from "@/lib/config";

export { cleanAddress } from "@/lib/marketing";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Queue a QR sticker for shipping. Idempotent: a barber already waiting on a sticker
 * (or who already has an active one) isn't queued twice; the address on file is still updated.
 */
export async function requestSticker(db: Admin, userId: string, address: ShippingAddress) {
  const [{ data: user }, { data: active }] = await Promise.all([
    db.from("users").select("sticker_requested_at, business_name, first_name, email").eq("user_id", userId).single(),
    db.from("sticker_codes").select("code").eq("owner_user_id", userId).eq("status", "active").limit(1).maybeSingle(),
  ]);
  await db.from("users").update({ shipping_address: address }).eq("user_id", userId);
  if (active || user?.sticker_requested_at) return { queued: false };

  await db.from("users").update({ sticker_requested_at: new Date().toISOString() }).eq("user_id", userId);
  await db.from("activity_feed").insert({
    user_id: userId,
    event_type: "sticker_request",
    description: `QR sticker ordered, shipping to ${address.city}, ${address.state}`,
    // No payment processor yet: the order is recorded with its price and collected separately.
    metadata: { address, email: user?.email ?? null, price_cents: STICKER_PRICE_CENTS, paid: false },
  });
  return { queued: true };
}
