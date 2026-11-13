/** "Tech Conf 2026: AI & ML!" → "tech-conf-2026-ai-ml". Accents removed, never empty. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // the accent marks NFKD split off
    .toLowerCase()
    // Every run of other characters (dashes included) becomes ONE dash, so the text never holds
    // "--" after this line. That is why the trims below match a single dash: no `-+`, so the
    // regex has nothing to backtrack over.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, ""); // the cut may leave a trailing dash (only ever one)
  // A title of only symbols (or non-Latin letters) has nothing left.
  return slug || "event";
}
