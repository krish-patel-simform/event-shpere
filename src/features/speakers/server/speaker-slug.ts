import "server-only";
import { randomBytes } from "node:crypto";

const MAX_BASE_LENGTH = 60;

/**
 * Public URL part for a speaker: "Ankit Śharma" → "ankit-sharma-3f9a1c".
 * The random suffix keeps two speakers with the same name apart without a DB lookup.
 */
export function createSpeakerSlug(
  firstName: string,
  lastName: string,
  suffix: string = randomBytes(3).toString("hex"),
): string {
  const base = `${firstName} ${lastName}`
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // drop accents: "é" → "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, "");
  // A name with no latin letters or digits (e.g. "李 雷") still gets a valid slug.
  return `${base || "speaker"}-${suffix}`;
}
