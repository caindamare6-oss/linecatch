import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/config";

type Admin = ReturnType<typeof createAdminClient>;

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/l/I
const CODE_LENGTH = 8;
/** Links to the app this long or longer get shortened in texts. */
const MIN_LENGTH = 40;

export const isShortCode = (code: string) => code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));

function newCode() {
  return [...randomBytes(CODE_LENGTH)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** "https://www.linecatch.app" → "www.linecatch.app": phones still make it tappable. */
const shortBase = () => appUrl().replace(/^https?:\/\//, "");

/**
 * Swap long links to the app in a text for short ones (www.linecatch.app/c/Ab3dE6fG), which
 * redirect to the same place. Anything that can't be shortened is left as it was.
 */
export async function shortenLinks(db: Admin, body: string): Promise<string> {
  const base = appUrl();
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const urls = [...new Set((body.match(new RegExp(`${escaped}/[^\\s]+`, "g")) || []).map((u) => u.replace(/[.,!?)]+$/, "")))].filter((u) => u.length >= MIN_LENGTH);
  let out = body;
  for (const url of urls) {
    const target = url.slice(base.length);
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode();
      const { error } = await db.from("short_links").insert({ code, target });
      if (!error) {
        out = out.split(url).join(`${shortBase()}/c/${code}`);
        break;
      }
      if (error.code !== "23505") break; // not a code clash (table missing, DB down): keep the long link
    }
  }
  return out;
}
