import { blocksToText } from "./bio-blocks";
import type { StrapiBlocks } from "../../cms";

type SpeakerName = { firstName: string; lastName: string };

export function speakerFullName(speaker: SpeakerName): string {
  return `${speaker.firstName} ${speaker.lastName}`;
}

/** "Principal Frontend Engineer · Northwind Labs"; whichever is missing is left out. */
export function roleLine(profile: {
  jobTitle: string | null;
  company: string | null;
}): string | null {
  const parts = [profile.jobTitle, profile.company].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The bio as paragraphs of plain text (never raw HTML); empty = no bio yet. */
export function bioParagraphs(bio: StrapiBlocks): string[] {
  return blocksToText(bio)
    .split(/\n\n+/)
    .filter((paragraph) => paragraph.trim() !== "");
}
