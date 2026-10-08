"use client";

import Link from "next/link";
import { useState } from "react";
import { useT, LanguageToggle } from "@/lib/i18n";

export function ClaimSticker({
  code,
  existingCode,
}: {
  code: string;
  existingCode: string | null;
}) {
  const t = useT();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState("");

  async function handleClaim() {
    setClaiming(true);
    setError("");

    try {
      const res = await fetch("/api/stickers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("claim.err_failed"));
      }

      setClaimed(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.try_again"));
    } finally {
      setClaiming(false);
    }
  }

  // Barber already has an active sticker
  if (existingCode) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4">
        <LanguageToggle className="fixed top-4 right-4 z-40" />
        <div className="w-full max-w-md bg-[var(--app-card)] rounded-2xl p-8 border border-[var(--app-card-2)] text-center">
          <div className="text-3xl font-bold mb-6 text-white">
            Line<span className="text-[var(--accent-color)]">Catch</span>
          </div>
          <div className="w-14 h-14 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t("claim.have_title")}</h2>
          <p className="text-white/50 text-sm mb-2">
            {t("claim.have_code")} <span className="font-mono text-white">{existingCode}</span>.
          </p>
          <p className="text-white/40 text-sm mb-6">
            {t("claim.have_body")}
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
          >
            {t("claim.go_dashboard")}
          </Link>
        </div>
      </div>
    );
  }

  // Successfully activated
  if (claimed) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4">
        <LanguageToggle className="fixed top-4 right-4 z-40" />
        <div className="w-full max-w-md bg-[var(--app-card)] rounded-2xl p-8 border border-[var(--app-card-2)] text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t("claim.done_title")}</h2>
          <p className="text-white/50 mb-1">
            {t("claim.done_code_pre")} <span className="font-mono text-white">{code}</span> {t("claim.done_code_post")}
          </p>
          <p className="text-white/50 text-sm mb-6">
            {t("claim.done_body")}
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold px-6 py-3 rounded-lg hover:brightness-90 transition"
          >
            {t("claim.go_dashboard")}
          </Link>
        </div>
      </div>
    );
  }

  // Activate screen
  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-4">
      <LanguageToggle className="fixed top-4 right-4 z-40" />
      <div className="w-full max-w-md bg-[var(--app-card)] rounded-2xl p-8 border border-[var(--app-card-2)] text-center">
        <div className="text-3xl font-bold mb-6 text-white">
          Line<span className="text-[var(--accent-color)]">Catch</span>
        </div>
        <div className="w-14 h-14 rounded-full bg-[var(--accent-color)]/15 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[var(--accent-color)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v6.75h6.75v-6.75h-6.75z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t("claim.activate_title")}</h2>
        <p className="text-white/50 mb-3">
          {t("claim.code")} <span className="font-mono text-white text-lg">{code}</span>
        </p>
        <p className="text-white/40 text-sm mb-6">
          {t("claim.activate_body")}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold py-3 rounded-lg hover:brightness-90 transition disabled:opacity-50"
        >
          {claiming ? t("claim.activating") : t("claim.activate")}
        </button>
      </div>
    </div>
  );
}
