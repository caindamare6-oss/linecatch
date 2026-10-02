import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ClaimSticker } from "./claim-client";
import { HandOutSticker } from "./hand-out";
import { isAdmin } from "@/lib/admin";
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
    .select("code, owner_user_id, status, handed_to")
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

  // The founder in the field: record which shop gets this sticker before handing it over.
  if (user && isAdmin(user.id)) {
    return <HandOutSticker code={sticker.code} shop={sticker.handed_to || ""} />;
  }

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

  // Not signed in: a barber who was just handed this sticker sets up their shop with it.
  const shop = sticker.handed_to?.trim();
  return (
    <div className="min-h-screen bg-[#121110] flex items-center justify-center px-4 py-10">
      <LanguageToggle className="fixed top-4 right-4 z-40" />
      <div className="w-full max-w-md bg-[#1B1A18] rounded-2xl p-7 border border-[#2C2A27]">
        <div className="text-2xl font-bold mb-5 text-white text-center">
          Line<span className="text-[var(--accent-color)]">Catch</span>
        </div>
        <h1 className="text-[22px] font-semibold text-white text-center leading-tight">
          {shop ? t("claim.setup_title", { shop }) : t("claim.setup_title_generic")}
        </h1>
        <p className="text-stone-400 text-sm mt-2 text-center">{t("claim.setup_body")}</p>
        <ul className="mt-5 space-y-2.5">
          {t("claim.setup_points").split("|").map((p) => (
            <li key={p} className="flex gap-2.5 text-[14px] text-stone-300">
              <span className="text-[var(--accent-color)]" aria-hidden>✓</span>
              {p}
            </li>
          ))}
        </ul>
        <a
          href={`/s/${sticker.code}/start`}
          className="mt-6 block text-center bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold px-6 py-3.5 rounded-xl hover:brightness-95 transition"
        >
          {t("claim.setup_cta")}
        </a>
        <a href={`/s/${sticker.code}/start`} className="mt-3 block text-center text-[13px] text-stone-400 hover:text-stone-200">
          {t("claim.setup_signin")}
        </a>
        <p className="mt-5 text-center font-mono tracking-[2px] text-[12px] text-stone-600">{sticker.code}</p>
      </div>
    </div>
  );
}
