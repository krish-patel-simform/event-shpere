"use client";

import { useHasPermission } from "@/src/features/auth";
import type { EventDisplayStatus } from "../schemas/event-manage.schemas";
import { isEditable } from "../utils/event-display";

/**
 * May the signed-in user change this event (its details, content, images and sessions)? Only its
 * organizer (EVENT_MANAGE_OWN; the server checks the event is theirs), and only while it is a
 * draft or published. An admin (EVENT_MANAGE_ALL) may VIEW any event but not change it: the
 * server answers 403 EVENT_READ_ONLY, so the screens hide every edit control instead. Use this
 * for an edit control, never `isEditable` alone.
 */
export function useCanEditEvent(status: EventDisplayStatus): boolean {
  const isOrganizer = useHasPermission("EVENT_MANAGE_OWN");
  return isOrganizer && isEditable(status);
}
