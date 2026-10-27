import type { OrganizerListItemDto } from "../schemas/organizer.schemas";

// Rows as GET /api/admin/organizers returns them, for tests. Not used by the app.

type Row = OrganizerListItemDto;

const base = {
  organizationWebsite: null,
  accountStatus: "active",
  verifiedAt: null,
  verifiedBy: null,
  rejectedAt: null,
  rejectionReason: null,
} satisfies Partial<Row>;

export const studio: Row = {
  ...base,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e11",
  organizerFirstName: "Leena",
  organizerLastName: "Pillai",
  organizationName: "Studio Forty Two",
  email: "leena@example.com",
  emailVerified: true,
  appliedAt: "2026-10-12T09:00:00.000Z",
};
export const harbor: Row = {
  ...base,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e12",
  organizerFirstName: "Imran",
  organizerLastName: "Qureshi",
  organizationName: "Harbor Tech Talks",
  organizationWebsite: "https://harbortechtalks.example.com",
  email: "imran@example.com",
  emailVerified: true,
  appliedAt: "2026-10-14T09:00:00.000Z",
};
/** Email not verified: Approve is disabled. */
export const lakeside: Row = {
  ...base,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e13",
  organizerFirstName: "Fatima",
  organizerLastName: "Sheikh",
  organizationName: "Lakeside Conferences",
  organizationWebsite: "https://lakeside-conf.example.com",
  email: "fatima@example.com",
  emailVerified: false,
  appliedAt: "2026-10-17T09:00:00.000Z",
};
export const acme: Row = {
  ...base,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15",
  organizerFirstName: "Ananya",
  organizerLastName: "Rao",
  organizationName: "Acme Events Pvt Ltd",
  organizationWebsite: "https://acme-events.example.com",
  email: "ananya.rao@example.com",
  emailVerified: true,
  appliedAt: "2026-10-20T09:15:00.000Z",
};
/** As the API returns the waiting list: newest first. */
export const pendingRows: Row[] = [acme, lakeside, harbor, studio];

export const kinetic: Row = {
  ...base,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e23",
  organizerFirstName: "Kavya",
  organizerLastName: "Menon",
  organizationName: "Kinetic Events",
  email: "kavya@example.com",
  emailVerified: true,
  appliedAt: "2026-02-20T09:00:00.000Z",
  verifiedAt: "2026-03-02T10:00:00.000Z",
  verifiedBy: "Admin User",
};
export const orbit: Row = {
  ...kinetic,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e21",
  organizerFirstName: "Sanjay",
  organizerLastName: "Pillai",
  organizationName: "Orbit Community",
  email: "sanjay@example.com",
  verifiedAt: "2026-10-26T08:30:00.000Z",
};
export const approvedRows: Row[] = [orbit, kinetic];

export const pixelGarage: Row = {
  ...base,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e32",
  organizerFirstName: "Tanvi",
  organizerLastName: "Shah",
  organizationName: "Pixel Garage",
  email: "tanvi@example.com",
  emailVerified: true,
  appliedAt: "2026-08-10T09:00:00.000Z",
  rejectedAt: "2026-08-22T10:00:00.000Z",
  rejectionReason:
    "Duplicate application. An approved organizer account already exists for this email domain.",
};
export const gigs: Row = {
  ...pixelGarage,
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e33",
  organizerFirstName: "Rakesh",
  organizerLastName: "Jain",
  organizationName: "Gigs4All",
  email: "rakesh@example.com",
  rejectedAt: "2026-07-09T10:00:00.000Z",
  rejectionReason: "Organisation appeared to be a ticket resale service.",
};
export const rejectedRows: Row[] = [pixelGarage, gigs];
