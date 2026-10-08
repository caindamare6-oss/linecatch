"use client";

import Link from "next/link";
import { useState } from "react";
import { useT, LanguageToggle } from "@/lib/i18n";

/** Admin in the field: scan a fresh sticker, type the shop's name, hand it over. */
export function HandOutSticker({ code, shop: initial }: { code: string; shop: string }) {
  const t = useT();
  const [shop, setShop] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError("");
    const res = await fetch("/api/admin/stickers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hand_out", code, shop }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || t("claim.err_failed"));
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4 py-10">
      <LanguageToggle className="fixed top-4 right-4 z-40" />
      <div className="w-full max-w-md bg-[var(--app-card)] rounded-2xl p-7 border border-[var(--app-card-2)]">
        <p className="text-center font-mono tracking-[3px] text-[22px] text-[var(--accent-color)]">{code}</p>
        {state === "done" ? (
          <>
            <p className="mt-4 text-center text-[15px] text-white leading-relaxed">{t("claim.handout_done", { code, shop })}</p>
            <p className="mt-6 text-center text-[13px] text-white/50">{t("claim.handout_next")}</p>
            <Link href="/dashboard/admin/stickers" className="mt-4 block text-center text-[13px] text-[var(--accent-color)]">{t("claim.handout_admin")}</Link>
          </>
        ) : (
          <form onSubmit={save} className="mt-4">
            <h1 className="text-[20px] font-semibold text-white text-center">{t("claim.handout_title")}</h1>
            <p className="text-white/50 text-sm mt-1.5 text-center">{t("claim.handout_body")}</p>
            <label htmlFor="handout-shop" className="block text-[12px] text-white/50 mt-5 mb-1.5">{t("claim.handout_shop")}</label>
            <input
              id="handout-shop"
              autoFocus
              required
              value={shop}
              onChange={(e) => setShop(e.target.value.slice(0, 60))}
              placeholder={t("claim.handout_shop_placeholder")}
              className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.12] px-4 text-[16px] text-white placeholder-white/25 outline-none focus:border-[var(--accent-color)]/50"
            />
            {error && <p className="text-[13px] text-[var(--app-danger)] mt-2" role="alert">{t(error)}</p>}
            <button type="submit" disabled={state === "saving" || !shop.trim()} className="mt-4 w-full h-12 rounded-xl bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold disabled:opacity-50">
              {state === "saving" ? t("claim.handout_saving") : t("claim.handout_save")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
