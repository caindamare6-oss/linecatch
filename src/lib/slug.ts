// Top-level paths the app already uses (or may soon); a barber's page can never take one.
export const RESERVED_SLUGS = new Set([
  "api", "auth", "book", "dashboard", "login", "manage", "onboarding", "privacy", "s", "terms", "vip",
  "admin", "settings", "app", "www", "help", "support", "about", "pricing", "blog", "static", "public",
  "_next", "favicon.ico", "robots.txt", "sitemap.xml",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "barber";
}

export type SlugProblem = "format" | "reserved";

export function checkSlug(slug: string): SlugProblem | null {
  if (!SLUG_RE.test(slug)) return "format";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}
