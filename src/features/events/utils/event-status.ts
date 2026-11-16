import type { EventDisplayStatus } from "../schemas/event-manage.schemas";

/**
 * The status the organizer sees from what is stored. "Completed" is not stored: it is a
 * published event whose end has passed. A draft whose date passed stays a draft.
 */
export function toDisplayStatus(
  status: "draft" | "published" | "cancelled",
  endAt: Date,
  now: Date,
): EventDisplayStatus {
  if (status === "published" && endAt.getTime() < now.getTime()) {
    return "completed";
  }
  return status;
}
