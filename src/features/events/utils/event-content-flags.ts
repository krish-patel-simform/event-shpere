import type { EventContentDto } from "../schemas/event-content.schemas";

/**
 * What the publish checklist and the stepper read from the event overview: is the description
 * written, is there a banner. After a save the browser works these out from the content the
 * server just answered with, instead of asking for the whole overview again.
 *
 * It repeats the rule of the overview endpoint (loadContentFlags in server/event.service.ts: the
 * description text is not blank, and a cover exists). If that rule changes, change this too; the
 * overview is refetched on every visit, so a difference would not last.
 */
export function contentFlags(
  content: Pick<EventContentDto, "about" | "coverImage">,
): { hasDescription: boolean; hasBanner: boolean } {
  return {
    hasDescription: content.about.trim() !== "",
    hasBanner: content.coverImage !== null,
  };
}
