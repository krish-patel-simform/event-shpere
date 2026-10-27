import type {
  OrganizerListItemDto,
  OrganizerVerificationFilter,
} from "../schemas/organizer.schemas";

/** The tabs above the list: one per verification list, plus `all` (no filter). */
export type OrganizerTabKey = "all" | OrganizerVerificationFilter;

/**
 * One row of the approval queue: the fields it shows from a row of
 * GET /api/admin/organizers?verification=pending. Also used by the dashboard's queue.
 */
export type PendingOrganizer = Pick<
  OrganizerListItemDto,
  | "id"
  | "organizerFirstName"
  | "organizerLastName"
  | "email"
  | "emailVerified"
  | "organizationName"
  | "organizationWebsite"
  | "appliedAt"
>;
