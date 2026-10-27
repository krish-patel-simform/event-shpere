import type { PendingOrganizer } from "./admin-overview";

// What the admin "Organizers" page shows. The pending and rejected rows come from
// GET /api/admin/organizers?verification=pending|rejected. The events and registrations of an
// approved organizer have no API yet (no events tables): sample data in these shapes until then.

export type OrganizerEventCounts = {
  published: number;
  drafts: number;
  completed: number;
};

type OrganizerPerson = Pick<
  PendingOrganizer,
  | "id"
  | "organizerFirstName"
  | "organizerLastName"
  | "organizationName"
  | "email"
>;

export type ApprovedOrganizer = OrganizerPerson & {
  /** ISO date-time. */
  verifiedAt: string;
  /** Full name of the admin who approved. */
  verifiedBy: string;
  events: OrganizerEventCounts;
  registrations: number;
};

export type RejectedOrganizer = Omit<OrganizerPerson, "email"> & {
  /** ISO date-time. */
  rejectedAt: string;
  /** What the applicant was told. */
  rejectionReason: string;
};

export type AdminOrganizersData = {
  /** ISO date-time the lists were loaded: "N days waiting" counts up to it. */
  asOf: string;
  /** Totals of the whole platform; the lists below hold one page each. */
  counts: { pending: number; approved: number; rejected: number };
  /** Oldest first. */
  pending: PendingOrganizer[];
  /** One page of the approved organizers. */
  approved: ApprovedOrganizer[];
  approvedPage: { page: number; pageSize: number };
  rejected: RejectedOrganizer[];
};
