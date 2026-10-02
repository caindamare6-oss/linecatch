import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ClaimSticker } from "./claim-client";
import { getT } from "@/lib/i18n-server";
import { LanguageToggle } from "@/lib/i18n";

export default async function StickerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const { t } = await getT();

  const admin = createAdminClient();
  const { data: sticker } = await admin
    .from("sticker_codes")
    .select("code, owner_user_id, status")
    .eq("code", normalized)
    .single();

  if (!sticker || sticker.status === "retired") {
    return (
      <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
        <LanguageToggle className="fixed top-4 right-4 z-40" />
        <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
          <div className="text-3xl font-bold mb-4 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <p className="text-stone-400 mb-2">
            {t("claim.gone_title")}
          </p>
          <p className="text-stone-500 text-sm">
            {t("claim.gone_body")}
          </p>
        </div>
      </div>
    );
  }

  // Active code with owner → redirect to VIP page, log the scan
  if (sticker.status === "active" && sticker.owner_user_id) {
    const headers = await import("next/headers");
    const headersList = await headers.headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = headersList.get("user-agent") || null;

    admin
      .from("sticker_scans")
      .insert({ code: sticker.code, ip, user_agent: userAgent })
      .then(({ error }) => {
        if (error) console.error("Sticker scan log failed:", error.message);
      });

    redirect(`/vip/${sticker.owner_user_id}?src=qr`);
  }

  // Unclaimed code — check if visitor is a signed-in barber
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if this barber already has an active sticker
    const { data: existingSticker } = await admin
      .from("sticker_codes")
      .select("code")
      .eq("owner_user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    return (
      <ClaimSticker
        code={sticker.code}
        existingCode={existingSticker?.code || null}
      />
    );
  }

  // Not signed in
  return (
    <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4">
      <LanguageToggle className="fixed top-4 right-4 z-40" />
      <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-8 border border-[#2C2A27] text-center">
        <div className="text-3xl font-bold mb-4 text-white">
          Line<span className="text-[var(--accent-color)]">Catch</span>
        </div>
        <p className="text-stone-400 mb-4">
          {t("claim.unset_title")}
        </p>
        <p className="text-stone-500 text-sm mb-6">
          {t("claim.unset_body")}
        </p>
        <Link
          href="/login"
          className="inline-block bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
        >
          {t("claim.unset_cta")}
        </Link>
      </div>
    </div>
  );
}
