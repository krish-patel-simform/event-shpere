/** "Tech Conf 2026: AI & ML!" → "tech-conf-2026-ai-ml". Accents removed, never empty. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // the accent marks NFKD split off
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, ""); // the cut may leave a trailing dash
  // A title of only symbols (or non-Latin letters) has nothing left.
  return slug || "event";
}
