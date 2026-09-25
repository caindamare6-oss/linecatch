import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ClaimSticker } from "./claim-client";

export default async function StickerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  const admin = createAdminClient();
  const { data: sticker } = await admin
    .from("sticker_codes")
    .select("code, owner_user_id, status")
    .eq("code", normalized)
    .single();

  // Unknown or retired code
  if (!sticker || sticker.status === "retired") {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
          <div className="text-3xl font-bold mb-4 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <p className="text-gray-400 mb-2">
            This barber isn&apos;t available here anymore.
          </p>
          <p className="text-gray-500 text-sm">
            The sticker may have been moved or retired.
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

    // Log scan — never block the redirect on analytics failure
    admin
      .from("sticker_scans")
      .insert({ code: sticker.code, ip, user_agent: userAgent })
      .then(({ error }) => {
        if (error) console.error("Sticker scan log failed:", error.message);
      });

    redirect(`/vip/${sticker.owner_user_id}`);
  }

  // Unclaimed code — check if visitor is a signed-in barber
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Signed-in barber can claim
    return <ClaimSticker code={sticker.code} />;
  }

  // Not signed in — friendly message
  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl shadow-lg p-8 border border-[#2a2a2a] text-center">
        <div className="text-3xl font-bold mb-4 text-white">
          Line<span className="text-[var(--accent-color)]">Catch</span>
        </div>
        <p className="text-gray-400 mb-4">
          This sticker isn&apos;t set up yet.
        </p>
        <p className="text-gray-500 text-sm mb-6">
          If you&apos;re a barber, sign up to claim this sticker and start catching missed calls.
        </p>
        <a
          href="/login"
          className="inline-block bg-[var(--accent-color)] text-black font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
        >
          Sign Up as a Barber
        </a>
      </div>
    </div>
  );
}
