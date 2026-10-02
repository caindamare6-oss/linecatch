import Link from "next/link";
import type { ReactNode } from "react";

/** Shared pieces of the barber app, matching the LineCatch gold design. */

export const SERIF = "font-heading";

export function PageHeader({ title, back, right, sub }: { title: ReactNode; back?: string; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="w-9 h-9 shrink-0 rounded-[10px] bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className={`${SERIF} text-[26px] leading-tight font-semibold tracking-[-0.5px] truncate`}>{title}</h1>
          {sub && <div className="text-[13px] text-white/40 mt-0.5">{sub}</div>}
        </div>
      </div>
      {right}
    </header>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.8px] text-white/35">{children}</h2>
      {right}
    </div>
  );
}

export function Card({ children, className = "", as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" }) {
  return (
    <As className={`bg-[#1B1A18] border border-white/[0.06] rounded-[14px] ${className}`}>{children}</As>
  );
}

type BadgeTone = "vip" | "due" | "muted" | "gold" | "danger";
const BADGE: Record<BadgeTone, string> = {
  vip: "text-[#A8C49A] bg-[#A8C49A]/[0.12]",
  due: "text-[#121110] bg-[#E0926A]",
  muted: "text-white/45 bg-white/[0.06]",
  gold: "text-[var(--accent-color)] bg-[var(--accent-color)]/[0.12]",
  danger: "text-[#F08A8A] bg-[#F08A8A]/[0.1]",
};
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-[0.4px] px-1.5 py-[2px] rounded-[5px] whitespace-nowrap ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, size = 42, bright = false }: { name: string | null; size?: number; bright?: boolean }) {
  const letter = (name?.trim()?.[0] || "#").toUpperCase();
  return (
    <span
      aria-hidden
      className={`${SERIF} shrink-0 rounded-xl flex items-center justify-center font-semibold ${
        bright ? "bg-gradient-to-br from-[var(--accent-color)] to-[#C29A62] text-[#121110]" : "bg-[var(--accent-color)]/[0.12] text-[var(--accent-color)]/90"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </span>
  );
}

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-[transform,box-shadow,background-color,border-color,color] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";

export function GoldButton({ children, onClick, href, className = "", disabled, type = "button" }: { children: ReactNode; onClick?: () => void; href?: string; className?: string; disabled?: boolean; type?: "button" | "submit" }) {
  const cls = `${btnBase} bg-[var(--accent-color)] text-[var(--accent-fg)] hover:shadow-[0_6px_22px_color-mix(in_srgb,var(--accent-color)_30%,transparent)] hover:-translate-y-px px-4 h-11 ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function GhostButton({ children, onClick, href, className = "", disabled }: { children: ReactNode; onClick?: () => void; href?: string; className?: string; disabled?: boolean }) {
  const cls = `${btnBase} border border-white/[0.12] text-white/75 hover:text-white hover:border-[var(--accent-color)]/40 px-4 h-11 ${className}`;
  if (href) return href.startsWith("/") ? <Link href={href} className={cls}>{children}</Link> : <a href={href} className={cls}>{children}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

/** Segmented control: All / Sent / Received etc. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-9 rounded-[9px] text-[13px] font-medium transition-colors ${
            value === o.value ? "bg-[var(--accent-color)] text-[var(--accent-fg)] font-semibold" : "text-white/50 hover:text-white/80"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <Card className="px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-white/[0.05] text-white/40 flex items-center justify-center">{icon}</div>}
      <p className="text-sm font-semibold text-white/80">{title}</p>
      {children && <div className="text-[13px] text-white/40 mt-1 leading-relaxed">{children}</div>}
    </Card>
  );
}
