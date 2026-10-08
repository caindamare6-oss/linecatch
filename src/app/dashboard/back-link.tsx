"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

/** Header back arrow. A client component so its label follows the language even inside server pages. */
export function BackLink({ href }: { href: string }) {
  const t = useT();
  return (
    <Link
      href={href}
      aria-label={t("ui.back")}
      className="w-9 h-9 shrink-0 rounded-[10px] bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
    </Link>
  );
}
