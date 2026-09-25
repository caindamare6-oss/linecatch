import { createAdminClient } from "@/lib/supabase/admin";

// 31 characters — no O, 0, I, 1, L to avoid confusion on printed stickers
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join("");
}

export async function createStickerCode(
  ownerUserId: string | null,
  batchLabel: string | null
): Promise<{ code: string } | { error: string }> {
  const supabase = createAdminClient();
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCode();
    const { error } = await supabase.from("sticker_codes").insert({
      code,
      owner_user_id: ownerUserId,
      status: ownerUserId ? "active" : "unclaimed",
      claimed_at: ownerUserId ? new Date().toISOString() : null,
      batch_label: batchLabel,
    });

    if (!error) return { code };
    if (error.code !== "23505") {
      return { error: error.message };
    }
  }

  return { error: "Failed to generate unique code after multiple attempts" };
}

export async function createStickerBatch(
  count: number,
  batchLabel: string
): Promise<{ codes: string[] } | { error: string }> {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const result = await createStickerCode(null, batchLabel);
    if ("error" in result) return result;
    codes.push(result.code);
  }

  return { codes };
}
